import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, fecha_inicio, fecha_fin, responsable, color, orden FROM gantt_actividades ORDER BY orden ASC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      fechaInicio: r.fecha_inicio || "",
      fechaFin: r.fecha_fin || "",
      responsable: r.responsable || "",
      color: r.color || "#2f6fed",
      orden: Number(r.orden) || 0,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las actividades." }, { status: 500 });
  }
}
