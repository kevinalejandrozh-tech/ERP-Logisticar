import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { capacitacion, nombre, totalPreguntas, correctas, aciertos, tiempoEvaluacion, respuestas } = await req.json();

    if (!capacitacion || !String(capacitacion).trim()) {
      return NextResponse.json({ error: "Falta el nombre de la capacitación." }, { status: 400 });
    }
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre del evaluado." }, { status: 400 });
    }

    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO capacitaciones_evaluaciones
        (capacitacion, nombre, total_preguntas, correctas, aciertos, tiempo_evaluacion, respuestas)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
       RETURNING id`,
      [
        String(capacitacion).trim(),
        String(nombre).trim(),
        Number(totalPreguntas) || 0,
        Number(correctas) || 0,
        Number(aciertos) || 0,
        Number.isFinite(Number(tiempoEvaluacion)) ? Number(tiempoEvaluacion) : null,
        JSON.stringify(respuestas || []),
      ]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la evaluación." }, { status: 500 });
  }
}
