import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, nombre, puesto, categoria, fotografia FROM expedientes ORDER BY nombre ASC`
    );
    return NextResponse.json({ ok: true, registros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los expedientes." }, { status: 500 });
  }
}
