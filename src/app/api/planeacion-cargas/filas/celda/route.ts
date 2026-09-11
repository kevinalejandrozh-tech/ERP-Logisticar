import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { filaId, columnaId, valor } = await req.json();
    if (!filaId || !columnaId) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    await pool.query(`UPDATE planeacion_cargas_filas SET datos = jsonb_set(datos, $2, to_jsonb($3::text), true) WHERE id = $1`, [
      filaId,
      `{${columnaId}}`,
      valor || "",
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la celda." }, { status: 500 });
  }
}
