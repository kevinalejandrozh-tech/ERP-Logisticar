import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAPA_COLUMNAS: Record<string, string> = {
  estado: "estado",
  folio: "folio",
  ecoUnidad: "eco_unidad",
  unidad: "unidad",
  tipoMantenimiento: "tipo_mantenimiento",
  reportadoPor: "reportado_por",
  reporteFalla: "reporte_falla",
  fechaIngresoTaller: "fecha_ingreso_taller",
  costo: "costo",
  detalleServicio: "detalle_servicio",
  terminoServicio: "termino_servicio",
  facturaUrl: "factura_url",
};
const CAMPOS_NUMERICOS = new Set(["costo"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...campos } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la fila." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const sets: string[] = [];
    const valores: unknown[] = [id];
    let i = 2;
    for (const [clave, columna] of Object.entries(MAPA_COLUMNAS)) {
      if (!Object.prototype.hasOwnProperty.call(campos, clave)) continue;
      let valor = campos[clave];
      if (CAMPOS_NUMERICOS.has(clave) && (valor === "" || valor === undefined)) valor = null;
      sets.push(`${columna} = $${i}`);
      valores.push(valor);
      i++;
    }
    if (sets.length === 0 && !Object.prototype.hasOwnProperty.call(campos, "evidenciaReparacion")) {
      return NextResponse.json({ error: "No hay campos para actualizar." }, { status: 400 });
    }
    sets.push("updated_at = now()");
    if (Object.prototype.hasOwnProperty.call(campos, "evidenciaReparacion")) {
      await pool.query(`UPDATE historial_mantenimientos SET evidencia_reparacion = $2::jsonb, updated_at = now() WHERE id = $1`, [id, JSON.stringify(campos.evidenciaReparacion)]);
    }
    if (sets.length > 1) {
      const result = await pool.query(`UPDATE historial_mantenimientos SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, valores);
      if (result.rowCount === 0) {
        return NextResponse.json({ error: "No se encontró la fila." }, { status: 404 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar la fila." }, { status: 500 });
  }
}
