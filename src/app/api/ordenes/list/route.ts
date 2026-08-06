import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
function filaAOrden(r: any) {
return {
folio: r.folio,
fecha: r.fecha,
ecoUnidad: r.eco_unidad,
fallaDetectada: r.falla_detectada || "",
estado: r.estado,
diagnostico: r.diagnostico || undefined,
responsable: r.responsable || undefined,
requisicion: r.requisicion || [],
fechaDiagnostico: r.fecha_diagnostico || undefined,
fechaIngreso: r.fecha_ingreso || undefined,
fechaCierre: r.fecha_cierre || undefined,
quedoBien: r.quedo_bien || undefined,
fotoReparacion: r.foto_reparacion || null,
};
}
export async function GET() {
try {
await ensureSchema();
const pool = getPool();
const result = await pool.query(`SELECT * FROM ordenes_servicio ORDER BY folio ASC`);
return NextResponse.json({ ok: true, registros: result.rows.map(filaAOrden) });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al leer las órdenes." }, { status: 500 });
}
}
