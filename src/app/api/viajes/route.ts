import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const datos = await req.json();
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`INSERT INTO viajes (datos) VALUES ($1::jsonb) RETURNING id`, [JSON.stringify(datos || {})]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear el viaje." }, { status: 500 });
  }
}
