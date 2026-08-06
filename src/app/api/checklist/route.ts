import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
export async function POST(req: NextRequest) {
try {
const body = await req.json();
const {
eco_unidad,
descripcion_unidad,
placas,
kilometraje_actual,
fotos_evidencia,
fotos_libres,
estado_llantas,
niveles,
checklist,
porcentaje_llenado,
} = body;
if (!eco_unidad) {
return NextResponse.json(
{ error: "Falta el ECO de la unidad." },
{ status: 400 }
);
}
await ensureSchema();
const pool = getPool();
const now = new Date();
const folio = `${eco_unidad}-${now
.toISOString()
.slice(0, 10)
.replace(/-/g, "")}-${now
.toTimeString()
.slice(0, 5)
.replace(":", "")}`;
const result = await pool.query(
`INSERT INTO checklist_unidades
(folio, eco_unidad, descripcion_unidad, placas, kilometraje_actual,
fotos_evidencia, fotos_libres, estado_llantas, niveles, checklist, porcentaje_llenado)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
RETURNING folio, fecha_hora`,
[
folio,
eco_unidad,
descripcion_unidad || null,
placas || null,
kilometraje_actual ?? null,
JSON.stringify(fotos_evidencia ?? {}),
JSON.stringify(fotos_libres ?? []),
JSON.stringify(estado_llantas ?? {}),
JSON.stringify(niveles ?? {}),
JSON.stringify(checklist ?? {}),
porcentaje_llenado ?? null,
]
);
return NextResponse.json({ ok: true, ...result.rows[0] });
} catch (err: any) {
return NextResponse.json(
{ error: err.message || "Error al guardar el checklist." },
{ status: 500 }
);
}
}
