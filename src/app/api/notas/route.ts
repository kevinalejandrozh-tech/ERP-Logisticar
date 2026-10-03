import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNotasSchema, limpiarHtml, sesionNotas } from "@/lib/notasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: mis notas (con adjuntos sin contenido). ?vencidas=1 → solo las vencidas no terminadas.
export async function GET(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNotasSchema();
    const p = getPool();
    if (req.nextUrl.searchParams.get("vencidas") === "1") {
      const r = await p.query(`SELECT id, titulo, vence_en FROM notas WHERE usuario_id = $1 AND NOT terminada AND vence_en IS NOT NULL AND vence_en <= now() ORDER BY vence_en`, [s.userId]);
      return NextResponse.json({ ok: true, vencidas: r.rows });
    }
    const r = await p.query(
      `SELECT n.*, COALESCE(json_agg(json_build_object('id', a.id, 'nombre', a.nombre, 'mime', a.mime, 'leyenda', a.leyenda) ORDER BY a.id) FILTER (WHERE a.id IS NOT NULL), '[]') AS adjuntos
       FROM notas n LEFT JOIN notas_adjuntos a ON a.nota_id = n.id WHERE n.usuario_id = $1 GROUP BY n.id
       ORDER BY n.terminada, n.importante DESC, n.updated_at DESC`,
      [s.userId]
    );
    return NextResponse.json({ ok: true, notas: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer notas." }, { status: 500 });
  }
}

// POST { id?, titulo, contenido, importante, vence_en, terminada } — crea o actualiza (solo notas propias).
export async function POST(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const titulo = String(b?.titulo || "").trim().slice(0, 200) || "Sin título";
    const contenido = limpiarHtml(String(b?.contenido || ""));
    const vence = b?.vence_en ? new Date(b.vence_en) : null;
    const venceIso = vence && !isNaN(vence.getTime()) ? vence.toISOString() : null;
    await ensureNotasSchema();
    const p = getPool();
    if (Number(b?.id)) {
      const r = await p.query(
        `UPDATE notas SET titulo = $3, contenido = $4, importante = $5, vence_en = $6, terminada = $7, updated_at = now() WHERE id = $1 AND usuario_id = $2 RETURNING id`,
        [Number(b.id), s.userId, titulo, contenido, b?.importante === true, venceIso, b?.terminada === true]
      );
      if (!r.rowCount) return NextResponse.json({ error: "La nota no existe." }, { status: 404 });
      return NextResponse.json({ ok: true, id: r.rows[0].id });
    }
    const r = await p.query(`INSERT INTO notas (usuario_id, titulo, contenido, importante, vence_en) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [s.userId, titulo, contenido, b?.importante === true, venceIso]);
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar la nota." }, { status: 500 });
  }
}

// DELETE ?id= — elimina la nota y sus adjuntos (libera el espacio).
export async function DELETE(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNotasSchema();
    await getPool().query(`DELETE FROM notas WHERE id = $1 AND usuario_id = $2`, [Number(req.nextUrl.searchParams.get("id")), s.userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al eliminar." }, { status: 500 });
  }
}
