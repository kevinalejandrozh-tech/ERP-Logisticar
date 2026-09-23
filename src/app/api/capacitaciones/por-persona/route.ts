import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const nombre = req.nextUrl.searchParams.get("nombre");
    if (!nombre) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    await ensureSchema();
    const result = await getPool().query(
      `SELECT DISTINCT ON (capacitacion) capacitacion, aciertos, created_at
       FROM capacitaciones_evaluaciones
       WHERE LOWER(TRIM(nombre)) = LOWER(TRIM($1))
       ORDER BY capacitacion, created_at DESC`,
      [nombre]
    );
    const porCapacitacion: Record<string, { aciertos: number; fecha: string }> = {};
    for (const row of result.rows) porCapacitacion[row.capacitacion] = { aciertos: Number(row.aciertos), fecha: row.created_at };
    return NextResponse.json({ ok: true, porCapacitacion });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las evaluaciones." }, { status: 500 });
  }
}
