import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { historialId, folioServicio, ecoUnidad, items } = await req.json();
    if (!historialId) {
      return NextResponse.json({ error: "Falta el registro de historial relacionado." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const existente = await pool.query(`SELECT id FROM solicitudes_material WHERE historial_id = $1`, [historialId]);
    if (existente.rows.length > 0) {
      await pool.query(
        `UPDATE solicitudes_material SET folio_servicio = $2, eco_unidad = $3, items = $4::jsonb, updated_at = now() WHERE historial_id = $1`,
        [historialId, folioServicio || "", ecoUnidad || "", JSON.stringify(items || [])]
      );
      return NextResponse.json({ ok: true, id: existente.rows[0].id });
    }
    const result = await pool.query(
      `INSERT INTO solicitudes_material (historial_id, folio_servicio, eco_unidad, items) VALUES ($1,$2,$3,$4::jsonb) RETURNING id`,
      [historialId, folioServicio || "", ecoUnidad || "", JSON.stringify(items || [])]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la solicitud de material." }, { status: 500 });
  }
}
