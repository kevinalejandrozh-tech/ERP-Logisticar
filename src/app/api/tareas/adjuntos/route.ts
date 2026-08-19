import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la tarea." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT fotos, documentos FROM tareas_kanban WHERE id = $1`, [id]);
    const fila = result.rows[0];
    return NextResponse.json({ ok: true, fotos: fila?.fotos || [], documentos: fila?.documentos || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los adjuntos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { id, fotos, documentos } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la tarea." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    if (fotos !== undefined) {
      await pool.query(`UPDATE tareas_kanban SET fotos = $2::jsonb, updated_at = now() WHERE id = $1`, [id, JSON.stringify(fotos)]);
    }
    if (documentos !== undefined) {
      await pool.query(`UPDATE tareas_kanban SET documentos = $2::jsonb, updated_at = now() WHERE id = $1`, [id, JSON.stringify(documentos)]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar los adjuntos." }, { status: 500 });
  }
}
