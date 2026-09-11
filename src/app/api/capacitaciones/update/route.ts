import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, nombre } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "El nombre no puede quedar vacío." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(`UPDATE capacitaciones_evaluaciones SET nombre = $2 WHERE id = $1`, [id, String(nombre).trim()]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el registro." }, { status: 500 });
  }
}
