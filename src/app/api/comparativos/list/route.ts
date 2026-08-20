import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, titulo, descripcion, columnas FROM comparativos ORDER BY orden DESC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      titulo: r.titulo || "",
      descripcion: r.descripcion || "",
      columnas: r.columnas || [],
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los comparativos." }, { status: 500 });
  }
}
