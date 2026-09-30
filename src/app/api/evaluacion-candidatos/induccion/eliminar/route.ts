import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/evaluacion-candidatos/induccion/eliminar → quita el video de inducción.
export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM evaluacion_induccion_partes`);
    await pool.query(`UPDATE evaluacion_induccion SET partes = 0, nombre = NULL, updated_at = now() WHERE id = 1`);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo eliminar el video." }, { status: 500 });
  }
}
