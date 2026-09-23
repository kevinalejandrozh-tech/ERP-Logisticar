import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
try {
await ensureSchema();
const pool = getPool();
// La foto NO viaja en la lista (se pide aparte en /api/unidades/imagen).
// `datos - 'imagen'` limpia fotos que se hayan guardado dentro del JSON en pruebas anteriores.
const result = await pool.query(
`SELECT eco, datos - 'imagen' AS datos, (imagen IS NOT NULL AND imagen <> '') AS tiene_imagen
FROM unidades ORDER BY eco ASC`
);
return NextResponse.json({
ok: true,
registros: result.rows.map((r) => r.datos),
// ECOs que tienen fotografía guardada (lo usa el módulo de Unidades).
conImagen: result.rows.filter((r) => r.tiene_imagen).map((r) => r.eco),
});
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al leer unidades." }, { status: 500 });
}
}