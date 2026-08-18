import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, tarea_id, tarea_nombre, cantidad, descripcion, monto, tipo_transaccion, referencia, fondo, fecha, created_at
       FROM tareas_gastos ORDER BY created_at DESC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      tareaId: r.tarea_id,
      tareaNombre: r.tarea_nombre || "",
      cantidad: r.cantidad ?? "",
      descripcion: r.descripcion || "",
      monto: r.monto ?? "",
      tipoTransaccion: r.tipo_transaccion || "",
      referencia: r.referencia || "",
      fondo: r.fondo || "",
      fecha: r.fecha || "",
      creadoEn: r.created_at,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los gastos." }, { status: 500 });
  }
}
