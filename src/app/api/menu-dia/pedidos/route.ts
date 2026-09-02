import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, pedido, created_at FROM menu_dia_pedidos ORDER BY created_at ASC`);
    const registros = result.rows.map((r) => ({ id: r.id, nombre: r.nombre, pedido: r.pedido, fecha: r.created_at }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los pedidos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { nombre, pedido } = await req.json();
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    }
    if (!pedido || !String(pedido).trim()) {
      return NextResponse.json({ error: "Selecciona una opción de menú." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`INSERT INTO menu_dia_pedidos (nombre, pedido) VALUES ($1,$2) RETURNING id`, [String(nombre).trim(), String(pedido).trim()]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al enviar el pedido." }, { status: 500 });
  }
}
