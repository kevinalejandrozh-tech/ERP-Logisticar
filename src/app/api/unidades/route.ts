import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
export async function POST(req: NextRequest) {
try {
const body = await req.json();
const eco = body?.["ECO"];
if (!eco || !String(eco).trim()) {
return NextResponse.json({ error: "Falta el campo ECO." }, { status: 400 });
}
await ensureSchema();
const pool = getPool();
await pool.query(
`INSERT INTO unidades (eco, datos, updated_at)
VALUES ($1, $2, now())
ON CONFLICT (eco) DO UPDATE SET datos = $2, updated_at = now()`,
[eco, JSON.stringify(body)]
);
return NextResponse.json({ ok: true });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al guardar la unidad." }, { status: 500 });
}
}
