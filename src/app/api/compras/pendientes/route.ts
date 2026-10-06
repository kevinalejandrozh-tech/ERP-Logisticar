import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";
import { puedeAutorizarOC, sesionCompras } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET → OC en "Pendiente de autorización" para quien puede autorizar (alimenta el globo persistente junto a las notificaciones).
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const s = await sesionCompras(req);
    if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    if (!(await puedeAutorizarOC(s.rol))) return NextResponse.json({ ok: true, puede: false, ordenes: [] });
    const r = await getPool().query(
      `SELECT folio, fecha, total_general, productos, datos, solicitado_por FROM ordenes_compra WHERE estado = 'Pendiente de autorización' ORDER BY created_at ASC LIMIT 20`
    );
    const ordenes = r.rows.map((o) => ({
      folio: o.folio,
      fecha: o.fecha,
      total: (Number(o.total_general) || 0) + (Number(o.datos?.combustible) || 0) + (Array.isArray(o.datos?.viaticos) ? o.datos.viaticos : []).reduce((a: number, v: { monto?: number }) => a + (Number(v.monto) || 0), 0),
      titulo: o.datos?.titulo || "",
      solicitado_por: o.solicitado_por,
      justificacion: o.datos?.justificacion || "",
      articulos: (Array.isArray(o.productos) ? o.productos : []).map((p: { cantidad: number; articulo: string; proveedor?: string; totalProducto: number }) => ({ cantidad: p.cantidad, articulo: p.articulo, proveedor: p.proveedor || "", total: p.totalProducto })),
    }));
    return NextResponse.json({ ok: true, puede: true, ordenes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer las autorizaciones pendientes." }, { status: 500 });
  }
}
