import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, capacitacion, nombre, total_preguntas, correctas, aciertos, tiempo_evaluacion, respuestas, created_at
       FROM capacitaciones_evaluaciones
       ORDER BY created_at DESC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      capacitacion: r.capacitacion,
      nombre: r.nombre,
      totalPreguntas: r.total_preguntas,
      correctas: r.correctas,
      aciertos: Number(r.aciertos),
      tiempoEvaluacion: r.tiempo_evaluacion,
      respuestas: r.respuestas || [],
      creadoEn: r.created_at,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las evaluaciones." }, { status: 500 });
  }
}
