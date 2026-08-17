import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    let result = await pool.query(`SELECT id, datos FROM organigrama ORDER BY id ASC LIMIT 1`);
    if (result.rows.length === 0) {
      result = await pool.query(`INSERT INTO organigrama (datos) VALUES ('{"cajas":[],"textos":[],"lineas":[]}'::jsonb) RETURNING id, datos`);
    }
    return NextResponse.json({ ok: true, datos: result.rows[0].datos });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el organigrama." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { datos } = await req.json();
    await ensureSchema();
    const pool = getPool();
    const existente = await pool.query(`SELECT id FROM organigrama ORDER BY id ASC LIMIT 1`);
    if (existente.rows.length === 0) {
      await pool.query(`INSERT INTO organigrama (datos) VALUES ($1::jsonb)`, [JSON.stringify(datos)]);
    } else {
      await pool.query(`UPDATE organigrama SET datos = $2::jsonb, updated_at = now() WHERE id = $1`, [existente.rows[0].id, JSON.stringify(datos)]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el organigrama." }, { status: 500 });
  }
}
