import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureSitioSchema, errorSitio, sesionSysadmin } from "@/lib/sitioDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const RE_CORREO = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[A-Za-z]{2,24}$/;

// Público: suscripción al boletín desde el sitio web.
export async function POST(req: NextRequest) {
  try {
    const cuerpo = (await req.json().catch(() => null)) as { correo?: unknown; sitio?: unknown } | null;
    // Campo trampa: los formularios llenados por bots lo completan; se responde ok sin guardar.
    if (typeof cuerpo?.sitio === "string" && cuerpo.sitio.trim() !== "") return NextResponse.json({ ok: true });
    const correo = typeof cuerpo?.correo === "string" ? cuerpo.correo.trim().toLowerCase() : "";
    if (!RE_CORREO.test(correo)) return NextResponse.json({ error: "Escribe un correo válido, por ejemplo nombre@empresa.com." }, { status: 400 });
    await ensureSitioSchema();
    await getPool().query(`INSERT INTO sitio_suscriptores (correo) VALUES ($1) ON CONFLICT (correo) DO NOTHING`, [correo]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorSitio(err, "No se pudo registrar la suscripción.");
  }
}

// Solo sysadmin: lista de suscriptores.
export async function GET(req: NextRequest) {
  const s = await sesionSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureSitioSchema();
    const r = await getPool().query(
      `SELECT id, correo, to_char(created_at AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD HH24:MI') AS fecha
       FROM sitio_suscriptores ORDER BY created_at DESC`
    );
    return NextResponse.json({ ok: true, suscriptores: r.rows });
  } catch (err) {
    return errorSitio(err, "No se pudo leer la lista de suscriptores.");
  }
}

// Solo sysadmin: elimina un suscriptor.
export async function DELETE(req: NextRequest) {
  const s = await sesionSysadmin(req);
  if (s instanceof NextResponse) return s;
  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Suscriptor no válido." }, { status: 400 });
  try {
    await ensureSitioSchema();
    await getPool().query(`DELETE FROM sitio_suscriptores WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorSitio(err, "No se pudo eliminar el suscriptor.");
  }
}
