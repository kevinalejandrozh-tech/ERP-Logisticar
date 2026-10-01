import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ensureSchema, getPool } from "@/lib/db";
import { documentosRequeridos } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Documentación del candidato — PRIVADO (requiere sesión).
// GET ?id=X        → { token, requeridos, archivos (sin contenido) }
// GET ?archivo=N   → { nombre, mime, contenido }   (uno por petición, por el límite de respuesta de Vercel)
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const pool = getPool();
    const archivo = req.nextUrl.searchParams.get("archivo");
    if (archivo !== null) {
      const r = await pool.query(`SELECT id, tipo, nombre, mime, contenido FROM evaluacion_documentos WHERE id = $1`, [Number(archivo)]);
      if (!r.rows.length) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true, ...r.rows[0] });
    }
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id no válido." }, { status: 400 });
    const ev = await pool.query(`SELECT puesto, doc_token FROM evaluaciones_candidatos WHERE id = $1`, [id]);
    if (!ev.rows.length) return NextResponse.json({ error: "Evaluación no encontrada." }, { status: 404 });
    const a = await pool.query(`SELECT id, tipo, nombre, mime, created_at FROM evaluacion_documentos WHERE evaluacion_id = $1 ORDER BY id`, [id]);
    return NextResponse.json({ ok: true, token: ev.rows[0].doc_token, requeridos: documentosRequeridos(ev.rows[0].puesto), archivos: a.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la documentación." }, { status: 500 });
  }
}

// POST { accion: "enlace", id }           → crea (si no existe) y devuelve el token del enlace del candidato
// POST { accion: "eliminar", archivoId }  → quita un archivo
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const b = await req.json();
    const pool = getPool();
    if (b.accion === "eliminar") {
      await pool.query(`DELETE FROM evaluacion_documentos WHERE id = $1`, [Number(b.archivoId)]);
      return NextResponse.json({ ok: true });
    }
    const id = Number(b.id);
    if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Id no válido." }, { status: 400 });
    await pool.query(`UPDATE evaluaciones_candidatos SET doc_token = $2 WHERE id = $1 AND doc_token IS NULL`, [id, randomBytes(24).toString("hex")]);
    const r = await pool.query(`SELECT doc_token FROM evaluaciones_candidatos WHERE id = $1`, [id]);
    if (!r.rows.length) return NextResponse.json({ error: "Evaluación no encontrada." }, { status: 404 });
    return NextResponse.json({ ok: true, token: r.rows[0].doc_token });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo generar el enlace." }, { status: 500 });
  }
}
