import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";
import { sesionCompras } from "@/lib/comprasDB";
import { ensureNotasSchema, puedeAccederNota } from "@/lib/notasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// POST: registra la OC en estado "Pendiente de autorización" (botón "Solicitar autorización").
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const sesion = await sesionCompras(req);
    const body = await req.json();
    const { folio, fecha, productos, datos } = body || {};
    // OC generada desde una nota: solo se vincula si el usuario tiene acceso a esa nota.
    let notaId: number | null = null;
    if (Number(body?.notaId) > 0 && sesion) {
      await ensureNotasSchema();
      if (await puedeAccederNota(Number(body.notaId), sesion.userId)) notaId = Number(body.notaId);
    }
    if (!folio || !Array.isArray(productos) || productos.length === 0) {
      return NextResponse.json({ error: "El folio y la lista de productos son obligatorios." }, { status: 400 });
    }
    const limpios = productos.map((p: any) => {
      const cantidad = num(p.cantidad);
      const precioUnitario = num(p.precioUnitario);
      return {
        cantidad,
        articulo: String(p.articulo || "").trim(),
        precioUnitario,
        totalProducto: cantidad * precioUnitario,
        referencia: String(p.referencia || "").trim(),
        proveedor: String(p.proveedor || "").trim(),
        proveedores: p.proveedor ? [String(p.proveedor).trim()] : [],
        compraUnica: p.compraUnica === true,
        // Foto de referencia (tomada o insertada): imagen comprimida en el navegador.
        foto: typeof p.foto === "string" && /^data:image\/(jpeg|png|webp);base64,/.test(p.foto) && p.foto.length < 600_000 ? p.foto : "",
        autorizado: true,
      };
    });
    const total = limpios.reduce((a: number, p: any) => a + p.totalProducto, 0);
    const numProv = new Set(limpios.map((p: any) => p.proveedor).filter(Boolean)).size;

    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO ordenes_compra (folio, fecha, num_proveedores, total_general, productos, estado, datos, solicitado_por, nota_id)
         VALUES ($1, $2, $3, $4, $5, 'Pendiente de autorización', $6, $7, $8)`,
        [folio, fecha || new Date().toISOString(), numProv, total, JSON.stringify(limpios), JSON.stringify(datos || {}), sesion?.nombre || null, notaId]
      );
      for (const p of limpios) {
        await client.query(
          `INSERT INTO productos_orden_compra (orden_folio, cantidad, articulo, precio_unitario, total_producto, proveedores)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [folio, p.cantidad, p.articulo, p.precioUnitario, p.totalProducto, JSON.stringify(p.proveedores)]
        );
      }
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
    return NextResponse.json({ success: true, folio }, { status: 201 });
  } catch (error: any) {
    console.error("Error en POST /api/compras:", error);
    return NextResponse.json({ error: "Error al registrar la orden de compra", details: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    await ensureSchema();
    const result = await getPool().query(`SELECT * FROM ordenes_compra ORDER BY created_at DESC`);
    // Las fotos de referencia no viajan en el listado (pesan): se piden aparte en /api/compras/fotos.
    const rows = result.rows.map((o) => ({
      ...o,
      productos: Array.isArray(o.productos) ? o.productos.map(({ foto, ...resto }: { foto?: string; [k: string]: unknown }) => ({ ...resto, tieneFoto: !!foto })) : o.productos,
    }));
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error("Error en GET /api/compras:", error);
    return NextResponse.json({ error: "Error al obtener las órdenes de compra", details: error.message }, { status: 500 });
  }
}
