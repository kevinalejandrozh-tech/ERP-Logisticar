import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { descripcion, cantidad, origen } = await req.json();
    if (!descripcion) {
      return NextResponse.json({ error: "Falta la descripción." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`INSERT INTO compras_pendientes (descripcion, cantidad, origen) VALUES ($1,$2,$3) RETURNING id`, [descripcion, cantidad || null, origen || ""]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al agregar a compras." }, { status: 500 });
  }
}
