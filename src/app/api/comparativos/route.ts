import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { titulo, descripcion, columnas, modo } = await req.json();
    if (!titulo || !String(titulo).trim()) {
      return NextResponse.json({ error: "Falta el título del comparativo." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM comparativos`);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(
      `INSERT INTO comparativos (titulo, descripcion, columnas, modo, orden) VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING id`,
      [titulo.trim(), descripcion || "", JSON.stringify(columnas || []), modo === "antesDespues" ? "antesDespues" : "reporte", orden]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear el comparativo." }, { status: 500 });
  }
}
