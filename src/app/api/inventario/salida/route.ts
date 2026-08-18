import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { codigo, cantidad, folioServicio, paraUnidad, entregadoA, comentario } = await req.json();
    if (!codigo || !cantidad) {
      return NextResponse.json({ error: "Falta el código o la cantidad de la salida." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const item = await pool.query(`SELECT id, descripcion, cantidad FROM inventario_items WHERE codigo = $1`, [codigo]);
    if (item.rows.length === 0) {
      return NextResponse.json({ error: `No se encontró el artículo con código ${codigo}.` }, { status: 404 });
    }

    await pool.query(`UPDATE inventario_items SET cantidad = cantidad - $2, updated_at = now() WHERE codigo = $1`, [codigo, cantidad]);

    await pool.query(
      `INSERT INTO inventario_movimientos (tipo, codigo, descripcion, cantidad, datos) VALUES ('salida', $1, $2, $3, $4::jsonb)`,
      [codigo, item.rows[0].descripcion, cantidad, JSON.stringify({ folioServicio, paraUnidad, entregadoA, comentario })]
    );

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al registrar la salida." }, { status: 500 });
  }
}
