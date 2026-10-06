import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNotasSchema, sesionNotas } from "@/lib/notasDB";

export const dynamic = "force-dynamic";

const limpiar = (v: unknown) => String(v || "").replace(/\s+/g, " ").trim().slice(0, 60);

// Carpetas personales de notas: cada usuario organiza las suyas (también las notas compartidas con él).
// POST { nombre } crea · PUT { id, nombre } renombra · DELETE ?id= elimina (las notas NO se borran, vuelven a "Sin carpeta").
export async function POST(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const nombre = limpiar((await req.json())?.nombre);
    if (!nombre) return NextResponse.json({ error: "Escribe el nombre de la carpeta." }, { status: 400 });
    await ensureNotasSchema();
    const dup = await getPool().query(`SELECT 1 FROM notas_carpetas WHERE usuario_id = $1 AND LOWER(nombre) = LOWER($2)`, [s.userId, nombre]);
    if (dup.rowCount) return NextResponse.json({ error: "Ya tienes una carpeta con ese nombre." }, { status: 409 });
    const r = await getPool().query(`INSERT INTO notas_carpetas (usuario_id, nombre) VALUES ($1, $2) RETURNING id`, [s.userId, nombre]);
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear la carpeta." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const nombre = limpiar(b?.nombre);
    if (!nombre) return NextResponse.json({ error: "Escribe el nombre de la carpeta." }, { status: 400 });
    await ensureNotasSchema();
    const dup = await getPool().query(`SELECT 1 FROM notas_carpetas WHERE usuario_id = $1 AND LOWER(nombre) = LOWER($2) AND id <> $3`, [s.userId, nombre, Number(b?.id)]);
    if (dup.rowCount) return NextResponse.json({ error: "Ya tienes una carpeta con ese nombre." }, { status: 409 });
    await getPool().query(`UPDATE notas_carpetas SET nombre = $3 WHERE id = $1 AND usuario_id = $2`, [Number(b?.id), s.userId, nombre]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al renombrar." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    await ensureNotasSchema();
    const p = getPool();
    await p.query(`UPDATE notas_usuario SET carpeta_id = NULL WHERE usuario_id = $1 AND carpeta_id = $2`, [s.userId, id]);
    await p.query(`DELETE FROM notas_carpetas WHERE id = $1 AND usuario_id = $2`, [id, s.userId]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al eliminar la carpeta." }, { status: 500 });
  }
}
