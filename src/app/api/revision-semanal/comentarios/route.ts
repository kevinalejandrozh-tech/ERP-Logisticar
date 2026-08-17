import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT eco, comentario FROM revision_semanal_comentarios`);
    const mapa: Record<string, string> = {};
    result.rows.forEach((r) => {
      mapa[r.eco] = r.comentario || "";
    });
    return NextResponse.json({ ok: true, comentarios: mapa });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los comentarios." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { eco, comentario } = await req.json();
    if (!eco) {
      return NextResponse.json({ error: "Falta el ECO." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(
      `INSERT INTO revision_semanal_comentarios (eco, comentario) VALUES ($1, $2)
       ON CONFLICT (eco) DO UPDATE SET comentario = EXCLUDED.comentario, updated_at = now()`,
      [eco, comentario ?? ""]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el comentario." }, { status: 500 });
  }
}
