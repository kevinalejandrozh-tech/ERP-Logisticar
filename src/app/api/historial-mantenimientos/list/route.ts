import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, estado, folio, eco_unidad, unidad, tipo_mantenimiento, reporte_falla, fecha_ingreso_taller, costo, orden,
       jsonb_array_length(coalesce(evidencias, '[]'::jsonb)) AS evidencias_count,
       reportado_por, detalle_servicio,
       jsonb_array_length(coalesce(evidencia_reparacion, '[]'::jsonb)) AS evidencia_reparacion_count,
       termino_servicio, factura_url
       FROM historial_mantenimientos ORDER BY orden ASC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      estado: r.estado || "",
      folio: r.folio || "",
      ecoUnidad: r.eco_unidad || "",
      unidad: r.unidad || "",
      tipoMantenimiento: r.tipo_mantenimiento || "",
      reporteFalla: r.reporte_falla || "",
      fechaIngresoTaller: r.fecha_ingreso_taller || "",
      costo: r.costo ?? "",
      evidenciasCount: Number(r.evidencias_count) || 0,
      reportadoPor: r.reportado_por || "",
      detalleServicio: r.detalle_servicio || "",
      evidenciaReparacionCount: Number(r.evidencia_reparacion_count) || 0,
      terminoServicio: r.termino_servicio || "",
      facturaUrl: r.factura_url || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el historial." }, { status: 500 });
  }
}
