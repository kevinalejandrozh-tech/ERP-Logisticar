import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, opciones, updated_at FROM menu_dia_opciones ORDER BY id DESC LIMIT 1`);
    if (result.rows.length === 0) {
      return NextResponse.json({ ok: true, opciones: [], actualizado: null });
    }
    return NextResponse.json({ ok: true, opciones: result.rows[0].opciones || [], actualizado: result.rows[0].updated_at });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el menú del día." }, { status: 500 });
  }
}

// Guarda un nuevo menú del día. Esto reinicia el tablero: se borran las opciones
// anteriores y todos los pedidos registrados, dejando espacio para la nueva jornada.
export async function POST(req: NextRequest) {
  try {
    const { opciones } = await req.json();
    const limpias = (Array.isArray(opciones) ? opciones : []).map((o: string) => String(o || "").trim()).filter(Boolean);
    if (limpias.length === 0) {
      return NextResponse.json({ error: "Captura al menos una opción de menú." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM menu_dia_pedidos`);
    await pool.query(`DELETE FROM menu_dia_opciones`);
    await pool.query(`INSERT INTO menu_dia_opciones (opciones) VALUES ($1::jsonb)`, [JSON.stringify(limpias)]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el menú del día." }, { status: 500 });
  }
}
