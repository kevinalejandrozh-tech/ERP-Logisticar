import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensurePersonalizacionSchema, sesionDe } from "@/lib/personalizacionDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Botones agregados al inicio en modo edición (llevan a un módulo vacío /modulo/[slug]).
export async function GET(req: NextRequest) {
  try {
    await ensurePersonalizacionSchema();
    const slug = req.nextUrl.searchParams.get("slug");
    const r = slug
      ? await getPool().query(`SELECT * FROM inicio_botones WHERE slug = $1`, [slug])
      : await getPool().query(`SELECT * FROM inicio_botones ORDER BY orden, id`);
    return NextResponse.json({ ok: true, botones: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionDe(req);
  if (s?.rol !== "sysadmin") return NextResponse.json({ error: "Solo el sysadmin puede agregar botones." }, { status: 403 });
  try {
    const b = await req.json();
    const titulo = String(b?.titulo || "").trim().slice(0, 80);
    if (!titulo) return NextResponse.json({ error: "Escribe el nombre del botón." }, { status: 400 });
    await ensurePersonalizacionSchema();
    const base = titulo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "modulo";
    const p = getPool();
    let slug = base;
    for (let i = 2; (await p.query(`SELECT 1 FROM inicio_botones WHERE slug = $1`, [slug])).rowCount; i++) slug = `${base}-${i}`;
    const orden = (await p.query(`SELECT COALESCE(MAX(orden), 0) + 1 AS o FROM inicio_botones`)).rows[0].o;
    await p.query(`INSERT INTO inicio_botones (slug, titulo, descripcion, orden) VALUES ($1, $2, $3, $4)`, [slug, titulo, String(b?.descripcion || "").trim().slice(0, 200) || null, orden]);
    return NextResponse.json({ ok: true, slug });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const s = await sesionDe(req);
  if (s?.rol !== "sysadmin") return NextResponse.json({ error: "Solo el sysadmin." }, { status: 403 });
  await ensurePersonalizacionSchema();
  await getPool().query(`DELETE FROM inicio_botones WHERE id = $1`, [Number(req.nextUrl.searchParams.get("id"))]);
  return NextResponse.json({ ok: true });
}
