import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, tarea_id, texto, marcado, orden FROM tareas_sublista ORDER BY tarea_id ASC, orden ASC`);
    const registros = result.rows.map((r) => ({ id: r.id, tareaId: r.tarea_id, texto: r.texto, marcado: !!r.marcado }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las sublistas." }, { status: 500 });
  }
}
