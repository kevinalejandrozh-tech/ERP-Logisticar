import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Documentos PDF por unidad: independientes del checklist/revisión rápida (unidades_revisiones).
// Se guardan uno por (eco, tipo) y se reemplazan al subir un archivo nuevo; no vencen ni se
// piden de nuevo al guardar una revisión.
const TIPOS_DOCUMENTO = ["tarjeta_circulacion", "poliza_seguro", "verificacion"] as const;
type TipoDocumento = (typeof TIPOS_DOCUMENTO)[number];

const MAX_NOMBRE = 180;
// Tope de seguridad sobre el data URI en base64 (~4.5 MB decodificados), acorde al límite
// de tamaño de body que aceptan las funciones serverless de Vercel.
const MAX_CONTENIDO_LEN = 6_000_000;

function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

function esTipoValido(valor: unknown): valor is TipoDocumento {
  return typeof valor === "string" && (TIPOS_DOCUMENTO as readonly string[]).includes(valor);
}

// GET /api/unidades/documentos?eco=ECO-15
// → { ok: true, documentos: { tarjeta_circulacion: { nombre_archivo, fecha_carga, cargado_por }, ... } }
// Solo metadatos (sin el contenido en base64) para no cargar los PDFs completos al seleccionar la unidad.
export async function GET(req: NextRequest) {
  try {
    const eco = req.nextUrl.searchParams.get("eco")?.trim();
    if (!eco) {
      return NextResponse.json({ error: "Falta el parámetro eco." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT tipo, nombre_archivo, cargado_por, fecha_carga FROM unidades_documentos WHERE eco = $1`,
      [eco]
    );
    const documentos: Record<string, { nombre_archivo: string | null; cargado_por: string | null; fecha_carga: string }> = {};
    for (const fila of result.rows) {
      documentos[fila.tipo] = { nombre_archivo: fila.nombre_archivo, cargado_por: fila.cargado_por, fecha_carga: fila.fecha_carga };
    }
    return NextResponse.json({ ok: true, eco, documentos }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al leer los documentos de la unidad.") }, { status: 500 });
  }
}

// POST /api/unidades/documentos  body: { eco, tipo, nombreArchivo, contenido }
// contenido: data URI completo ("data:application/pdf;base64,...."). Reemplaza el documento
// anterior de ese (eco, tipo) si ya existía. Quien lo sube se toma de la sesión.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eco = typeof body?.eco === "string" ? body.eco.trim() : "";
    if (!eco) {
      return NextResponse.json({ error: "Falta el campo eco." }, { status: 400 });
    }
    if (!esTipoValido(body?.tipo)) {
      return NextResponse.json({ error: "El tipo de documento no es válido." }, { status: 400 });
    }
    const contenido = typeof body?.contenido === "string" ? body.contenido.trim() : "";
    if (!contenido.startsWith("data:application/pdf;base64,")) {
      return NextResponse.json({ error: "El archivo debe ser un PDF." }, { status: 400 });
    }
    if (contenido.length > MAX_CONTENIDO_LEN) {
      return NextResponse.json({ error: "El PDF es demasiado grande. Reduce su tamaño e intenta de nuevo (máx. ~4 MB)." }, { status: 413 });
    }
    const nombreArchivo =
      typeof body?.nombreArchivo === "string" && body.nombreArchivo.trim() ? body.nombreArchivo.trim().slice(0, MAX_NOMBRE) : "documento.pdf";

    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    const cargadoPor = sesion?.nombre || null;

    await ensureSchema();
    const pool = getPool();
    const existeUnidad = await pool.query(`SELECT 1 FROM unidades WHERE eco = $1`, [eco]);
    if (existeUnidad.rowCount === 0) {
      return NextResponse.json({ error: `No existe la unidad ${eco}.` }, { status: 404 });
    }
    const result = await pool.query(
      `INSERT INTO unidades_documentos (eco, tipo, nombre_archivo, contenido, cargado_por, fecha_carga)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (eco, tipo)
       DO UPDATE SET nombre_archivo = EXCLUDED.nombre_archivo, contenido = EXCLUDED.contenido, cargado_por = EXCLUDED.cargado_por, fecha_carga = now()
       RETURNING tipo, nombre_archivo, cargado_por, fecha_carga`,
      [eco, body.tipo, nombreArchivo, contenido, cargadoPor]
    );
    return NextResponse.json({ ok: true, documento: result.rows[0] });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al guardar el documento.") }, { status: 500 });
  }
}

// DELETE /api/unidades/documentos?eco=ECO-15&tipo=poliza_seguro  (solo sysadmin)
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    if (!tienePermisosAdmin(sesion?.rol)) {
      return NextResponse.json({ error: "No tienes permisos para eliminar documentos." }, { status: 403 });
    }
    const eco = req.nextUrl.searchParams.get("eco")?.trim();
    const tipo = req.nextUrl.searchParams.get("tipo")?.trim();
    if (!eco || !esTipoValido(tipo)) {
      return NextResponse.json({ error: "Faltan parámetros válidos (eco, tipo)." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM unidades_documentos WHERE eco = $1 AND tipo = $2 RETURNING tipo`, [eco, tipo]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Ese documento no existe." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al eliminar el documento.") }, { status: 500 });
  }
}