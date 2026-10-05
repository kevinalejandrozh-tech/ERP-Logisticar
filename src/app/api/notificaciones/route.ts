import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { describirAccion, ensureActividadSchema, sesionDeRequest } from "@/lib/actividadDB";
import { ensureNotasSchema } from "@/lib/notasDB";
import { puedeVerSeccion } from "@/lib/permisos";

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
    // Notas vencidas del usuario (se muestran hasta marcarlas como terminadas).
    let vencidas: typeof items = [];
    if (puedeVerSeccion("notas", sesion.rol, sesion.secciones)) {
      try {
        await ensureNotasSchema();
        const n = await p.query(`SELECT n.id, n.titulo, n.vence_en FROM notas n WHERE (n.usuario_id = $1 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $1)) AND NOT n.terminada AND n.vence_en IS NOT NULL AND n.vence_en <= now() ORDER BY n.vence_en LIMIT 10`, [sesion.userId]);
        vencidas = n.rows.map((r) => ({ id: -Number(r.id), usuario: "Recordatorio", accion: `Nota vencida: ${r.titulo}`, pagina: "/notas", paginaTitulo: "Notas", veces: 1, fecha: r.vence_en, nueva: true }));
      } catch {
        /* sin tabla de notas aún */
      }
    }
    return NextResponse.json({ ok: true, noLeidas: (conteo.rows[0]?.n ?? 0) + vencidas.length, items: [...vencidas, ...items] });
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
