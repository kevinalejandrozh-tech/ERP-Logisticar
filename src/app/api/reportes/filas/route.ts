import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM reporte_filas`);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(`INSERT INTO reporte_filas (datos, orden) VALUES ('{}'::jsonb, $1) RETURNING id`, [orden]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear la fila." }, { status: 500 });
  }
}
