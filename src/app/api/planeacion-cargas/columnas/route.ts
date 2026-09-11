import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, nombre } = await req.json();
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre de la columna." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    if (id) {
      await pool.query(`UPDATE planeacion_cargas_columnas SET nombre = $2 WHERE id = $1`, [id, String(nombre).trim()]);
      return NextResponse.json({ ok: true, id });
    }
    const maxOrden = await pool.query(`SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM planeacion_cargas_columnas`);
    const result = await pool.query(`INSERT INTO planeacion_cargas_columnas (nombre, orden) VALUES ($1,$2) RETURNING id`, [
      String(nombre).trim(),
      maxOrden.rows[0].siguiente,
    ]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la columna." }, { status: 500 });
  }
}
