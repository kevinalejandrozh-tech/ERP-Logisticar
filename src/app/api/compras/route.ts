import { NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const pool = getPool();

    const body = await req.json();
    const { folio, fecha, numProveedores, totalGeneral, productos } = body;

    if (!folio || !productos || !Array.isArray(productos)) {
      return NextResponse.json(
        { error: "El folio y la lista de productos son obligatorios." },
        { status: 400 }
      );
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Insertar orden de compra principal
      await client.query(
        `INSERT INTO ordenes_compra (folio, fecha, num_proveedores, total_general, productos, estado)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          folio,
          fecha || new Date().toISOString(),
          numProveedores || 0,
          totalGeneral || 0,
          JSON.stringify(productos),
          "pendiente",
        ]
      );

      // 2. Insertar desglose de cada producto
      for (const prod of productos) {
        await client.query(
          `INSERT INTO productos_orden_compra 
           (orden_folio, cantidad, articulo, precio_unitario, total_producto, proveedores)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            folio,
            prod.cantidad,
            prod.articulo,
            prod.precioUnitario,
            prod.totalProducto,
            JSON.stringify(prod.proveedores || []),
          ]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json(
        { success: true, message: "Orden de compra guardada con éxito", folio },
        { status: 201 }
      );
    } catch (dbError) {
      await client.query("ROLLBACK");
      throw dbError;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error("Error en POST /api/compras:", error);
    return NextResponse.json(
      { error: "Error al registrar la orden de compra", details: error.message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM ordenes_compra ORDER BY created_at DESC`
    );

    return NextResponse.json(result.rows);
  } catch (error: any) {
    console.error("Error en GET /api/compras:", error);
    return NextResponse.json(
      { error: "Error al obtener las órdenes de compra", details: error.message },
      { status: 500 }
    );
  }
}