import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, estado } = await req.json();
    if (!id || !estado) {
      return NextResponse.json({ error: "Faltan datos para actualizar la tarea." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`UPDATE tareas_kanban SET estado = $2, updated_at = now() WHERE id = $1 RETURNING id`, [id, estado]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar la tarea." }, { status: 500 });
  }
}
