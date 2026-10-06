import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";
import { puedeAutorizarOC, sesionCompras } from "@/lib/comprasDB";
import { DISPERSIONES, MEDIOS_PAGO } from "@/lib/comprasData";

export const dynamic = "force-dynamic";

// POST { folio, productos } — autoriza la OC. Cada producto trae `autorizado`; los no autorizados
// deben traer decision "rechazado" (+ razon) o "programado" (+ indicaciones y fechaProgramada).
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const sesion = await sesionCompras(req);
    if (!sesion || !(await puedeAutorizarOC(sesion.rol))) {
      return NextResponse.json({ error: "No tienes permiso para autorizar órdenes de compra." }, { status: 403 });
    }
    const { folio, productos, datos } = await req.json();
    if (!folio || !Array.isArray(productos)) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });

    const pool = getPool();
    const r = await pool.query(`SELECT id, estado, productos FROM ordenes_compra WHERE folio = $1 ORDER BY id DESC LIMIT 1`, [folio]);
    if (!r.rowCount) return NextResponse.json({ error: "La orden no existe." }, { status: 404 });
    if (r.rows[0].estado !== "Pendiente de autorización") return NextResponse.json({ error: `La orden ya fue atendida (${r.rows[0].estado}).` }, { status: 409 });
    const actuales: any[] = Array.isArray(r.rows[0].productos) ? r.rows[0].productos : [];
    if (actuales.length !== productos.length) return NextResponse.json({ error: "La lista de productos no coincide con la orden." }, { status: 400 });

    // Lo que define quien autoriza: medio de pago, dispersión de recursos y, si los ajustó, combustible y viáticos.
    const medioPago = String(datos?.medioPago || "");
    const dispersion = String(datos?.dispersion || "");
    if (!MEDIOS_PAGO.includes(medioPago)) throw new Error("Selecciona el medio de pago.");
    if (!DISPERSIONES.includes(dispersion)) throw new Error("Selecciona la dispersión de recursos.");
    const cambios: Record<string, unknown> = { medioPago, dispersion, dispersionDetalle: String(datos?.dispersionDetalle || "").trim().slice(0, 300) };
    if (datos && datos.combustible !== undefined) cambios.combustible = Math.max(0, Number(datos.combustible) || 0);
    if (Array.isArray(datos?.viaticos)) {
      cambios.viaticos = datos.viaticos
        .map((v: { concepto?: unknown; monto?: unknown }) => ({ concepto: String(v?.concepto || "").trim().slice(0, 120), monto: Math.max(0, Number(v?.monto) || 0) }))
        .filter((v: { concepto: string; monto: number }) => v.concepto || v.monto)
        .slice(0, 30);
    }

    const finales = actuales.map((p, i) => {
      const d = productos[i] || {};
      const autorizado = d.autorizado !== false;
      if (autorizado) return { ...p, autorizado: true, decision: null, razon: null, indicaciones: null, fechaProgramada: null };
      const decision = d.decision === "programado" ? "programado" : "rechazado";
      if (decision === "rechazado" && !String(d.razon || "").trim()) throw new Error(`Falta la razón del rechazo de "${p.articulo}".`);
      if (decision === "programado" && (!String(d.indicaciones || "").trim() || !d.fechaProgramada)) {
        throw new Error(`Faltan indicaciones o fecha programada de "${p.articulo}".`);
      }
      return {
        ...p,
        autorizado: false,
        decision,
        razon: decision === "rechazado" ? String(d.razon).trim() : null,
        indicaciones: decision === "programado" ? String(d.indicaciones).trim() : null,
        fechaProgramada: decision === "programado" ? String(d.fechaProgramada) : null,
      };
    });
    const total = finales.filter((p) => p.autorizado).reduce((a, p) => a + (Number(p.totalProducto) || 0), 0);
    await pool.query(
      `UPDATE ordenes_compra SET productos = $2, total_general = $3, estado = 'Autorizada', autorizado_por = $4, autorizado_en = now(), datos = COALESCE(datos, '{}'::jsonb) || $5::jsonb WHERE id = $1`,
      [r.rows[0].id, JSON.stringify(finales), total, sesion.nombre, JSON.stringify(cambios)]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al autorizar." }, { status: 400 });
  }
}
