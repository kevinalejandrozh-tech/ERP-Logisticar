import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT DISTINCT ON (eco_unidad) id, folio, eco_unidad, descripcion_unidad, placas, fecha_hora, checklist
       FROM checklist_unidades
       ORDER BY eco_unidad, fecha_hora DESC`
    );
    return NextResponse.json({ ok: true, registros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al generar el reporte." }, { status: 500 });
  }
}
