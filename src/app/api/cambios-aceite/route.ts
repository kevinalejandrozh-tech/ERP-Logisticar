import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { eco, unidad } = await req.json().catch(() => ({}));
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO cambios_aceite (eco, unidad) VALUES ($1, $2) RETURNING id`,
      [eco || null, unidad || null]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear el registro." }, { status: 500 });
  }
}
