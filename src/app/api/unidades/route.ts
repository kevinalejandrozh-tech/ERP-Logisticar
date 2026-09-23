import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
// Límite de la foto en base64 (~1 MB). El page ya la comprime a ~450 KB.
const MAX_IMAGEN = 1_000_000;
export async function POST(req: NextRequest) {
try {
const body = await req.json();
const eco = body?.["ECO"];
if (!eco || !String(eco).trim()) {
return NextResponse.json({ error: "Falta el campo ECO." }, { status: 400 });
}
// La imagen se separa del JSON de datos y va a su propia columna.
const { imagen, ...datos } = body;
// Si el body no trae "imagen", se conserva la foto que ya existe.
const incluyeImagen = Object.prototype.hasOwnProperty.call(body, "imagen");
let imagenFinal: string | null = null;
if (incluyeImagen && imagen) {
if (typeof imagen !== "string" || !imagen.startsWith("data:image/")) {
return NextResponse.json({ error: "La imagen no tiene un formato válido." }, { status: 400 });
}
if (imagen.length > MAX_IMAGEN) {
return NextResponse.json({ error: "La imagen es demasiado pesada. Intenta con otra foto." }, { status: 413 });
}
imagenFinal = imagen;
}
await ensureSchema();
const pool = getPool();
await pool.query(
`INSERT INTO unidades (eco, datos, imagen, updated_at)
VALUES ($1, $2, $3, now())
ON CONFLICT (eco) DO UPDATE SET
datos = $2,
imagen = CASE WHEN $4::boolean THEN EXCLUDED.imagen ELSE unidades.imagen END,
updated_at = now()`,
[eco, JSON.stringify(datos), imagenFinal, incluyeImagen]
);
return NextResponse.json({ ok: true });
} catch (err: any) {
return NextResponse.json({ error: err.message || "Error al guardar la unidad." }, { status: 500 });
}
}