import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const columnas = await pool.query(`SELECT id, nombre, orden FROM planeacion_cargas_columnas ORDER BY orden ASC, id ASC`);
    const filas = await pool.query(`SELECT id, datos, orden FROM planeacion_cargas_filas ORDER BY orden ASC, id ASC`);
    return NextResponse.json({ ok: true, columnas: columnas.rows, filas: filas.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la tabla." }, { status: 500 });
  }
}
