import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, comentario, created_at FROM buzon_sugerencias ORDER BY created_at DESC`);
    const registros = result.rows.map((r) => ({ id: r.id, nombre: r.nombre || "Anónimo", comentario: r.comentario, fecha: r.created_at }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las sugerencias." }, { status: 500 });
  }
}
