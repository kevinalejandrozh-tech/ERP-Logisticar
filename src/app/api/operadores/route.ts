import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { id, nombre, fechaIngreso } = await req.json();
    if (!nombre || !String(nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre del operador." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    if (id) {
      const result = await pool.query(
        `UPDATE operadores SET nombre = $2, fecha_ingreso = $3, updated_at = now() WHERE id = $1 RETURNING id`,
        [id, nombre.trim(), fechaIngreso || null]
      );
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "No se encontró el operador." }, { status: 404 });
      }
    } else {
      await pool.query(`INSERT INTO operadores (nombre, fecha_ingreso) VALUES ($1, $2)`, [nombre.trim(), fechaIngreso || null]);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el operador." }, { status: 500 });
  }
}
