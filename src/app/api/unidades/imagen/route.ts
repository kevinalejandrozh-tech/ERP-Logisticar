import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
// GET /api/unidades/imagen?eco=ECO-15  →  { ok: true, eco, imagen: "data:image/jpeg;base64,..." | null }
export async function GET(req: NextRequest) {
try {
const eco = req.nextUrl.searchParams.get("eco")?.trim();
if (!eco) {
return NextResponse.json({ error: "Falta el parámetro eco." }, { status: 400 });
}
await ensureSchema();
const pool = getPool();
const result = await pool.query(`SELECT imagen FROM unidades WHERE eco = $1`, [eco]);
if (result.rowCount === 0) {
return NextResponse.json({ error: `No existe la unidad ${eco}.` }, { status: 404 });
}
const imagen: string | null = result.rows[0].imagen || null;
return NextResponse.json({ ok: true, eco, imagen }, { headers: { "Cache-Control": "no-store" } });
} catch (err: unknown) {
const mensaje = err instanceof Error && err.message ? err.message : "Error al leer la imagen de la unidad.";
return NextResponse.json({ error: mensaje }, { status: 500 });
}
}