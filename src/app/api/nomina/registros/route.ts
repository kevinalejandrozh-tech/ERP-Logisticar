import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, leerConfigNomina, sesionNomina } from "@/lib/nominaDB";
import { CAMPOS_NUMERICOS, CAPTURA_VACIA, NominaCaptura, aNumero, calcularTotales, folioNomina } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function periodoAbierto(periodoId: number) {
  const r = await getPool().query(`SELECT id, anio, semana, estado FROM nomina_periodos WHERE id = $1`, [periodoId]);
  return r.rows[0] as { id: number; anio: number; semana: number; estado: string } | undefined;
}

// Guarda (o actualiza) la nómina de un empleado en una semana. Los totales siempre se calculan en el servidor.
export async function PUT(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const body = await req.json();
    const periodoId = Number(body.periodo_id);
    const expedienteId = Number(body.expediente_id);
    if (!periodoId || !expedienteId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    await ensureNominaSchema();
    const periodo = await periodoAbierto(periodoId);
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
    const t = calcularTotales(captura, await leerConfigNomina());

    const valores = [
      periodoId, expedienteId, folioNomina(periodo.anio, periodo.semana, expedienteId), er.rows[0].nombre, er.rows[0].puesto,
      captura.sueldo_semanal, captura.dias_asistidos, captura.faltas, captura.retardos,
      captura.bonos, captura.otros_incentivos, captura.incentivos_detalle,
      captura.licencia_federal, captura.imss, captura.caja_ahorro, captura.prestamo, captura.otros_descuentos, captura.otros_descuentos_detalle,
      t.salario_diario, t.faltas_equivalentes, t.descuento_faltas, t.total_percepciones, t.total_deducciones, t.neto,
      captura.observaciones, s.nombre,
    ];
    const r = await pool.query(
      `INSERT INTO nomina_registros (
         periodo_id, expediente_id, folio, nombre, puesto,
         sueldo_semanal, dias_asistidos, faltas, retardos,
         bonos, otros_incentivos, incentivos_detalle,
         licencia_federal, imss, caja_ahorro, prestamo, otros_descuentos, otros_descuentos_detalle,
         salario_diario, faltas_equivalentes, descuento_faltas, total_percepciones, total_deducciones, neto,
         observaciones, capturado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
       ON CONFLICT (periodo_id, expediente_id) DO UPDATE SET
         nombre = EXCLUDED.nombre, puesto = EXCLUDED.puesto,
         sueldo_semanal = EXCLUDED.sueldo_semanal, dias_asistidos = EXCLUDED.dias_asistidos, faltas = EXCLUDED.faltas, retardos = EXCLUDED.retardos,
         bonos = EXCLUDED.bonos, otros_incentivos = EXCLUDED.otros_incentivos, incentivos_detalle = EXCLUDED.incentivos_detalle,
         licencia_federal = EXCLUDED.licencia_federal, imss = EXCLUDED.imss, caja_ahorro = EXCLUDED.caja_ahorro, prestamo = EXCLUDED.prestamo,
         otros_descuentos = EXCLUDED.otros_descuentos, otros_descuentos_detalle = EXCLUDED.otros_descuentos_detalle,
         salario_diario = EXCLUDED.salario_diario, faltas_equivalentes = EXCLUDED.faltas_equivalentes, descuento_faltas = EXCLUDED.descuento_faltas,
         total_percepciones = EXCLUDED.total_percepciones, total_deducciones = EXCLUDED.total_deducciones, neto = EXCLUDED.neto,
         observaciones = EXCLUDED.observaciones, capturado_por = EXCLUDED.capturado_por, updated_at = now()
       RETURNING id`,
      valores
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id, totales: t });
  } catch (err) {
    return errorJson(err, "Error al guardar la nómina.");
  }
}

// Descarta la captura guardada de un empleado (vuelve a la propuesta automática). Solo en semana abierta.
export async function DELETE(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const periodoId = Number(req.nextUrl.searchParams.get("periodo_id"));
    const expedienteId = Number(req.nextUrl.searchParams.get("expediente_id"));
    if (!periodoId || !expedienteId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    await ensureNominaSchema();
    const periodo = await periodoAbierto(periodoId);
    if (!periodo) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
    if (periodo.estado !== "Abierta") return NextResponse.json({ error: "La semana no está abierta." }, { status: 409 });
    await getPool().query(`DELETE FROM nomina_registros WHERE periodo_id = $1 AND expediente_id = $2`, [periodoId, expedienteId]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al descartar la captura.");
  }
}
