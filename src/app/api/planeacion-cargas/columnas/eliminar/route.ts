import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM planeacion_cargas_columnas WHERE id = $1`, [id]);
    // Limpia también la celda correspondiente en cada fila
    const filas = await pool.query(`SELECT id, datos FROM planeacion_cargas_filas`);
    for (const f of filas.rows) {
      if (f.datos && Object.prototype.hasOwnProperty.call(f.datos, String(id))) {
        const nuevo = { ...f.datos };
        delete nuevo[String(id)];
        await pool.query(`UPDATE planeacion_cargas_filas SET datos = $2::jsonb WHERE id = $1`, [f.id, JSON.stringify(nuevo)]);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar la columna." }, { status: 500 });
  }
}
