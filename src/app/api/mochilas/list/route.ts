import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
try {
await ensureSchema();
const pool = getPool();
const result = await pool.query(`SELECT folio, operador, contenido, foto, unidad, responsable FROM mochilas ORDER BY folio ASC`);
const registros = result.rows.map((r) => ({
folio: r.folio,
operador: r.operador || "",
contenido: r.contenido || [],
foto: r.foto || null,
unidad: r.unidad || "",
responsable: r.responsable || "",
}));
return NextResponse.json({ ok: true, registros });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al leer mochilas." }, { status: 500 });
}
}
