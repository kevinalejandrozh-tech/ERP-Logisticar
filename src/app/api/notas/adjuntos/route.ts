import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { MIMES_NOTAS, ensureNotasSchema, puedeAccederNota, sesionNotas } from "@/lib/notasDB";

export const dynamic = "force-dynamic";
const MAX = 6_000_000; // ~4.5 MB decodificados (límite de las funciones serverless)

// Dueño o usuario con quien se compartió la nota.
const esMia = puedeAccederNota;

// GET ?id= — contenido de un adjunto de una nota propia o compartida.
export async function GET(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  await ensureNotasSchema();
  const r = await getPool().query(
    `SELECT a.nombre, a.mime, a.contenido FROM notas_adjuntos a JOIN notas n ON n.id = a.nota_id WHERE a.id = $1 AND (n.usuario_id = $2 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $2))`,
    [Number(req.nextUrl.searchParams.get("id")), s.userId]
  );
  if (!r.rowCount) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true, ...r.rows[0] });
}

// POST { nota_id, nombre, contenido (data URI) , leyenda } · PUT { id, leyenda } · DELETE ?id=
export async function POST(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const contenido = String(b?.contenido || "");
    const mime = /^data:([^;,]+);base64,/.exec(contenido)?.[1] || "";
    if (!(mime.startsWith("image/") || MIMES_NOTAS.includes(mime))) return NextResponse.json({ error: "Tipo de archivo no permitido." }, { status: 400 });
    if (contenido.length > MAX) return NextResponse.json({ error: "El archivo es demasiado grande (máx. ~4 MB)." }, { status: 413 });
    await ensureNotasSchema();
    if (!(await esMia(Number(b?.nota_id), s.userId))) return NextResponse.json({ error: "La nota no existe." }, { status: 404 });
    const r = await getPool().query(`INSERT INTO notas_adjuntos (nota_id, nombre, mime, contenido, leyenda) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
      Number(b.nota_id),
      String(b?.nombre || "archivo").slice(0, 180),
      mime,
      contenido,
      String(b?.leyenda || "").slice(0, 500) || null,
    ]);
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al adjuntar." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  await ensureNotasSchema();
  await getPool().query(`UPDATE notas_adjuntos a SET leyenda = $3 FROM notas n WHERE a.id = $1 AND n.id = a.nota_id AND (n.usuario_id = $2 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $2))`, [Number(b?.id), s.userId, String(b?.leyenda || "").slice(0, 500) || null]);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  await ensureNotasSchema();
  await getPool().query(`DELETE FROM notas_adjuntos a USING notas n WHERE a.id = $1 AND n.id = a.nota_id AND (n.usuario_id = $2 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $2))`, [Number(req.nextUrl.searchParams.get("id")), s.userId]);
  return NextResponse.json({ ok: true });
}
