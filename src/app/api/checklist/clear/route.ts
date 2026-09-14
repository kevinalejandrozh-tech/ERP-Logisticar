import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
export async function POST(req: NextRequest) {
try {
await ensureSchema();
const pool = getPool();
const body = await req.json().catch(() => ({}));
const ids: number[] | undefined = body.ids;
let result;
if (Array.isArray(ids) && ids.length > 0) {
result = await pool.query(
`DELETE FROM checklist_unidades WHERE id = ANY($1::int[]) RETURNING id`,
[ids]
);
} else {
// Sin ids específicos: borra todo (se usa después de descargar todo)
result = await pool.query(
`DELETE FROM checklist_unidades RETURNING id`
);
}
return NextResponse.json({ ok: true, borrados: result.rowCount });
} catch (err: any) {
return NextResponse.json(
{ error: err.message || "Error al liberar espacio." },
{ status: 500 }
);
}
}
