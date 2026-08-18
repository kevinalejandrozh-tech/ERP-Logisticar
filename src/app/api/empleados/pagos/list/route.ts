import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, dias_pagados, total_percepciones, total_deducciones, total_entregado, metodo_pago, banco, ultimos_4_cuenta, observaciones, estatus, fecha_elaboracion, orden
       FROM empleados_pagos ORDER BY orden ASC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      diasPagados: r.dias_pagados ?? "",
      totalPercepciones: r.total_percepciones ?? "",
      totalDeducciones: r.total_deducciones ?? "",
      totalEntregado: r.total_entregado ?? "",
      metodoPago: r.metodo_pago || "",
      banco: r.banco || "",
      ultimos4Cuenta: r.ultimos_4_cuenta || "",
      observaciones: r.observaciones || "",
      estatus: r.estatus || "",
      fechaElaboracion: r.fecha_elaboracion || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los pagos." }, { status: 500 });
  }
}
