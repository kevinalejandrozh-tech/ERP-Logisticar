import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del operador." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM operadores WHERE id = $1 RETURNING id`, [id]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró el operador." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar el operador." }, { status: 500 });
  }
}
