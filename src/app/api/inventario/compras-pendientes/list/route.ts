import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, descripcion, cantidad, origen, created_at FROM compras_pendientes ORDER BY created_at DESC`);
    const registros = result.rows.map((r) => ({ id: r.id, descripcion: r.descripcion || "", cantidad: r.cantidad ?? "", origen: r.origen || "" }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer compras pendientes." }, { status: 500 });
  }
}
