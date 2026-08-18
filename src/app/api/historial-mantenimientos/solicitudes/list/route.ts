import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, historial_id, folio_servicio, eco_unidad, items, estado, created_at FROM solicitudes_material ORDER BY created_at DESC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      historialId: r.historial_id,
      folioServicio: r.folio_servicio || "",
      ecoUnidad: r.eco_unidad || "",
      items: r.items || [],
      estado: r.estado || "pendiente",
      creadoEn: r.created_at,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las solicitudes de material." }, { status: 500 });
  }
}
