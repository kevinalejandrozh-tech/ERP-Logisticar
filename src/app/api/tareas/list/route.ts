import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, tarea, responsable, fecha_entrega, estado, avances, color, categoria, urgente, orden, ancho, archivada, jsonb_array_length(coalesce(fotos, '[]'::jsonb)) AS fotos_count, jsonb_array_length(coalesce(documentos, '[]'::jsonb)) AS documentos_count FROM tareas_kanban ORDER BY orden ASC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      tarea: r.tarea,
      responsable: r.responsable || "",
      fechaEntrega: r.fecha_entrega || "",
      estado: r.estado,
      avances: r.avances || [],
      color: r.color || "",
      categoria: r.categoria || "",
      urgente: !!r.urgente,
      orden: Number(r.orden) || 0,
      ancho: r.ancho || "full",
      archivada: !!r.archivada,
      fotosCount: Number(r.fotos_count) || 0,
      documentosCount: Number(r.documentos_count) || 0,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las tareas." }, { status: 500 });
  }
}
