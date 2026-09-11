import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.titulo || !String(body.titulo).trim()) {
      return NextResponse.json({ error: "Falta el título de la capacitación." }, { status: 400 });
    }
    const preguntas = Array.isArray(body.preguntas) ? body.preguntas : [];
    for (const p of preguntas) {
      if (!p.pregunta || !String(p.pregunta).trim()) {
        return NextResponse.json({ error: "Hay una pregunta sin texto." }, { status: 400 });
      }
      if (!p.opciones || !p.opciones.A || !p.opciones.B || !p.opciones.C || !p.opciones.D) {
        return NextResponse.json({ error: `Completa las 4 opciones de la pregunta "${p.pregunta}".` }, { status: 400 });
      }
      if (!["A", "B", "C", "D"].includes(p.correcta)) {
        return NextResponse.json({ error: `Marca la respuesta correcta de la pregunta "${p.pregunta}".` }, { status: 400 });
      }
    }
    await ensureSchema();
    const pool = getPool();

    if (body.id) {
      await pool.query(`UPDATE capacitaciones_catalogo SET titulo = $2, descripcion = $3, preguntas = $4::jsonb, updated_at = now() WHERE id = $1`, [
        body.id,
        String(body.titulo).trim(),
        body.descripcion || null,
        JSON.stringify(preguntas),
      ]);
      return NextResponse.json({ ok: true, id: body.id });
    }

    const result = await pool.query(`INSERT INTO capacitaciones_catalogo (titulo, descripcion, preguntas) VALUES ($1,$2,$3::jsonb) RETURNING id`, [
      String(body.titulo).trim(),
      body.descripcion || null,
      JSON.stringify(preguntas),
    ]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la capacitación." }, { status: 500 });
  }
}
