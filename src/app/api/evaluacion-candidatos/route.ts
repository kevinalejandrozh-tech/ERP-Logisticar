import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { calificarEvaluacion } from "@/lib/evaluacionCandidatosPuntaje";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const txt = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// GET /api/evaluacion-candidatos → listado resumido (sin respuestas) para las etiquetas.
export async function GET() {
  try {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT id, puesto, nombre, edad, dictamen_auto, dictamen_final, puntaje_estrategico, max_estrategico,
              puntaje_conocimiento, max_conocimiento, video_partes, created_at
         FROM evaluaciones_candidatos ORDER BY created_at DESC, id DESC`
    );
    return NextResponse.json({ ok: true, evaluaciones: r.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las evaluaciones." }, { status: 500 });
  }
}

// POST /api/evaluacion-candidatos → guarda y califica una evaluación enviada.
// body: { puesto, datos: {...}, respuestas: { e1: 0, ..., c10: 3 } }
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const puesto = txt(body.puesto, 150);
    const d = body.datos || {};
    const nombre = txt(d.nombre, 150);
    const edad = Number.parseInt(String(d.edad ?? ""), 10);
    if (!puesto) return NextResponse.json({ error: "Falta el puesto." }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    if (!Number.isFinite(edad) || edad < 16 || edad > 99) return NextResponse.json({ error: "Edad no válida." }, { status: 400 });

    const datos = {
      nombre,
      edad,
      telefono: txt(d.telefono, 30),
      domicilio_actual: txt(d.domicilio_actual),
      tipo_vivienda: txt(d.tipo_vivienda, 80),
      familiar: txt(d.familiar, 150),
      pago_vivienda: txt(d.pago_vivienda, 60),
      tiempo_domicilio_actual: txt(d.tiempo_domicilio_actual, 60),
      domicilio_anterior: txt(d.domicilio_anterior),
      tiempo_domicilio_anterior: txt(d.tiempo_domicilio_anterior, 60),
      renta_anterior: txt(d.renta_anterior, 60),
      tiene_transporte: txt(d.tiene_transporte, 5),
      tipo_transporte: txt(d.tipo_transporte, 80),
    };

    const respuestas = typeof body.respuestas === "object" && body.respuestas ? body.respuestas : {};
    const cal = calificarEvaluacion(respuestas);
    if (cal.faltantes.length) {
      return NextResponse.json({ error: `Faltan ${cal.faltantes.length} pregunta(s) por responder.` }, { status: 400 });
    }

    const r = await getPool().query(
      `INSERT INTO evaluaciones_candidatos
        (puesto, nombre, edad, datos, respuestas, puntaje_estrategico, max_estrategico, puntaje_conocimiento, max_conocimiento, dictamen_auto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [puesto, nombre, edad, JSON.stringify(datos), JSON.stringify(cal.detalle), cal.puntajeEstrategico, cal.maxEstrategico, cal.puntajeConocimiento, cal.maxConocimiento, cal.dictamen]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar la evaluación." }, { status: 500 });
  }
}
