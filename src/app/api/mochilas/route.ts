import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
export async function POST(req: NextRequest) {
try {
const body = await req.json();
const { folio, operador, contenido, foto } = body;
if (!folio || !String(folio).trim()) {
return NextResponse.json({ error: "Falta el folio de la mochila." }, { status: 400 });
}
await ensureSchema();
const pool = getPool();
await pool.query(
`INSERT INTO mochilas (folio, operador, contenido, foto, updated_at)
VALUES ($1, $2, $3, $4, now())
ON CONFLICT (folio) DO UPDATE SET operador = $2, contenido = $3, foto = $4, updated_at = now()`,
[folio, operador || null, JSON.stringify(contenido || []), foto || null]
);
return NextResponse.json({ ok: true });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al guardar la mochila." }, { status: 500 });
}
}
