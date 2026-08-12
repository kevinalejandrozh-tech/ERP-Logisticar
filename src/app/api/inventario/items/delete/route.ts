import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del artículo." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM inventario_items WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró el artículo." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar el artículo." }, { status: 500 });
  }
}
