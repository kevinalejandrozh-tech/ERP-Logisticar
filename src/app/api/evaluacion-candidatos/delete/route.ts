import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST /api/evaluacion-candidatos/delete → { id }  (el video se borra en cascada)
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { id } = await req.json();
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return NextResponse.json({ error: "Id no válido." }, { status: 400 });
    await getPool().query(`DELETE FROM evaluaciones_candidatos WHERE id = $1`, [n]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo eliminar." }, { status: 500 });
  }
}
