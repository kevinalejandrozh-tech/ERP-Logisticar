import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DICTAMENES = ["Apto", "No apto"];

// POST /api/evaluacion-candidatos/update → { id, dictamen_final: "Apto" | "No apto" | "", observaciones }
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id no válido." }, { status: 400 });
    const dictamen = DICTAMENES.includes(body.dictamen_final) ? body.dictamen_final : null;
    const obs = typeof body.observaciones === "string" ? body.observaciones.trim().slice(0, 2000) : null;
    await getPool().query(`UPDATE evaluaciones_candidatos SET dictamen_final = $2, observaciones = $3 WHERE id = $1`, [id, dictamen, obs || null]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo actualizar." }, { status: 500 });
  }
}
