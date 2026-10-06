import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";
import { puedeAutorizarOC, sesionCompras } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";

// POST { folio, razon } — rechaza la OC completa (todos sus artículos quedan rechazados con esa razón).
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const sesion = await sesionCompras(req);
    if (!sesion || !(await puedeAutorizarOC(sesion.rol))) return NextResponse.json({ error: "No tienes permiso para rechazar órdenes de compra." }, { status: 403 });
    const { folio, razon } = await req.json();
    const motivo = String(razon || "").trim().slice(0, 500);
    if (!folio) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
    if (!motivo) return NextResponse.json({ error: "Escribe la razón del rechazo." }, { status: 400 });
    const pool = getPool();
    const r = await pool.query(`SELECT id, estado, productos FROM ordenes_compra WHERE folio = $1 ORDER BY id DESC LIMIT 1`, [folio]);
    if (!r.rowCount) return NextResponse.json({ error: "La orden no existe." }, { status: 404 });
    if (r.rows[0].estado !== "Pendiente de autorización") return NextResponse.json({ error: `La orden ya fue atendida (${r.rows[0].estado}).` }, { status: 409 });
    const actuales: Record<string, unknown>[] = Array.isArray(r.rows[0].productos) ? r.rows[0].productos : [];
    const finales = actuales.map((p) => ({ ...p, autorizado: false, decision: "rechazado", razon: motivo, indicaciones: null, fechaProgramada: null }));
    await pool.query(`UPDATE ordenes_compra SET productos = $2, estado = 'Rechazada', autorizado_por = $3, autorizado_en = now() WHERE id = $1`, [r.rows[0].id, JSON.stringify(finales), sesion.nombre]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al rechazar." }, { status: 400 });
  }
}
