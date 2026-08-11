import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, tarea, responsable, fecha_entrega, estado, avances FROM tareas_kanban ORDER BY id ASC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      tarea: r.tarea,
      responsable: r.responsable || "",
      fechaEntrega: r.fecha_entrega || "",
      estado: r.estado,
      avances: r.avances || [],
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las tareas." }, { status: 500 });
  }
}
