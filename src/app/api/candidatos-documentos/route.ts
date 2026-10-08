import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { verificarTokenSesion, COOKIE_SESION } from "@/lib/sesion";
import { documentosRequeridos } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Registros del enlace general de documentos — PRIVADO, solo sysadmin (además del middleware).
// GET              → lista de registros con avance
// GET ?id=X        → { registro, requeridos, archivos (sin contenido) }
// GET ?archivo=N   → { nombre, mime, contenido }
// POST { accion: "eliminar_archivo", archivoId } | { accion: "eliminar", id }
async function esSysadmin(req: NextRequest) {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  return s?.rol === "sysadmin";
}

export async function GET(req: NextRequest) {
  try {
    if (!(await esSysadmin(req))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    await ensureSchema();
    const pool = getPool();
    const sp = req.nextUrl.searchParams;
    const archivo = sp.get("archivo");
    if (archivo !== null) {
      const r = await pool.query(`SELECT id, tipo, nombre, mime, contenido FROM candidato_registro_documentos WHERE id = $1`, [Number(archivo)]);
      if (!r.rows.length) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true, ...r.rows[0] });
    }
    const id = sp.get("id");
    if (id !== null) {
      const reg = await pool.query(`SELECT id, nombre, puesto, token, created_at FROM candidato_registros WHERE id = $1`, [Number(id)]);
      if (!reg.rows.length) return NextResponse.json({ error: "Registro no encontrado." }, { status: 404 });
      const a = await pool.query(`SELECT id, tipo, nombre, mime, created_at FROM candidato_registro_documentos WHERE registro_id = $1 ORDER BY id`, [Number(id)]);
      return NextResponse.json({ ok: true, registro: reg.rows[0], requeridos: documentosRequeridos(reg.rows[0].puesto), archivos: a.rows });
    }
    const r = await pool.query(`
      SELECT c.id, c.nombre, c.puesto, c.created_at,
             COALESCE(array_agg(DISTINCT d.tipo) FILTER (WHERE d.tipo IS NOT NULL), '{}') AS tipos,
             MAX(d.created_at) AS ultima_carga
      FROM candidato_registros c
      LEFT JOIN candidato_registro_documentos d ON d.registro_id = c.id
      GROUP BY c.id ORDER BY c.created_at DESC`);
    const registros = r.rows.map((x: any) => {
      const req = documentosRequeridos(x.puesto);
      const cargados = req.filter((d) => (x.tipos as string[]).includes(d.id)).length;
      return { id: x.id, nombre: x.nombre, puesto: x.puesto, created_at: x.created_at, ultima_carga: x.ultima_carga, cargados, total: req.length };
    });
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los registros." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!(await esSysadmin(req))) return NextResponse.json({ error: "No autorizado." }, { status: 403 });
    await ensureSchema();
    const b = await req.json();
    const pool = getPool();
    if (b.accion === "eliminar_archivo") {
      await pool.query(`DELETE FROM candidato_registro_documentos WHERE id = $1`, [Number(b.archivoId)]);
      return NextResponse.json({ ok: true });
    }
    if (b.accion === "eliminar") {
      await pool.query(`DELETE FROM candidato_registros WHERE id = $1`, [Number(b.id)]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo completar la acción." }, { status: 500 });
  }
}
