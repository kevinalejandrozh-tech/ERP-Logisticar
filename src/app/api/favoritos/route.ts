import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureActividadSchema, sesionDeRequest } from "@/lib/actividadDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Favoritos (accesos directos) de cada usuario.
export async function GET(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureActividadSchema();
    const r = await getPool().query(`SELECT ruta, titulo FROM favoritos_usuarios WHERE usuario_id = $1 ORDER BY created_at`, [sesion.userId]);
    return NextResponse.json({ ok: true, favoritos: r.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al leer favoritos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const ruta = String(body.ruta || "").trim().slice(0, 300);
    const titulo = String(body.titulo || "").trim().slice(0, 120) || ruta;
    if (!ruta.startsWith("/") || ruta.startsWith("//")) return NextResponse.json({ error: "Ruta no válida." }, { status: 400 });
    await ensureActividadSchema();
    await getPool().query(
      `INSERT INTO favoritos_usuarios (usuario_id, ruta, titulo) VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, ruta) DO UPDATE SET titulo = EXCLUDED.titulo`,
      [sesion.userId, ruta, titulo]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al guardar favorito." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const ruta = String(req.nextUrl.searchParams.get("ruta") || "");
    await ensureActividadSchema();
    await getPool().query(`DELETE FROM favoritos_usuarios WHERE usuario_id = $1 AND ruta = $2`, [sesion.userId, ruta]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al quitar favorito." }, { status: 500 });
  }
}
