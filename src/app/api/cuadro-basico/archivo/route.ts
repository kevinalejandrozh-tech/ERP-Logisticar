import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Archivo adjunto por fila del Cuadro Básico (Word, PDF o Excel), guardado como data URI en base64.
const MIMES_PERMITIDOS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_NOMBRE = 180;
// ~4.5 MB decodificados, acorde al límite de body de las funciones serverless.
const MAX_CONTENIDO_LEN = 6_000_000;

function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// GET /api/cuadro-basico/archivo?id=X → { ok, nombreArchivo, mime, contenido }
export async function GET(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    const r = await getPool().query(`SELECT nombre_archivo, mime, contenido FROM cuadro_basico_archivos WHERE cuadro_id = $1`, [id]);
    if (r.rowCount === 0) return NextResponse.json({ error: "Esta fila no tiene archivo." }, { status: 404 });
    const f = r.rows[0];
    return NextResponse.json({ ok: true, nombreArchivo: f.nombre_archivo, mime: f.mime, contenido: f.contenido }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al leer el archivo.") }, { status: 500 });
  }
}

// POST /api/cuadro-basico/archivo  body: { id, nombreArchivo, contenido (data URI) } — reemplaza el anterior.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    const contenido = typeof body?.contenido === "string" ? body.contenido.trim() : "";
    const coincide = /^data:([^;,]+);base64,/.exec(contenido);
    const mime = coincide?.[1] || "";
    if (!MIMES_PERMITIDOS.includes(mime)) {
      return NextResponse.json({ error: "Solo se permiten archivos Word, PDF o Excel." }, { status: 400 });
    }
    if (contenido.length > MAX_CONTENIDO_LEN) {
      return NextResponse.json({ error: "El archivo es demasiado grande (máx. ~4 MB)." }, { status: 413 });
    }
    const nombreArchivo = typeof body?.nombreArchivo === "string" && body.nombreArchivo.trim() ? body.nombreArchivo.trim().slice(0, MAX_NOMBRE) : "archivo";

    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;

    await ensureSchema();
    const pool = getPool();
    const existe = await pool.query(`SELECT 1 FROM cuadro_basico WHERE id = $1`, [id]);
    if (existe.rowCount === 0) return NextResponse.json({ error: "La fila no existe." }, { status: 404 });
    await pool.query(
      `INSERT INTO cuadro_basico_archivos (cuadro_id, nombre_archivo, mime, contenido, cargado_por, fecha_carga)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (cuadro_id) DO UPDATE SET nombre_archivo = EXCLUDED.nombre_archivo, mime = EXCLUDED.mime,
         contenido = EXCLUDED.contenido, cargado_por = EXCLUDED.cargado_por, fecha_carga = now()`,
      [id, nombreArchivo, mime, contenido, sesion?.nombre || null]
    );
    return NextResponse.json({ ok: true, nombreArchivo, mime });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al guardar el archivo.") }, { status: 500 });
  }
}

// DELETE /api/cuadro-basico/archivo?id=X
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    await getPool().query(`DELETE FROM cuadro_basico_archivos WHERE cuadro_id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al eliminar el archivo.") }, { status: 500 });
  }
}
