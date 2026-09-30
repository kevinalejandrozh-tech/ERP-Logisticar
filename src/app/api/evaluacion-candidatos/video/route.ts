import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { VIDEO_MAX_BYTES, VIDEO_TAM_PARTE } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// El video (mp4) se sube y se descarga en partes base64 para no rebasar el límite de
// tamaño de body/respuesta de las funciones serverless de Vercel (~4.5 MB).
const MAX_PARTES = Math.ceil((VIDEO_MAX_BYTES * 4) / 3 / VIDEO_TAM_PARTE) + 1;
const BASE64 = /^[A-Za-z0-9+/=]+$/;

// POST /api/evaluacion-candidatos/video → { id, indice, total, nombre, contenido }
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { id, indice, total, nombre, contenido } = await req.json();
    const evId = Number(id);
    const i = Number(indice);
    const t = Number(total);
    if (!Number.isInteger(evId) || evId <= 0) return NextResponse.json({ error: "Id no válido." }, { status: 400 });
    if (!Number.isInteger(t) || t < 1 || t > MAX_PARTES || !Number.isInteger(i) || i < 0 || i >= t) {
      return NextResponse.json({ error: "Partes de video no válidas." }, { status: 400 });
    }
    if (typeof contenido !== "string" || !contenido || contenido.length > VIDEO_TAM_PARTE || !BASE64.test(contenido)) {
      return NextResponse.json({ error: "Contenido de video no válido." }, { status: 400 });
    }
    const pool = getPool();
    const ev = await pool.query(`SELECT id FROM evaluaciones_candidatos WHERE id = $1`, [evId]);
    if (!ev.rows.length) return NextResponse.json({ error: "Evaluación no encontrada." }, { status: 404 });

    if (i === 0) {
      await pool.query(`DELETE FROM evaluaciones_candidatos_video WHERE evaluacion_id = $1`, [evId]);
      await pool.query(`UPDATE evaluaciones_candidatos SET video_partes = 0, video_nombre = $2 WHERE id = $1`, [evId, typeof nombre === "string" ? nombre.slice(0, 180) : "video.mp4"]);
    }
    await pool.query(
      `INSERT INTO evaluaciones_candidatos_video (evaluacion_id, indice, contenido) VALUES ($1,$2,$3)
       ON CONFLICT (evaluacion_id, indice) DO UPDATE SET contenido = EXCLUDED.contenido`,
      [evId, i, contenido]
    );
    if (i === t - 1) {
      await pool.query(`UPDATE evaluaciones_candidatos SET video_partes = $2 WHERE id = $1`, [evId, t]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar el video." }, { status: 500 });
  }
}

// GET /api/evaluacion-candidatos/video?id=X&parte=N → { ok, total, contenido }
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const evId = Number(req.nextUrl.searchParams.get("id"));
    const parte = Number(req.nextUrl.searchParams.get("parte") ?? 0);
    if (!Number.isInteger(evId) || evId <= 0 || !Number.isInteger(parte) || parte < 0) {
      return NextResponse.json({ error: "Parámetros no válidos." }, { status: 400 });
    }
    const pool = getPool();
    const ev = await pool.query(`SELECT video_partes FROM evaluaciones_candidatos WHERE id = $1`, [evId]);
    const total = ev.rows[0]?.video_partes || 0;
    if (!total || parte >= total) return NextResponse.json({ error: "Sin video." }, { status: 404 });
    const r = await pool.query(`SELECT contenido FROM evaluaciones_candidatos_video WHERE evaluacion_id = $1 AND indice = $2`, [evId, parte]);
    if (!r.rows.length) return NextResponse.json({ error: "Parte no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, total, contenido: r.rows[0].contenido });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el video." }, { status: 500 });
  }
}
