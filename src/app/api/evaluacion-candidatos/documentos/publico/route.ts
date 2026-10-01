import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { documentosRequeridos, DOC_MAX_ARCHIVOS, DOC_MAX_BYTES_PDF } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// API PÚBLICA para que el candidato cargue su documentación. Solo funciona con el token del enlace
// (nunca con el id), y solo permite ver nombres de sus propios archivos, subir y quitar.
const TOKEN = /^[a-f0-9]{48}$/;
const MIMES = ["application/pdf", "image/jpeg", "image/png"];
const BASE64 = /^[A-Za-z0-9+/=]+$/;
const MAX_CHARS = Math.ceil((DOC_MAX_BYTES_PDF * 4) / 3) + 8;

async function evaluacionPorToken(t: unknown) {
  if (typeof t !== "string" || !TOKEN.test(t)) return null;
  const r = await getPool().query(`SELECT id, nombre, puesto FROM evaluaciones_candidatos WHERE doc_token = $1`, [t]);
  return r.rows[0] || null;
}

// GET ?t=token → { nombre, puesto, requeridos, archivos }
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const ev = await evaluacionPorToken(req.nextUrl.searchParams.get("t"));
    if (!ev) return NextResponse.json({ error: "El enlace no es válido o ya no está disponible." }, { status: 404 });
    const a = await getPool().query(`SELECT id, tipo, nombre, mime FROM evaluacion_documentos WHERE evaluacion_id = $1 ORDER BY id`, [ev.id]);
    return NextResponse.json({ ok: true, nombre: String(ev.nombre).split(" ")[0], puesto: ev.puesto, requeridos: documentosRequeridos(ev.puesto), archivos: a.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la documentación." }, { status: 500 });
  }
}

// POST { t, tipo, nombre, mime, contenido }            → sube un archivo
// POST { t, accion: "eliminar", archivoId }            → quita un archivo propio
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const b = await req.json();
    const ev = await evaluacionPorToken(b.t);
    if (!ev) return NextResponse.json({ error: "El enlace no es válido o ya no está disponible." }, { status: 404 });
    const pool = getPool();

    if (b.accion === "eliminar") {
      await pool.query(`DELETE FROM evaluacion_documentos WHERE id = $1 AND evaluacion_id = $2`, [Number(b.archivoId), ev.id]);
      return NextResponse.json({ ok: true });
    }

    const tipo = String(b.tipo || "");
    if (!documentosRequeridos(ev.puesto).some((d) => d.id === tipo)) return NextResponse.json({ error: "Documento no válido." }, { status: 400 });
    if (!MIMES.includes(b.mime)) return NextResponse.json({ error: "Solo se aceptan archivos PDF o fotografías." }, { status: 400 });
    if (typeof b.contenido !== "string" || !b.contenido || b.contenido.length > MAX_CHARS || !BASE64.test(b.contenido)) {
      return NextResponse.json({ error: "El archivo no es válido o es demasiado grande (máximo 3 MB)." }, { status: 400 });
    }
    const n = await pool.query(`SELECT COUNT(*)::int AS n FROM evaluacion_documentos WHERE evaluacion_id = $1 AND tipo = $2`, [ev.id, tipo]);
    if (n.rows[0].n >= DOC_MAX_ARCHIVOS) return NextResponse.json({ error: `Máximo ${DOC_MAX_ARCHIVOS} archivos por documento.` }, { status: 400 });
    const r = await pool.query(
      `INSERT INTO evaluacion_documentos (evaluacion_id, tipo, nombre, mime, contenido) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [ev.id, tipo, typeof b.nombre === "string" ? b.nombre.slice(0, 150) : null, b.mime, b.contenido]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar el archivo." }, { status: 500 });
  }
}
