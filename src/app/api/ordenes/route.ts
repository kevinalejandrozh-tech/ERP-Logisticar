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
const { ecoUnidad, fallaDetectada } = body;
if (!ecoUnidad) {
return NextResponse.json({ error: "Selecciona el ECO de la unidad." }, { status: 400 });
}
await ensureSchema();
const pool = getPool();
for (let intento = 0; intento < 5; intento++) {
const actuales = await pool.query(`SELECT folio FROM ordenes_servicio`);
const max = actuales.rows.reduce((acc, r) => {
const n = parseInt(r.folio, 10);
return Number.isFinite(n) && n > acc ? n : acc;
}, 0);
const folio = String(max + 1).padStart(4, "0");
try {
const result = await pool.query(
`INSERT INTO ordenes_servicio (folio, eco_unidad, falla_detectada, estado)
VALUES ($1, $2, $3, 'diagnostico_pendiente')
RETURNING *`,
[folio, ecoUnidad, fallaDetectada || ""]
);
return NextResponse.json({ ok: true, orden: filaAOrden(result.rows[0]) });
} catch (err: any) {
if (err?.code === "23505") continue; // folio duplicado por carrera entre dispositivos, reintenta
throw err;
}
}
return NextResponse.json({ error: "No se pudo asignar el folio, intenta de nuevo." }, { status: 500 });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al crear la orden." }, { status: 500 });
}
}
