import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { describirAccion, ensureActividadSchema, sesionDeRequest } from "@/lib/actividadDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: movimientos recientes hechos por OTROS usuarios + cuántos no ha visto el usuario en sesión.
export async function GET(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureActividadSchema();
    const p = getPool();
    const visto = await p.query(`SELECT visto_hasta FROM notificaciones_vistas WHERE usuario_id = $1`, [sesion.userId]);
    const vistoHasta: string | null = visto.rows[0]?.visto_hasta ?? null;
    const lista = await p.query(
      `SELECT id, usuario_nombre, metodo, api, pagina, pagina_titulo, veces, updated_at
       FROM actividad_usuarios WHERE usuario_id <> $1 ORDER BY updated_at DESC LIMIT 40`,
      [sesion.userId]
    );
    const conteo = await p.query(
      `SELECT COUNT(*)::int AS n FROM actividad_usuarios WHERE usuario_id <> $1 AND ($2::timestamptz IS NULL OR updated_at > $2::timestamptz)`,
      [sesion.userId, vistoHasta]
    );
    const items = lista.rows.map((r) => ({
      id: r.id,
      usuario: r.usuario_nombre,
      accion: describirAccion(r.metodo, r.api),
      pagina: r.pagina,
      paginaTitulo: r.pagina_titulo,
      veces: r.veces,
      fecha: r.updated_at,
      nueva: !vistoHasta || new Date(r.updated_at) > new Date(vistoHasta),
    }));
    return NextResponse.json({ ok: true, noLeidas: conteo.rows[0]?.n ?? 0, items });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al leer notificaciones." }, { status: 500 });
  }
}

// POST: marca todas como vistas.
export async function POST(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureActividadSchema();
    await getPool().query(
      `INSERT INTO notificaciones_vistas (usuario_id, visto_hasta) VALUES ($1, now())
       ON CONFLICT (usuario_id) DO UPDATE SET visto_hasta = now()`,
      [sesion.userId]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al marcar notificaciones." }, { status: 500 });
  }
}
