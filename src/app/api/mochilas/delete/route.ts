import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { folio } = await req.json();
    if (!folio) {
      return NextResponse.json({ error: "Falta el folio de la mochila." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM mochilas WHERE folio = $1 RETURNING folio`, [folio]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la mochila." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar la mochila." }, { status: 500 });
  }
}
