import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { nombre } = await req.json();
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre de la columna." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM reporte_columnas`);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(`INSERT INTO reporte_columnas (nombre, orden) VALUES ($1, $2) RETURNING id`, [nombre.trim(), orden]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear la columna." }, { status: 500 });
  }
}
