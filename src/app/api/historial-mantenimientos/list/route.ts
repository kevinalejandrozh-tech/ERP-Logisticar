import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, estado, folio, eco_unidad, unidad, tipo_mantenimiento, reporte_falla, fecha_ingreso_taller, costo, orden, evidencias, reportado_por, detalle_servicio, evidencia_reparacion, termino_servicio, factura_url
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
      evidencias: r.evidencias || [],
      reportadoPor: r.reportado_por || "",
      detalleServicio: r.detalle_servicio || "",
      evidenciaReparacion: r.evidencia_reparacion || [],
      terminoServicio: r.termino_servicio || "",
      facturaUrl: r.factura_url || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el historial." }, { status: 500 });
  }
}
