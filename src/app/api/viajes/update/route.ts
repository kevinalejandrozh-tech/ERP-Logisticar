import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, campos } = await req.json();
    if (!id || !campos) {
      return NextResponse.json({ error: "Faltan datos para actualizar el viaje." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE viajes SET datos = datos || $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id, datos`,
      [id, JSON.stringify(campos)]
    );
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró el viaje." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, viaje: { id: result.rows[0].id, ...result.rows[0].datos } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el viaje." }, { status: 500 });
  }
}
