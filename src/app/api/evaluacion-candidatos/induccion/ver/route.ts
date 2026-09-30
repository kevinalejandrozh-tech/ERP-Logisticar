import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/evaluacion-candidatos/induccion/ver            → { ok, partes }   (PÚBLICA, solo lectura)
// GET /api/evaluacion-candidatos/induccion/ver?parte=N    → { ok, partes, contenido }
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const pool = getPool();
    const meta = await pool.query(`SELECT partes FROM evaluacion_induccion WHERE id = 1`);
    const partes = meta.rows[0]?.partes || 0;
    const parteParam = req.nextUrl.searchParams.get("parte");
    if (parteParam === null) return NextResponse.json({ ok: true, partes });
    const parte = Number(parteParam);
    if (!Number.isInteger(parte) || parte < 0 || parte >= partes) return NextResponse.json({ error: "Parte no válida." }, { status: 404 });
    const r = await pool.query(`SELECT contenido FROM evaluacion_induccion_partes WHERE indice = $1`, [parte]);
    if (!r.rows.length) return NextResponse.json({ error: "Parte no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, partes, contenido: r.rows[0].contenido });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el video." }, { status: 500 });
  }
}
