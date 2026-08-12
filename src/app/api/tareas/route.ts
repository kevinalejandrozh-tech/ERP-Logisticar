import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { tarea, responsable, fechaEntrega } = await req.json();
    if (!tarea || !String(tarea).trim()) {
      return NextResponse.json({ error: "Falta la descripción de la tarea." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO tareas_kanban (tarea, responsable, fecha_entrega, estado, orden) VALUES ($1, $2, $3, 'lista', $4) RETURNING id`,
      [tarea.trim(), responsable || null, fechaEntrega || null, Date.now()]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear la tarea." }, { status: 500 });
  }
}
