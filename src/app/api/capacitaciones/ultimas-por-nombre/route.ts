import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT DISTINCT ON (LOWER(TRIM(nombre))) nombre, capacitacion, aciertos, created_at
       FROM capacitaciones_evaluaciones
       ORDER BY LOWER(TRIM(nombre)), created_at DESC`
    );
    const porNombre: Record<string, { capacitacion: string; aciertos: number; fecha: string }> = {};
    for (const row of result.rows) {
      porNombre[String(row.nombre).trim().toLowerCase()] = { capacitacion: row.capacitacion, aciertos: Number(row.aciertos), fecha: row.created_at };
    }
    return NextResponse.json({ ok: true, porNombre });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las últimas evaluaciones." }, { status: 500 });
  }
}
