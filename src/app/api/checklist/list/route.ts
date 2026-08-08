import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
try {
await ensureSchema();
const pool = getPool();
const result = await pool.query(
`SELECT id, folio, eco_unidad, descripcion_unidad, placas, fecha_hora, porcentaje_llenado
FROM checklist_unidades ORDER BY fecha_hora DESC LIMIT 50`
);
return NextResponse.json({ ok: true, registros: result.rows });
} catch (err: any) {
return NextResponse.json(
{ error: err.message || "Error al leer registros." },
{ status: 500 }
);
}
}
