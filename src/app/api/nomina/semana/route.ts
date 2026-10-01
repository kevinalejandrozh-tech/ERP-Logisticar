import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, leerConfigNomina, sesionNomina } from "@/lib/nominaDB";
import { ensureAsistenciaSchema } from "@/lib/asistenciaDB";
import { CAMPOS_NUMERICOS, CAPTURA_VACIA, NominaCaptura, NominaRegistro, aNumero, calcularTotales, folioNomina } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Devuelve la semana con un renglón por empleado:
// - Si ya se guardó, el registro guardado.
// - Si no, una propuesta con su sueldo semanal y la asistencia de la semana:
//   módulo "Asistencia" (asistencias, faltas, retardos); si la persona no tiene registros ahí, "Asistencia diaria".
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
      `SELECT id, anio, semana, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin, estado
       FROM nomina_periodos WHERE id = $1`,
      [id]
    );
    const periodo = pr.rows[0];
    if (!periodo) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
    const config = await leerConfigNomina();

    const guardados = await pool.query(`SELECT * FROM nomina_registros WHERE periodo_id = $1`, [id]);
    const porExpediente = new Map<number, NominaRegistro>();
    for (const f of guardados.rows) {
      const reg: Record<string, unknown> = { ...f };
      for (const c of CAMPOS_NUMERICOS) reg[c] = aNumero(f[c]);
      for (const c of ["salario_diario", "faltas_equivalentes", "descuento_faltas", "total_percepciones", "total_deducciones", "neto"]) reg[c] = aNumero(f[c]);
      reg.incentivos_detalle = f.incentivos_detalle || "";
      reg.otros_descuentos_detalle = f.otros_descuentos_detalle || "";
      reg.observaciones = f.observaciones || "";
      porExpediente.set(f.expediente_id, reg as unknown as NominaRegistro);
    }

    const emp = await pool.query(`
      SELECT e.id, e.nombre, e.puesto, e.sueldo_ofertado, n.sueldo_semanal, (n.expediente_id IS NOT NULL) AS configurado
      FROM expedientes e
      LEFT JOIN nomina_empleados n ON n.expediente_id = e.id
      WHERE COALESCE(e.estatus_laboral, 'Activo') != 'Baja' AND COALESCE(n.incluir, true) = true
      ORDER BY e.nombre ASC
    `);
    const asis = await pool.query(
      `SELECT expediente_id,
              COUNT(*) FILTER (WHERE presente)::int AS presentes,
              COUNT(*) FILTER (WHERE NOT presente)::int AS ausentes
       FROM asistencia_diaria WHERE fecha BETWEEN $1 AND $2 GROUP BY expediente_id`,
      [periodo.fecha_inicio, periodo.fecha_fin]
    );
    const asistencia = new Map<number, { presentes: number; ausentes: number; retardos: number }>();
    for (const a of asis.rows) asistencia.set(a.expediente_id, { presentes: a.presentes, ausentes: a.ausentes, retardos: 0 });
    const nueva = await pool.query(
      `SELECT expediente_id,
              COUNT(*) FILTER (WHERE tipo = 'Asistencia')::int AS presentes,
              COUNT(*) FILTER (WHERE tipo = 'Falta')::int AS ausentes,
              COUNT(*) FILTER (WHERE tipo = 'Asistencia' AND retardo)::int AS retardos
       FROM asistencia_registros WHERE fecha BETWEEN $1 AND $2 GROUP BY expediente_id`,
      [periodo.fecha_inicio, periodo.fecha_fin]
    );
    for (const a of nueva.rows) asistencia.set(a.expediente_id, { presentes: a.presentes, ausentes: a.ausentes, retardos: a.retardos });

    const registros: NominaRegistro[] = [];
    for (const e of emp.rows) {
      const guardado = porExpediente.get(e.id);
      if (guardado) {
        registros.push(guardado);
        porExpediente.delete(e.id);
        continue;
      }
      const a = asistencia.get(e.id);
      const captura: NominaCaptura = {
        ...CAPTURA_VACIA,
        sueldo_semanal: e.configurado ? aNumero(e.sueldo_semanal) : aNumero(e.sueldo_ofertado),
        dias_asistidos: a?.presentes ?? 0,
        faltas: a?.ausentes ?? 0,
        retardos: a?.retardos ?? 0,
      };
      registros.push({
        ...captura,
        ...calcularTotales(captura, config),
        id: null,
        expediente_id: e.id,
        nombre: e.nombre,
        puesto: e.puesto,
        folio: folioNomina(periodo.anio, periodo.semana, e.id),
      });
    }
    // Registros guardados de personas que ya no están activas (se conservan en la semana).
    for (const r of porExpediente.values()) registros.push(r);
    registros.sort((x, y) => x.nombre.localeCompare(y.nombre, "es"));

    return NextResponse.json({ ok: true, periodo, config, registros });
  } catch (err) {
    return errorJson(err, "Error al leer la semana de nómina.");
  }
}
