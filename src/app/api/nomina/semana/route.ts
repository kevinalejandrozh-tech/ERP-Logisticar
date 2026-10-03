import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, estadoCreditos, leerConfigNomina, sesionNomina } from "@/lib/nominaDB";
import { SELECT_REGISTRO, ensureAsistenciaSchema, leerBonosRuta } from "@/lib/asistenciaDB";
import { TIPOS_TRABAJADOS } from "@/lib/asistenciaData";
import { CAMPOS_NUMERICOS, CAPTURA_VACIA, DEFAULTS_EMPLEADO, NominaCaptura, NominaRegistro, aNumero, calcularTotales, folioNomina, redondear, sumarCreditos } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Semana de nómina: un renglón por empleado (guardado o propuesta automática) + la información de apoyo:
// - propuestas: lo que resulta hoy de Asistencia (días, faltas, retardos, bonos por ruta) y de sus conceptos.
// - asistencia: los registros de la semana por persona (para el calendario de la ventana Capturar).
// - creditos: estado de licencia federal / préstamos al corte de la semana.
export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta la semana." }, { status: 400 });
    await ensureNominaSchema();
    await ensureAsistenciaSchema();
    const pool = getPool();
    const pr = await pool.query(
      `SELECT id, anio, semana, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin, estado, sueldo_base
       FROM nomina_periodos WHERE id = $1`,
      [id]
    );
    const periodo = pr.rows[0];
    if (!periodo) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
    periodo.sueldo_base = periodo.sueldo_base === null ? null : aNumero(periodo.sueldo_base);
    const config = await leerConfigNomina();

    // Personal de la semana: ingresó a más tardar al corte y, si está de baja, se fue en esta semana o después
    // (así las bajas siguen apareciendo en las semanas donde sí trabajaron).
    const emp = await pool.query(
      `SELECT e.id, e.nombre, e.puesto, e.sueldo_ofertado, to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
              n.sueldo_semanal, n.sueldo_base, n.imss, n.caja_ahorro, n.fonacot, n.infonavit, (n.expediente_id IS NOT NULL) AS configurado
       FROM expedientes e LEFT JOIN nomina_empleados n ON n.expediente_id = e.id
       WHERE (COALESCE(e.estatus_laboral, 'Activo') != 'Baja'
              OR (e.fecha_baja IS NOT NULL AND (e.fecha_baja AT TIME ZONE 'America/Mexico_City')::date >= $2::date))
         AND COALESCE(n.incluir, true) = true
         AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso <= $1)
       ORDER BY e.nombre ASC`,
      [periodo.fecha_fin, periodo.fecha_inicio]
    );
    const guardados = await pool.query(`SELECT * FROM nomina_registros WHERE periodo_id = $1`, [id]);
    const ids = Array.from(new Set([...emp.rows.map((e) => e.id as number), ...guardados.rows.map((g) => g.expediente_id as number)]));

    // Asistencia de la semana (módulo Asistencia; si la persona no tiene registros ahí, "Asistencia diaria").
    const asis = await pool.query(`SELECT ${SELECT_REGISTRO} FROM asistencia_registros WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha`, [periodo.fecha_inicio, periodo.fecha_fin]);
    const asistencia: Record<number, unknown[]> = {};
    for (const r of asis.rows) (asistencia[r.expediente_id] ||= []).push(r);
    const viejo = await pool.query(
      `SELECT expediente_id, COUNT(*) FILTER (WHERE presente)::int AS presentes, COUNT(*) FILTER (WHERE NOT presente)::int AS ausentes
       FROM asistencia_diaria WHERE fecha BETWEEN $1 AND $2 GROUP BY expediente_id`,
      [periodo.fecha_inicio, periodo.fecha_fin]
    );
    // Bono por ruta según la unidad del viaje. Un viaje del calendario cuenta una sola vez, en la semana en que inicia.
    const bonoDe = await leerBonosRuta();
    const idsViaje = Array.from(new Set(asis.rows.map((r) => r.viaje_id).filter(Boolean)));
    const viajesInfo = new Map<number, { eco: string; fecha: string }>();
    if (idsViaje.length) {
      const vr = await pool.query(`SELECT id, eco, to_char(fecha, 'YYYY-MM-DD') AS fecha FROM viajes_calendario WHERE id = ANY($1::int[])`, [idsViaje]);
      for (const v of vr.rows) viajesInfo.set(v.id, { eco: v.eco, fecha: v.fecha });
    }
    const creditos = await estadoCreditos(ids, { periodo_id: id, desde: periodo.fecha_inicio, hasta: periodo.fecha_fin });

    const resumenAsistencia = (eid: number) => {
      const regs = (asistencia[eid] || []) as { tipo: string; retardo: boolean; ruta: string | null; viaje_id: number | null }[];
      if (regs.length) {
        let bonos = 0;
        const contados = new Set<number>();
        for (const r of regs as { tipo: string; ruta: string | null; viaje_id: number | null }[]) {
          if (r.tipo !== "Viaje foráneo" || !r.ruta) continue;
          if (r.viaje_id) {
            const v = viajesInfo.get(r.viaje_id);
            if (contados.has(r.viaje_id) || (v && (v.fecha < periodo.fecha_inicio || v.fecha > periodo.fecha_fin))) continue;
            contados.add(r.viaje_id);
            bonos += bonoDe(r.ruta, v?.eco);
          } else {
            bonos += bonoDe(r.ruta, null); // captura manual sin viaje: bono general por día registrado
          }
        }
        return {
          dias_asistidos: regs.filter((r) => TIPOS_TRABAJADOS.includes(r.tipo)).length,
          faltas: regs.filter((r) => r.tipo === "Falta").length,
          retardos: regs.filter((r) => r.tipo === "Asistencia" && r.retardo).length,
          bonos_ruta: redondear(bonos),
        };
      }
      const v = viejo.rows.find((x) => x.expediente_id === eid);
      return { dias_asistidos: v?.presentes ?? 0, faltas: v?.ausentes ?? 0, retardos: 0, bonos_ruta: 0 };
    };

    const propuestas: Record<number, NominaCaptura> = {};
    const registros: NominaRegistro[] = [];
    const porExpediente = new Map(guardados.rows.map((g) => [g.expediente_id as number, g]));

    for (const e of emp.rows) {
      const conf = e.configurado;
      const a = resumenAsistencia(e.id);
      const cr = creditos.get(e.id) || [];
      const captura: NominaCaptura = {
        ...CAPTURA_VACIA,
        sueldo_semanal: conf ? aNumero(e.sueldo_semanal) : aNumero(e.sueldo_ofertado),
        sueldo_base: periodo.sueldo_base ?? (conf ? aNumero(e.sueldo_base) : DEFAULTS_EMPLEADO.sueldo_base),
        imss: conf ? aNumero(e.imss) : DEFAULTS_EMPLEADO.imss,
        caja_ahorro: conf ? aNumero(e.caja_ahorro) : DEFAULTS_EMPLEADO.caja_ahorro,
        fonacot: conf ? aNumero(e.fonacot) : DEFAULTS_EMPLEADO.fonacot,
        infonavit: conf ? aNumero(e.infonavit) : DEFAULTS_EMPLEADO.infonavit,
        ...a,
        bonos: a.bonos_ruta,
        creditos: cr.filter((c) => c.abono_semana > 0 || c.estado === "Activo").map((c) => ({ prestamo_id: c.id, concepto: c.concepto, abono: c.abono_semana })),
      };
      Object.assign(captura, sumarCreditos(captura));
      propuestas[e.id] = captura;
      if (!porExpediente.has(e.id)) {
        registros.push({ ...captura, ...calcularTotales(captura, config), id: null, expediente_id: e.id, nombre: e.nombre, puesto: e.puesto, folio: folioNomina(periodo.anio, periodo.semana, e.id) });
      }
    }
    for (const g of guardados.rows) {
      const reg: Record<string, unknown> = { ...g };
      for (const c of CAMPOS_NUMERICOS) reg[c] = aNumero(g[c]);
      for (const c of ["salario_diario", "faltas_equivalentes", "descuento_faltas", "total_percepciones", "total_deducciones", "neto", "deposito_bbva", "deposito_viaticos"]) reg[c] = aNumero(g[c]);
      reg.incentivos_detalle = g.incentivos_detalle || "";
      reg.otros_descuentos_detalle = g.otros_descuentos_detalle || "";
      reg.observaciones = g.observaciones || "";
      reg.creditos = Array.isArray(g.creditos) ? g.creditos : [];
      registros.push(reg as unknown as NominaRegistro);
    }
    registros.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

    // Caja de ahorro acumulada: solo la suma de los abonos capturados en nómina hasta esta semana.
    const cajaR = await pool.query(
      `SELECT r.expediente_id, COALESCE(SUM(r.caja_ahorro), 0) AS total
       FROM nomina_registros r JOIN nomina_periodos p ON p.id = r.periodo_id
       WHERE p.fecha_fin <= $1 AND r.expediente_id = ANY($2::int[]) GROUP BY r.expediente_id`,
      [periodo.fecha_fin, ids]
    );
    const caja: Record<number, number> = {};
    for (const c of cajaR.rows) caja[c.expediente_id] = redondear(aNumero(c.total));

    // Personas dadas de baja que aparecen en esta semana (fecha de baja editable desde la tabla de nómina).
    const bajasR = ids.length
      ? await pool.query(
          `SELECT id, motivo_baja, to_char((fecha_baja AT TIME ZONE 'America/Mexico_City')::date, 'YYYY-MM-DD') AS fecha_baja
           FROM expedientes WHERE id = ANY($1::int[]) AND COALESCE(estatus_laboral, 'Activo') = 'Baja'`,
          [ids]
        )
      : { rows: [] as { id: number; motivo_baja: string | null; fecha_baja: string | null }[] };
    const bajas: Record<number, { fecha_baja: string | null; motivo_baja: string | null }> = {};
    for (const b of bajasR.rows) bajas[b.id] = { fecha_baja: b.fecha_baja, motivo_baja: b.motivo_baja };

    return NextResponse.json({
      ok: true,
      bajas,
      periodo,
      config,
      registros,
      propuestas,
      asistencia,
      creditos: Object.fromEntries(creditos),
      caja,
      total_personal: emp.rows.length,
    });
  } catch (err) {
    return errorJson(err, "Error al leer la semana de nómina.");
  }
}