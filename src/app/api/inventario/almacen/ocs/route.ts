import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// OC para "Recibir OC": folio, referencia, estatus y artículos autorizados con lo pendiente por recibir.
export async function GET() {
  try {
    await ensureAlmacenSchema();
    const r = await getPool().query(`SELECT folio, fecha, estado, productos, created_at FROM ordenes_compra ORDER BY created_at DESC LIMIT 200`);
    const ocs = r.rows.map((o) => {
      const productos: any[] = Array.isArray(o.productos) ? o.productos : [];
      const items = productos
        .map((p, i) => ({ indice: i, articulo: p.articulo, cantidad: Number(p.cantidad) || 0, recibido: Number(p.recibido) || 0, precioUnitario: Number(p.precioUnitario) || 0, proveedor: p.proveedor ?? p.proveedores?.[0] ?? "", referencia: p.referencia || "", autorizado: p.autorizado !== false }))
        .filter((p) => p.autorizado);
      const estado = String(o.estado || "");
      return {
        folio: o.folio,
        fecha: o.fecha || o.created_at,
        estado,
        referencia: [...new Set(productos.map((p) => p.referencia).filter(Boolean))].join(", "),
        recibible: ["autorizada", "parcialmente recibida"].includes(estado.toLowerCase()),
        items: items.map((p) => ({ ...p, pendiente: Math.max(0, p.cantidad - p.recibido) })),
      };
    });
    return NextResponse.json({ ok: true, ocs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer las OC." }, { status: 500 });
  }
}
