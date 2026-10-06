import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { describirAccion, ensureActividadSchema, sesionDeRequest } from "@/lib/actividadDB";
import { ensureNotasSchema } from "@/lib/notasDB";
import { puedeVerSeccion } from "@/lib/permisos";
import { PREFIJOS_SIN_NOTIFICACION } from "@/lib/actividadReglas";
import { NOVEDADES } from "@/lib/novedades";
import { OPCIONES_NOTIF_MAX, leerPreferencia } from "@/lib/sistemaDB";
import { puedeAutorizarOC } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Item = {
  id: number;
  tipo: "actividad" | "aviso" | "novedad" | "vencida";
  usuario: string;
  accion: string;
  pagina: string;
  paginaTitulo: string;
  veces: number;
  fecha: string;
  nueva: boolean;
  detalle?: string[];
};

// GET: avisos para el usuario en sesión:
//  · cambios (altas, modificaciones y bajas) hechos por OTROS usuarios · avisos de Notas · resumen de cada actualización del sistema
// Se muestran como máximo las N más recientes (N lo elige el usuario en el engrane) y lo borrado no vuelve a aparecer.
export async function GET(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureActividadSchema();
    const p = getPool();
    const max = await leerPreferencia<number>(sesion.userId, "notif_max", 50);
    const limite = OPCIONES_NOTIF_MAX.includes(max) ? max : 50;
    const v = await p.query(`SELECT visto_hasta, borrado_hasta FROM notificaciones_vistas WHERE usuario_id = $1`, [sesion.userId]);
    const vistoHasta: string | null = v.rows[0]?.visto_hasta ?? null;
    const borradoHasta: string | null = v.rows[0]?.borrado_hasta ?? null;
    const patrones = PREFIJOS_SIN_NOTIFICACION.map((x) => `${x}%`);
    const lista = await p.query(
      `SELECT id, usuario_nombre, metodo, api, pagina, pagina_titulo, veces, updated_at
       FROM actividad_usuarios
       WHERE usuario_id <> $1 AND ($2::timestamptz IS NULL OR updated_at > $2::timestamptz) AND NOT (api LIKE ANY ($4::text[]))
       ORDER BY updated_at DESC LIMIT $3`,
      [sesion.userId, borradoHasta, limite, patrones]
    );
    const conteo = await p.query(
      `SELECT COUNT(*)::int AS n FROM actividad_usuarios
       WHERE usuario_id <> $1 AND ($2::timestamptz IS NULL OR updated_at > $2::timestamptz) AND ($3::timestamptz IS NULL OR updated_at > $3::timestamptz) AND NOT (api LIKE ANY ($4::text[]))`,
      [sesion.userId, vistoHasta, borradoHasta, patrones]
    );
    const esNueva = (f: string) => !vistoHasta || new Date(f) > new Date(vistoHasta);
    const items: Item[] = lista.rows.map((r) => ({
      id: r.id,
      tipo: "actividad",
      usuario: r.usuario_nombre,
      accion: describirAccion(r.metodo, r.api),
      pagina: r.pagina,
      paginaTitulo: r.pagina_titulo,
      veces: r.veces,
      fecha: r.updated_at,
      nueva: esNueva(r.updated_at),
    }));
    let nuevasExtra = 0;

    // Notas vencidas del usuario (se muestran hasta marcarlas como terminadas).
    const vencidas: Item[] = [];
    let avisos: Item[] = [];
    if (puedeVerSeccion("notas", sesion.rol, sesion.secciones)) {
      try {
        await ensureNotasSchema();
        const n = await p.query(`SELECT n.id, n.titulo, n.vence_en FROM notas n WHERE (n.usuario_id = $1 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $1)) AND NOT n.terminada AND n.vence_en IS NOT NULL AND n.vence_en <= now() ORDER BY n.vence_en LIMIT 10`, [sesion.userId]);
        n.rows.forEach((r) => vencidas.push({ id: -Number(r.id), tipo: "vencida", usuario: "Recordatorio", accion: `Nota vencida: ${r.titulo}`, pagina: "/notas", paginaTitulo: "Notas", veces: 1, fecha: r.vence_en, nueva: true }));
        const a = await p.query(`SELECT id, de, texto, creado_en FROM notas_avisos WHERE usuario_id = $1 AND ($2::timestamptz IS NULL OR creado_en > $2::timestamptz) ORDER BY creado_en DESC LIMIT $3`, [sesion.userId, borradoHasta, limite]);
        avisos = a.rows.map((r) => ({ id: 100_000_000 + Number(r.id), tipo: "aviso", usuario: r.de || "Notas", accion: r.texto, pagina: "/notas", paginaTitulo: "Notas", veces: 1, fecha: r.creado_en, nueva: esNueva(r.creado_en) }));
        nuevasExtra += avisos.filter((x) => x.nueva).length;
      } catch {
        /* sin tablas de notas aún */
      }
    }

    // Órdenes de compra por autorizar (solo para quien puede autorizar): permanecen hasta autorizarlas o rechazarlas.
    try {
      if (await puedeAutorizarOC(sesion.rol)) {
        const oc = await p.query(`SELECT id, folio, total_general, solicitado_por, created_at FROM ordenes_compra WHERE estado = 'Pendiente de autorización' ORDER BY created_at DESC LIMIT 10`);
        oc.rows.forEach((r) =>
          vencidas.push({ id: -(500_000_000 + Number(r.id)), tipo: "vencida", usuario: "Autorización", accion: `OC ${r.folio} de ${r.solicitado_por || "—"} por ${new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(r.total_general) || 0)} está pendiente`, pagina: `/compras?oc=${encodeURIComponent(r.folio)}`, paginaTitulo: "Compras", veces: 1, fecha: r.created_at, nueva: true })
        );
      }
    } catch {
      /* sin tabla de compras aún */
    }

    // Resumen de cada actualización del sistema (últimos 45 días).
    const corte = Date.now() - 45 * 86400000;
    const novedades: Item[] = NOVEDADES.filter((x) => new Date(x.fecha).getTime() > corte && (!borradoHasta || new Date(x.fecha) > new Date(borradoHasta))).map((x, i) => ({
      id: 200_000_000 + i,
      tipo: "novedad",
      usuario: "Sistema",
      accion: x.titulo,
      pagina: "/",
      paginaTitulo: "Actualización",
      veces: 1,
      fecha: x.fecha,
      nueva: esNueva(x.fecha),
      detalle: [x.resumen, ...x.detalles],
    }));
    nuevasExtra += novedades.filter((x) => x.nueva).length;

    const todos = [...vencidas, ...avisos, ...novedades, ...items]
      .sort((a, b) => (a.tipo === "vencida" ? -1 : b.tipo === "vencida" ? 1 : new Date(b.fecha).getTime() - new Date(a.fecha).getTime()))
      .slice(0, limite + vencidas.length);

    // Limpieza ligera de la bandeja compartida (conserva lo necesario según el mayor límite elegido).
    if (Math.random() < 0.05) {
      const tope = await p.query(`SELECT COALESCE(MAX((valor #>> '{}')::int), 50) AS m FROM usuario_preferencias WHERE clave = 'notif_max'`).catch(() => null);
      await p.query(`DELETE FROM actividad_usuarios WHERE id NOT IN (SELECT id FROM actividad_usuarios ORDER BY updated_at DESC LIMIT $1)`, [Math.max(50, Number(tope?.rows[0]?.m) || 50)]).catch(() => {});
    }
    return NextResponse.json({ ok: true, noLeidas: (conteo.rows[0]?.n ?? 0) + vencidas.length + nuevasExtra, limite, items: todos });
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

// DELETE: borra todas las notificaciones del usuario (solo su bandeja; las notas vencidas siguen hasta terminarlas).
export async function DELETE(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    await ensureActividadSchema();
    const p = getPool();
    await p.query(
      `INSERT INTO notificaciones_vistas (usuario_id, visto_hasta, borrado_hasta) VALUES ($1, now(), now())
       ON CONFLICT (usuario_id) DO UPDATE SET visto_hasta = now(), borrado_hasta = now()`,
      [sesion.userId]
    );
    await p.query(`DELETE FROM notas_avisos WHERE usuario_id = $1`, [sesion.userId]).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al borrar notificaciones." }, { status: 500 });
  }
}
