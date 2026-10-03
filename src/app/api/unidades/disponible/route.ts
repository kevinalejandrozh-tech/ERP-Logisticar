import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// POST { eco, disponible } — marca la unidad como Disponible / No disponible.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const eco = String(b?.eco || "").trim();
    if (!eco || typeof b?.disponible !== "boolean") return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    await ensureSchema();
    const r = await getPool().query(`UPDATE unidades SET disponible = $2 WHERE eco = $1`, [eco, b.disponible]);
    if (!r.rowCount) return NextResponse.json({ error: "La unidad no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, disponible: b.disponible });
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al actualizar la unidad." }, { status: 500 });
  }
}
