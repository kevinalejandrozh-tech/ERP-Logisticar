import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, tipo, codigo, descripcion, cantidad, datos, fecha FROM inventario_movimientos ORDER BY fecha DESC LIMIT 500`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      tipo: r.tipo,
      codigo: r.codigo || "",
      descripcion: r.descripcion || "",
      cantidad: r.cantidad ?? 0,
      datos: r.datos || {},
      fecha: r.fecha,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los movimientos." }, { status: 500 });
  }
}
