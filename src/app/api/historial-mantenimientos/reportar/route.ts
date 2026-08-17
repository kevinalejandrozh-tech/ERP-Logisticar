import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { ecoUnidad, unidad, reportadoPor, reporteFalla, evidencias } = await req.json();
    if (!ecoUnidad || !reportadoPor || !reporteFalla) {
      return NextResponse.json({ error: "Faltan datos obligatorios del reporte." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '\\D', '', 'g'), '')::int), 0) AS maximo FROM historial_mantenimientos`
    );
    const folio = String((maxRes.rows[0]?.maximo || 0) + 1).padStart(4, "0");
    const hoy = new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `INSERT INTO historial_mantenimientos (estado, folio, eco_unidad, unidad, tipo_mantenimiento, reporte_falla, fecha_ingreso_taller, evidencias, reportado_por, orden)
       VALUES ('Por Revisar', $1, $2, $3, 'Correctivo', $4, $5, $6::jsonb, $7, (SELECT COALESCE(MAX(orden), -1) + 1 FROM historial_mantenimientos))
       RETURNING id, folio`,
      [folio, ecoUnidad, unidad || "", reporteFalla, hoy, JSON.stringify(evidencias || []), reportadoPor]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id, folio: result.rows[0].folio });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al enviar el reporte." }, { status: 500 });
  }
}
