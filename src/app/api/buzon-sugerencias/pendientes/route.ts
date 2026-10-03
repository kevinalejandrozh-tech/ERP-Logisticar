import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { sesionDeRequest } from "@/lib/actividadDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: cuántas sugerencias llegaron después de la última vez que el usuario abrió el Buzón.
export async function GET(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT COUNT(*)::int AS n FROM buzon_sugerencias s
       WHERE s.created_at > COALESCE((SELECT visto_hasta FROM buzon_vistas WHERE usuario_id = $1), '-infinity'::timestamptz)`,
      [sesion.userId]
    );
    return NextResponse.json({ ok: true, nuevas: r.rows[0]?.n ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al leer el buzón." }, { status: 500 });
  }
}

// POST: marca el Buzón como visto por el usuario en sesión.
export async function POST(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureSchema();
    await getPool().query(
      `INSERT INTO buzon_vistas (usuario_id, visto_hasta) VALUES ($1, now()) ON CONFLICT (usuario_id) DO UPDATE SET visto_hasta = now()`,
      [sesion.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al marcar el buzón." }, { status: 500 });
  }
}
