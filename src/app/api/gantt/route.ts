import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { nombre, fechaInicio, fechaFin, responsable, color } = await req.json();
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre de la actividad." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM gantt_actividades`);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(
      `INSERT INTO gantt_actividades (nombre, fecha_inicio, fecha_fin, responsable, color, orden) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [nombre.trim(), fechaInicio || null, fechaFin || null, responsable || "", color || "#2f6fed", orden]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear la actividad." }, { status: 500 });
  }
}
