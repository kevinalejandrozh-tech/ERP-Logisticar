import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, leerConfigNomina, recalcularSaldoCredito, sesionNomina } from "@/lib/nominaDB";
import { CAMPOS_NUMERICOS, CAPTURA_VACIA, CreditoCaptura, NominaCaptura, aNumero, calcularTotales, folioNomina, redondear, sumarCreditos } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function leerPeriodo(periodoId: number) {
  const r = await getPool().query(`SELECT id, anio, semana, estado, to_char(fecha_fin, 'YYYY-MM-DD') AS fecha_fin FROM nomina_periodos WHERE id = $1`, [periodoId]);
  return r.rows[0] as { id: number; anio: number; semana: number; estado: string; fecha_fin: string } | undefined;
}

// Guarda (o actualiza) la nómina de un empleado en una semana. Los totales y depósitos siempre se calculan en el servidor.
// Los abonos de créditos se validan contra su saldo y quedan registrados como abono semanal de esa semana.
export async function PUT(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  const body = await req.json().catch(() => ({}));
  const periodoId = Number(body.periodo_id);
  const expedienteId = Number(body.expediente_id);
  if (!periodoId || !expedienteId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
  await ensureNominaSchema();
  const periodo = await leerPeriodo(periodoId);
  if (!periodo) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
  if (periodo.estado !== "Abierta") return NextResponse.json({ error: `La semana está ${periodo.estado.toLowerCase()}; reábrela para editar.` }, { status: 409 });

  const pool = getPool();
  const er = await pool.query(`SELECT nombre, puesto FROM expedientes WHERE id = $1`, [expedienteId]);
  if (!er.rows[0]) return NextResponse.json({ error: "El empleado no existe." }, { status: 404 });

  const captura: NominaCaptura = { ...CAPTURA_VACIA };
  for (const c of CAMPOS_NUMERICOS) (captura[c] as number) = Math.max(0, aNumero(body[c]));
  captura.incentivos_detalle = String(body.incentivos_detalle || "").slice(0, 300);
  captura.otros_descuentos_detalle = String(body.otros_descuentos_detalle || "").slice(0, 300);
  captura.observaciones = String(body.observaciones || "").slice(0, 600);

  const cfg = await leerConfigNomina();
  const tocados: number[] = [];
  let resultado: NextResponse;
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    // Créditos: solo los de esta persona; el abono no puede exceder el saldo sin contar esta semana.
    const pedidos: { prestamo_id: number; abono: number }[] = Array.isArray(body.creditos)
      ? body.creditos.map((x: Record<string, unknown>) => ({ prestamo_id: Number(x.prestamo_id), abono: Math.max(0, aNumero(x.abono)) })).filter((x: { prestamo_id: number }) => x.prestamo_id)
      : [];
    const creditos: CreditoCaptura[] = [];
    for (const p of pedidos) {
      const r = await c.query(
        `SELECT p.concepto, p.monto_total - COALESCE((SELECT SUM(importe) FROM nomina_prestamo_abonos a
           WHERE a.prestamo_id = p.id AND NOT (a.tipo = 'Semanal' AND a.periodo_id = $3)), 0) AS saldo
         FROM nomina_prestamos p WHERE p.id = $1 AND p.expediente_id = $2`,
        [p.prestamo_id, expedienteId, periodoId]
      );
      if (!r.rows[0]) throw new Error("Uno de los créditos no pertenece a este empleado.");
      const abono = redondear(Math.min(p.abono, Math.max(0, aNumero(r.rows[0].saldo))));
      creditos.push({ prestamo_id: p.prestamo_id, concepto: r.rows[0].concepto, abono });
      tocados.push(p.prestamo_id);
    }
    captura.creditos = creditos;
    const sumas = sumarCreditos(captura);
    captura.licencia_federal = sumas.licencia_federal;
    captura.prestamo = sumas.prestamo;
    const t = calcularTotales(captura, cfg);

    const valores = [
      periodoId, expedienteId, folioNomina(periodo.anio, periodo.semana, expedienteId), er.rows[0].nombre, er.rows[0].puesto,
      captura.sueldo_semanal, captura.dias_asistidos, captura.faltas, captura.retardos,
      captura.bonos, captura.otros_incentivos, captura.incentivos_detalle,
      captura.licencia_federal, captura.imss, captura.caja_ahorro, captura.prestamo, captura.otros_descuentos, captura.otros_descuentos_detalle,
      t.salario_diario, t.faltas_equivalentes, t.descuento_faltas, t.total_percepciones, t.total_deducciones, t.neto,
      captura.observaciones, s.nombre,
      captura.sueldo_base, captura.fonacot, captura.infonavit, t.deposito_bbva, t.deposito_viaticos, captura.bonos_ruta, JSON.stringify(creditos),
    ];
    const r = await c.query(
      `INSERT INTO nomina_registros (
         periodo_id, expediente_id, folio, nombre, puesto,
         sueldo_semanal, dias_asistidos, faltas, retardos,
         bonos, otros_incentivos, incentivos_detalle,
         licencia_federal, imss, caja_ahorro, prestamo, otros_descuentos, otros_descuentos_detalle,
         salario_diario, faltas_equivalentes, descuento_faltas, total_percepciones, total_deducciones, neto,
         observaciones, capturado_por,
         sueldo_base, fonacot, infonavit, deposito_bbva, deposito_viaticos, bonos_ruta, creditos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33::jsonb)
       ON CONFLICT (periodo_id, expediente_id) DO UPDATE SET
         nombre = EXCLUDED.nombre, puesto = EXCLUDED.puesto,
         sueldo_semanal = EXCLUDED.sueldo_semanal, dias_asistidos = EXCLUDED.dias_asistidos, faltas = EXCLUDED.faltas, retardos = EXCLUDED.retardos,
         bonos = EXCLUDED.bonos, otros_incentivos = EXCLUDED.otros_incentivos, incentivos_detalle = EXCLUDED.incentivos_detalle,
         licencia_federal = EXCLUDED.licencia_federal, imss = EXCLUDED.imss, caja_ahorro = EXCLUDED.caja_ahorro, prestamo = EXCLUDED.prestamo,
         otros_descuentos = EXCLUDED.otros_descuentos, otros_descuentos_detalle = EXCLUDED.otros_descuentos_detalle,
         salario_diario = EXCLUDED.salario_diario, faltas_equivalentes = EXCLUDED.faltas_equivalentes, descuento_faltas = EXCLUDED.descuento_faltas,
         total_percepciones = EXCLUDED.total_percepciones, total_deducciones = EXCLUDED.total_deducciones, neto = EXCLUDED.neto,
         observaciones = EXCLUDED.observaciones, capturado_por = EXCLUDED.capturado_por,
         sueldo_base = EXCLUDED.sueldo_base, fonacot = EXCLUDED.fonacot, infonavit = EXCLUDED.infonavit,
         deposito_bbva = EXCLUDED.deposito_bbva, deposito_viaticos = EXCLUDED.deposito_viaticos, bonos_ruta = EXCLUDED.bonos_ruta,
         creditos = EXCLUDED.creditos, updated_at = now()
       RETURNING id`,
      valores
    );
    const registroId = r.rows[0].id;

    // Abonos semanales: los créditos de esta persona que ya no vienen (o vienen en 0) se quitan de esta semana.
    const previos = await c.query(
      `SELECT a.prestamo_id FROM nomina_prestamo_abonos a JOIN nomina_prestamos p ON p.id = a.prestamo_id
       WHERE a.tipo = 'Semanal' AND a.periodo_id = $1 AND p.expediente_id = $2`,
      [periodoId, expedienteId]
    );
    for (const pv of previos.rows) if (!tocados.includes(pv.prestamo_id)) tocados.push(pv.prestamo_id);
    for (const pid of tocados) {
      const cr = creditos.find((x) => x.prestamo_id === pid);
      if (cr && cr.abono > 0) {
        await c.query(
          `INSERT INTO nomina_prestamo_abonos (prestamo_id, registro_id, periodo_id, importe, fecha, tipo, registrado_por)
           VALUES ($1, $2, $3, $4, $5, 'Semanal', $6)
           ON CONFLICT (prestamo_id, periodo_id) WHERE tipo = 'Semanal' DO UPDATE SET importe = $4, registro_id = $2, fecha = $5, registrado_por = $6`,
          [pid, registroId, periodoId, cr.abono, periodo.fecha_fin, s.nombre]
        );
      } else {
        await c.query(`DELETE FROM nomina_prestamo_abonos WHERE prestamo_id = $1 AND periodo_id = $2 AND tipo = 'Semanal'`, [pid, periodoId]);
      }
    }
    await c.query("COMMIT");
    resultado = NextResponse.json({ ok: true, id: registroId, totales: t });
  } catch (err) {
    await c.query("ROLLBACK");
    tocados.length = 0;
    resultado = errorJson(err, "Error al guardar la nómina.");
  } finally {
    c.release();
  }
  // Saldos de los créditos tocados (fuera de la transacción, con la conexión ya liberada).
  for (const pid of tocados) await recalcularSaldoCredito(pid);
  return resultado;
}

// Descarta la captura guardada de un empleado (y sus abonos semanales de esa semana). Solo en semana abierta.
export async function DELETE(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const periodoId = Number(req.nextUrl.searchParams.get("periodo_id"));
    const expedienteId = Number(req.nextUrl.searchParams.get("expediente_id"));
    if (!periodoId || !expedienteId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    await ensureNominaSchema();
    const periodo = await leerPeriodo(periodoId);
    if (!periodo) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
    if (periodo.estado !== "Abierta") return NextResponse.json({ error: "La semana no está abierta." }, { status: 409 });
    const pool = getPool();
    const ab = await pool.query(
      `DELETE FROM nomina_prestamo_abonos a USING nomina_prestamos p
       WHERE p.id = a.prestamo_id AND a.tipo = 'Semanal' AND a.periodo_id = $1 AND p.expediente_id = $2 RETURNING a.prestamo_id`,
      [periodoId, expedienteId]
    );
    await pool.query(`DELETE FROM nomina_registros WHERE periodo_id = $1 AND expediente_id = $2`, [periodoId, expedienteId]);
    for (const r of ab.rows) await recalcularSaldoCredito(r.prestamo_id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al descartar la captura.");
  }
}
