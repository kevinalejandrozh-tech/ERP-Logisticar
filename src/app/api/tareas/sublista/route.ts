import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { tareaId, texto } = await req.json();
    if (!tareaId || !texto || !String(texto).trim()) {
      return NextResponse.json({ error: "Falta la tarea o el texto del punto." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM tareas_sublista WHERE tarea_id = $1`, [tareaId]);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(`INSERT INTO tareas_sublista (tarea_id, texto, orden) VALUES ($1,$2,$3) RETURNING id`, [tareaId, String(texto).trim(), orden]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al agregar el punto." }, { status: 500 });
  }
}
