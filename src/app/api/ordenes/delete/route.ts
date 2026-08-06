import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { folio } = await req.json();
    if (!folio) {
      return NextResponse.json({ error: "Falta el folio de la orden." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM ordenes_servicio WHERE folio = $1 RETURNING folio`, [folio]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la orden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar la orden." }, { status: 500 });
  }
}
