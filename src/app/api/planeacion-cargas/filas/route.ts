import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    const maxOrden = await pool.query(`SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM planeacion_cargas_filas`);
    const result = await pool.query(`INSERT INTO planeacion_cargas_filas (datos, orden) VALUES ('{}'::jsonb, $1) RETURNING id`, [maxOrden.rows[0].siguiente]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al agregar la fila." }, { status: 500 });
  }
}
