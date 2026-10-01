import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureRhDocumentosSchema, errorJson, limpiarCampos, sesionRh } from "@/lib/rhDocumentosDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MIMES = /^(application\/pdf|image\/(png|jpe?g|webp)|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;
const MAX_ARCHIVO = 4_200_000; // ~3 MB reales en base64

// GET: lista (sin archivo). ?id=X o ?ids=1,2,3 → con archivo (para imprimir).
export async function GET(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureRhDocumentosSchema();
    const pool = getPool();
    const id = Number(req.nextUrl.searchParams.get("id"));
    const ids = (req.nextUrl.searchParams.get("ids") || "").split(",").map(Number).filter(Boolean);
    if (id || ids.length) {
      const r = await pool.query(`SELECT id, nombre, archivo_nombre, mime, archivo, campos FROM rh_documentos WHERE id = ANY($1::int[])`, [id ? [id] : ids]);
      return NextResponse.json({ ok: true, documentos: r.rows });
    }
    const r = await pool.query(
      `SELECT id, nombre, archivo_nombre, mime, campos, length(archivo) AS tamano, to_char(updated_at, 'YYYY-MM-DD') AS actualizado FROM rh_documentos ORDER BY nombre ASC`
    );
    return NextResponse.json({ ok: true, documentos: r.rows });
  } catch (err) {
    return errorJson(err, "Error al leer los documentos.");
  }
}

function validar(b: Record<string, unknown>, requiereArchivo: boolean) {
  const nombre = String(b.nombre || "").trim().slice(0, 150);
  if (!nombre) return { error: "Indica el nombre del documento." };
  const archivo = b.archivo ? String(b.archivo) : "";
  const mime = String(b.mime || "");
  if (requiereArchivo && !archivo) return { error: "Adjunta el documento." };
  if (archivo) {
    if (!MIMES.test(mime)) return { error: "Formato no permitido. Usa PDF, imagen (PNG/JPG) o Word (.docx)." };
    if (archivo.length > MAX_ARCHIVO) return { error: "El archivo es muy grande (máximo 3 MB)." };
  }
  return { nombre, archivo, mime, archivo_nombre: String(b.archivo_nombre || "documento").slice(0, 200), campos: limpiarCampos(b.campos) };
}

export async function POST(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    const v = validar(await req.json(), true);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    await ensureRhDocumentosSchema();
    const r = await getPool().query(
      `INSERT INTO rh_documentos (nombre, archivo_nombre, mime, archivo, campos, registrado_por) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [v.nombre, v.archivo_nombre, v.mime, v.archivo, JSON.stringify(v.campos), s.nombre]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    return errorJson(err, "Error al guardar el documento.");
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.id);
    if (!id) return NextResponse.json({ error: "Falta el documento." }, { status: 400 });
    const v = validar(b, false);
    if ("error" in v) return NextResponse.json({ error: v.error }, { status: 400 });
    await ensureRhDocumentosSchema();
    const pool = getPool();
    if (v.archivo) {
      await pool.query(
        `UPDATE rh_documentos SET nombre = $2, archivo_nombre = $3, mime = $4, archivo = $5, campos = $6, updated_at = now() WHERE id = $1`,
        [id, v.nombre, v.archivo_nombre, v.mime, v.archivo, JSON.stringify(v.campos)]
      );
    } else {
      await pool.query(`UPDATE rh_documentos SET nombre = $2, campos = $3, updated_at = now() WHERE id = $1`, [id, v.nombre, JSON.stringify(v.campos)]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al guardar el documento.");
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el documento." }, { status: 400 });
    await ensureRhDocumentosSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM rh_documentos WHERE id = $1`, [id]);
    // Se quita de los grupos que lo incluían.
    await pool.query(
      `UPDATE rh_documentos_grupos SET documento_ids = COALESCE((SELECT jsonb_agg(x) FROM jsonb_array_elements(documento_ids) x WHERE x::int != $1), '[]'::jsonb) WHERE documento_ids @> to_jsonb(ARRAY[$1::int])`,
      [id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al eliminar el documento.");
  }
}
