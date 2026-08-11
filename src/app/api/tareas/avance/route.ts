import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, texto } = await req.json();
    if (!id || !texto || !String(texto).trim()) {
      return NextResponse.json({ error: "Falta el texto del avance." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const nuevo = [{ texto: String(texto).trim(), fecha: new Date().toISOString() }];
    const result = await pool.query(
      `UPDATE tareas_kanban SET avances = avances || $2::jsonb, updated_at = now() WHERE id = $1 RETURNING avances`,
      [id, JSON.stringify(nuevo)]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró la tarea." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, avances: result.rows[0].avances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al agregar el avance." }, { status: 500 });
  }
}
