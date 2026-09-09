import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, documentos } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    await pool.query(`UPDATE expedientes SET documentos = $2::jsonb, updated_at = now() WHERE id = $1`, [id, JSON.stringify(documentos || [])]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el documento." }, { status: 500 });
  }
}
