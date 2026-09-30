import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/evaluacion-candidatos/get?id=X → evaluación completa (sin el video).
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id no válido." }, { status: 400 });
    const r = await getPool().query(`SELECT * FROM evaluaciones_candidatos WHERE id = $1`, [id]);
    if (!r.rows.length) return NextResponse.json({ error: "Evaluación no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, evaluacion: r.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la evaluación." }, { status: 500 });
  }
}
