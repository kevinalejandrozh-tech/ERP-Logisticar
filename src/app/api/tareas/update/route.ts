import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, estado, orden, color, categoria, urgente } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la tarea." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE tareas_kanban SET
         estado = COALESCE($2, estado),
         orden = COALESCE($3, orden),
         color = COALESCE($4, color),
         categoria = COALESCE($5, categoria),
         urgente = COALESCE($6, urgente),
         updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, estado ?? null, orden ?? null, color ?? null, categoria ?? null, urgente ?? null]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar la tarea." }, { status: 500 });
  }
}
