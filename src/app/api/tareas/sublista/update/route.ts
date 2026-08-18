import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, marcado, texto } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del punto." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(
      `UPDATE tareas_sublista SET marcado = COALESCE($2, marcado), texto = COALESCE($3, texto), updated_at = now() WHERE id = $1`,
      [id, marcado ?? null, texto ?? null]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el punto." }, { status: 500 });
  }
}
