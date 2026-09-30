import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { VIDEO_MAX_BYTES, VIDEO_TAM_PARTE } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Video de inducción (privado: solo usuarios con sesión lo suben/consultan aquí).
// La descarga pública para el candidato está en /api/evaluacion-candidatos/induccion/ver.
const MAX_PARTES = Math.ceil((VIDEO_MAX_BYTES * 4) / 3 / VIDEO_TAM_PARTE) + 1;
const BASE64 = /^[A-Za-z0-9+/=]+$/;

// GET → { ok, nombre, partes, updated_at }
export async function GET() {
  try {
    await ensureSchema();
    const r = await getPool().query(`SELECT nombre, partes, updated_at FROM evaluacion_induccion WHERE id = 1`);
    return NextResponse.json({ ok: true, ...(r.rows[0] || { nombre: null, partes: 0, updated_at: null }) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el video." }, { status: 500 });
  }
}

// POST → { indice, total, nombre, contenido }  (se envía parte por parte; la parte 0 reemplaza el video anterior)
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { indice, total, nombre, contenido } = await req.json();
    const i = Number(indice);
    const t = Number(total);
    if (!Number.isInteger(t) || t < 1 || t > MAX_PARTES || !Number.isInteger(i) || i < 0 || i >= t) {
      return NextResponse.json({ error: "Partes de video no válidas." }, { status: 400 });
    }
    if (typeof contenido !== "string" || !contenido || contenido.length > VIDEO_TAM_PARTE || !BASE64.test(contenido)) {
      return NextResponse.json({ error: "Contenido de video no válido." }, { status: 400 });
    }
    const pool = getPool();
    if (i === 0) {
      await pool.query(`DELETE FROM evaluacion_induccion_partes`);
      await pool.query(
        `INSERT INTO evaluacion_induccion (id, nombre, partes, updated_at) VALUES (1, $1, 0, now())
         ON CONFLICT (id) DO UPDATE SET nombre = EXCLUDED.nombre, partes = 0, updated_at = now()`,
        [typeof nombre === "string" ? nombre.slice(0, 180) : "induccion.mp4"]
      );
    }
    await pool.query(
      `INSERT INTO evaluacion_induccion_partes (indice, contenido) VALUES ($1,$2)
       ON CONFLICT (indice) DO UPDATE SET contenido = EXCLUDED.contenido`,
      [i, contenido]
    );
    if (i === t - 1) await pool.query(`UPDATE evaluacion_induccion SET partes = $1, updated_at = now() WHERE id = 1`, [t]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar el video." }, { status: 500 });
  }
}
