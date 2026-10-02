import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureRhDocumentosSchema, errorJson, sesionRh } from "@/lib/rhDocumentosDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function leer(b: Record<string, unknown>) {
  const nombre = String(b.nombre || "").trim().slice(0, 120);
  const ids = Array.from(new Set((Array.isArray(b.documento_ids) ? b.documento_ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 50);
  return { nombre, ids };
}

export async function GET(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureRhDocumentosSchema();
    const r = await getPool().query(`SELECT id, nombre, documento_ids FROM rh_documentos_grupos ORDER BY nombre ASC`);
    return NextResponse.json({ ok: true, grupos: r.rows });
  } catch (err) {
    return errorJson(err, "Error al leer los grupos.");
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    const d = leer(await req.json());
    if (!d.nombre || !d.ids.length) return NextResponse.json({ error: "Indica el nombre del grupo y selecciona al menos un documento." }, { status: 400 });
    await ensureRhDocumentosSchema();
    const r = await getPool().query(`INSERT INTO rh_documentos_grupos (nombre, documento_ids) VALUES ($1, $2) RETURNING id`, [d.nombre, JSON.stringify(d.ids)]);
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    return errorJson(err, "Error al guardar el grupo.");
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.id);
    const d = leer(b);
    if (!id || !d.nombre || !d.ids.length) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    await ensureRhDocumentosSchema();
    await getPool().query(`UPDATE rh_documentos_grupos SET nombre = $2, documento_ids = $3, updated_at = now() WHERE id = $1`, [id, d.nombre, JSON.stringify(d.ids)]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al guardar el grupo.");
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionRh(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta el grupo." }, { status: 400 });
    await ensureRhDocumentosSchema();
    await getPool().query(`DELETE FROM rh_documentos_grupos WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al eliminar el grupo.");
  }
}
