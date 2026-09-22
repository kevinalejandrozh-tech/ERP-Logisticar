import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, campos_extra } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    await getPool().query(`UPDATE expedientes SET campos_extra = $2::jsonb, updated_at = now() WHERE id = $1`, [id, JSON.stringify(campos_extra || {})]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar los campos." }, { status: 500 });
  }
}
