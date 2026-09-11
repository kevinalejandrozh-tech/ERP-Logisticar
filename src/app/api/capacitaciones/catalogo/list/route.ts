import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, titulo, descripcion, jsonb_array_length(preguntas) AS total_preguntas FROM capacitaciones_catalogo ORDER BY id ASC`
    );
    return NextResponse.json({ ok: true, registros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el catálogo." }, { status: 500 });
  }
}
