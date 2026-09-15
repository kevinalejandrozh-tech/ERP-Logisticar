import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, correo, rol, created_at FROM usuarios ORDER BY created_at ASC`);
    return NextResponse.json({ ok: true, usuarios: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al listar usuarios." }, { status: 500 });
  }
}
