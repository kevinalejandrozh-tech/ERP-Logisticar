import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, datos FROM viajes ORDER BY id DESC`);
    const registros = result.rows.map((r) => ({ id: r.id, ...(r.datos || {}) }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los viajes." }, { status: 500 });
  }
}
