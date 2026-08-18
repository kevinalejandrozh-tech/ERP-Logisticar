import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, nombre, fechaInicio, fechaFin, responsable, color, avance } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la actividad." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE gantt_actividades SET
         nombre = COALESCE($2, nombre),
         fecha_inicio = COALESCE($3, fecha_inicio),
         fecha_fin = COALESCE($4, fecha_fin),
         responsable = COALESCE($5, responsable),
         color = COALESCE($6, color),
         avance = COALESCE($7, avance),
         updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, nombre ?? null, fechaInicio ?? null, fechaFin ?? null, responsable ?? null, color ?? null, avance ?? null]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la actividad." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar la actividad." }, { status: 500 });
  }
}
