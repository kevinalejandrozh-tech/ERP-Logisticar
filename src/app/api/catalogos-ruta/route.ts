import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureCatalogosRutaSchema, sesionCatalogo } from "@/lib/catalogosRutaDB";
import { CATALOGOS, MIMES_DOC, TIPOS_UNIDAD_CASETA, type CampoCat } from "@/lib/catalogosRutaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_ADJUNTO = 6_000_000; // ~4.5 MB (límite de las funciones serverless)

// Limpia los datos según la definición del catálogo (solo claves conocidas).
function limpiar(campos: CampoCat[], datos: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const c of campos) {
    const v = datos?.[c.clave];
    if (c.tipo === "numero") out[c.clave] = v === "" || v == null ? null : Math.max(0, Number(v) || 0);
    else if (c.tipo === "si_no") out[c.clave] = v === true || v === "si";
    else if (c.tipo === "costos_unidad") {
      const m: Record<string, number> = {};
      for (const t of TIPOS_UNIDAD_CASETA) m[t] = Math.max(0, Number((v as Record<string, unknown>)?.[t]) || 0);
      out[c.clave] = m;
    } else out[c.clave] = String(v ?? "").trim().slice(0, c.tipo === "area" ? 4000 : 300);
  }
  return out;
}

// GET ?tipo=X → lista (sin adjuntos). GET ?tipo=X&id=N → registro con adjunto.
export async function GET(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get("tipo") || "";
  const s = await sesionCatalogo(req, tipo);
  if (s instanceof NextResponse) return s;
  try {
    await ensureCatalogosRutaSchema();
    const id = Number(req.nextUrl.searchParams.get("id"));
    const p = getPool();
    if (id) {
      const r = await p.query(`SELECT id, nombre, datos, adjunto, adjunto_nombre, activo FROM catalogos_ruta WHERE id = $1 AND tipo = $2`, [id, tipo]);
      if (!r.rowCount) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
      return NextResponse.json({ ok: true, registro: r.rows[0] });
    }
    const r = await p.query(
      `SELECT id, nombre, datos, (adjunto IS NOT NULL) AS tiene_adjunto, adjunto_nombre, activo, updated_at FROM catalogos_ruta WHERE tipo = $1 ORDER BY activo DESC, nombre`,
      [tipo]
    );
    return NextResponse.json({ ok: true, registros: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer el catálogo." }, { status: 500 });
  }
}

// POST (alta) y PUT (edición): { tipo, id?, nombre, datos, activo, adjunto?, adjunto_nombre?, quitar_adjunto? }
async function guardar(req: NextRequest, alta: boolean) {
  const b = await req.json().catch(() => ({}));
  const tipo = String(b?.tipo || "");
  const s = await sesionCatalogo(req, tipo);
  if (s instanceof NextResponse) return s;
  const def = CATALOGOS[tipo];
  try {
    const nombre = String(b?.nombre || "").trim().slice(0, 200);
    if (!nombre) return NextResponse.json({ error: `Escribe: ${def.campoNombre}.` }, { status: 400 });
    const datos = limpiar(def.campos, b?.datos || {});
    for (const c of def.campos) {
      if (c.requerido && !datos[c.clave]) return NextResponse.json({ error: `Falta: ${c.etiqueta}.` }, { status: 400 });
    }
    let adjunto: string | null | undefined;
    if (def.adjunto && typeof b?.adjunto === "string" && b.adjunto) {
      const mime = /^data:([^;,]+);base64,/.exec(b.adjunto)?.[1] || "";
      const ok = def.adjunto.tipo === "imagen" ? mime.startsWith("image/") : mime.startsWith("image/") || MIMES_DOC.includes(mime);
      if (!ok) return NextResponse.json({ error: "Tipo de archivo no permitido." }, { status: 400 });
      if (b.adjunto.length > MAX_ADJUNTO) return NextResponse.json({ error: "El archivo es demasiado grande (máx. ~4 MB)." }, { status: 413 });
      adjunto = b.adjunto;
    } else if (b?.quitar_adjunto === true) adjunto = null;
    const adjuntoNombre = adjunto ? String(b?.adjunto_nombre || "archivo").slice(0, 180) : null;
    await ensureCatalogosRutaSchema();
    const p = getPool();
    if (alta) {
      const r = await p.query(
        `INSERT INTO catalogos_ruta (tipo, nombre, datos, adjunto, adjunto_nombre, activo, creado_por) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [tipo, nombre, JSON.stringify(datos), adjunto ?? null, adjuntoNombre, b?.activo !== false, s.nombre]
      );
      return NextResponse.json({ ok: true, id: r.rows[0].id });
    }
    const id = Number(b?.id);
    if (!id) return NextResponse.json({ error: "Falta el registro." }, { status: 400 });
    const r = await p.query(
      `UPDATE catalogos_ruta SET nombre = $3, datos = $4, activo = $5, updated_at = now(),
         adjunto = CASE WHEN $6::boolean THEN $7 ELSE adjunto END, adjunto_nombre = CASE WHEN $6::boolean THEN $8 ELSE adjunto_nombre END
       WHERE id = $1 AND tipo = $2 RETURNING id`,
      [id, tipo, nombre, JSON.stringify(datos), b?.activo !== false, adjunto !== undefined, adjunto ?? null, adjuntoNombre]
    );
    if (!r.rowCount) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar." }, { status: 500 });
  }
}
export const POST = (req: NextRequest) => guardar(req, true);
export const PUT = (req: NextRequest) => guardar(req, false);

export async function DELETE(req: NextRequest) {
  const tipo = req.nextUrl.searchParams.get("tipo") || "";
  const s = await sesionCatalogo(req, tipo);
  if (s instanceof NextResponse) return s;
  await ensureCatalogosRutaSchema();
  await getPool().query(`DELETE FROM catalogos_ruta WHERE id = $1 AND tipo = $2`, [Number(req.nextUrl.searchParams.get("id")), tipo]);
  return NextResponse.json({ ok: true });
}
