import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, columna, valor } = await req.json();
    if (!id || !columna) {
      return NextResponse.json({ error: "Faltan datos de la celda." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(
      `UPDATE reporte_filas SET datos = jsonb_set(datos, ARRAY[$2::text], to_jsonb($3::text), true), updated_at = now() WHERE id = $1`,
      [id, columna, valor ?? ""]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la celda." }, { status: 500 });
  }
}
