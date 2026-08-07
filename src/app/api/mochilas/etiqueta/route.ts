import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { folio, unidad, responsable } = await req.json();
    if (!folio) {
      return NextResponse.json({ error: "Falta el folio de la mochila." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE mochilas SET unidad = $2, responsable = $3, updated_at = now() WHERE folio = $1 RETURNING folio`,
      [folio, unidad || null, responsable || null]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la mochila." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la etiqueta." }, { status: 500 });
  }
}
