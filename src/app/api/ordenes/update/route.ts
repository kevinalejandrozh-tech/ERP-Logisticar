import { NextRequest, NextResponse } from "next/server";
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
export async function POST(req: NextRequest) {
try {
const body = await req.json();
const { folio, diagnostico, responsable, requisicion, fechaDiagnostico, fechaIngreso, fechaCierre, quedoBien, fotoReparacion, estado, ecoUnidad, fallaDetectada } = body;
if (!folio) {
return NextResponse.json({ error: "Falta el folio de la orden." }, { status: 400 });
}
await ensureSchema();
const pool = getPool();
const result = await pool.query(
`UPDATE ordenes_servicio SET
diagnostico = COALESCE($2, diagnostico),
responsable = COALESCE($3, responsable),
requisicion = COALESCE($4::jsonb, requisicion),
fecha_diagnostico = COALESCE($5::timestamptz, fecha_diagnostico),
fecha_ingreso = COALESCE($6::timestamptz, fecha_ingreso),
fecha_cierre = COALESCE($7::timestamptz, fecha_cierre),
quedo_bien = COALESCE($8, quedo_bien),
foto_reparacion = COALESCE($9, foto_reparacion),
estado = COALESCE($10, estado),
eco_unidad = COALESCE($11, eco_unidad),
falla_detectada = COALESCE($12, falla_detectada),
updated_at = now()
WHERE folio = $1
RETURNING *`,
[
folio,
diagnostico ?? null,
responsable ?? null,
requisicion !== undefined ? JSON.stringify(requisicion) : null,
fechaDiagnostico ?? null,
fechaIngreso ?? null,
fechaCierre ?? null,
quedoBien ?? null,
fotoReparacion ?? null,
estado ?? null,
ecoUnidad ?? null,
fallaDetectada ?? null,
]
);
if (result.rows.length === 0) {
return NextResponse.json({ error: "No se encontró la orden." }, { status: 404 });
}
return NextResponse.json({ ok: true, orden: filaAOrden(result.rows[0]) });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al actualizar la orden." }, { status: 500 });
}
}
