import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensurePersonalizacionSchema, sesionDe } from "@/lib/personalizacionDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET ?pagina=/ruta — textos personalizados de la página (los ven todos los usuarios).
export async function GET(req: NextRequest) {
  try {
    await ensurePersonalizacionSchema();
    const pagina = req.nextUrl.searchParams.get("pagina") || "/";
    const r = await getPool().query(`SELECT original, texto FROM textos_personalizados WHERE pagina = $1`, [pagina]);
    return NextResponse.json({ ok: true, textos: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

// POST { pagina, original, texto } — solo sysadmin. Texto vacío = restablecer el original.
export async function POST(req: NextRequest) {
  const s = await sesionDe(req);
  if (s?.rol !== "sysadmin") return NextResponse.json({ error: "Solo el sysadmin puede editar textos." }, { status: 403 });
  try {
    const b = await req.json();
    const pagina = String(b?.pagina || "").slice(0, 300);
    const original = String(b?.original || "").trim().slice(0, 1000);
    const texto = String(b?.texto || "").trim().slice(0, 1000);
    if (!pagina || !original) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    await ensurePersonalizacionSchema();
    const p = getPool();
    if (!texto || texto === original) await p.query(`DELETE FROM textos_personalizados WHERE pagina = $1 AND original = $2`, [pagina, original]);
    else
      await p.query(
        `INSERT INTO textos_personalizados (pagina, original, texto, actualizado_por) VALUES ($1, $2, $3, $4)
         ON CONFLICT (pagina, original) DO UPDATE SET texto = EXCLUDED.texto, actualizado_por = EXCLUDED.actualizado_por, updated_at = now()`,
        [pagina, original, texto, s.nombre]
      );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}
