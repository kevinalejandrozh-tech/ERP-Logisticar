import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Zona horaria para filtrar "por fecha" con el día local de la operación.
const ZONA = "America/Mexico_City";
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OBSERVACIONES = 2000;

// resultados = { "Auditoría GPS": { "Paro de motor desde Plataforma": true, ... }, "Funcionamiento": { ... }, ... }
type Resultados = Record<string, Record<string, boolean>>;

function mensajeError(err: unknown, porDefecto: string) {
return err instanceof Error && err.message ? err.message : porDefecto;
}

function esResultadosValido(valor: unknown): valor is Resultados {
if (!valor || typeof valor !== "object" || Array.isArray(valor)) return false;
const bloques = Object.values(valor as Record<string, unknown>);
if (bloques.length === 0) return false;
return bloques.every(
(bloque) =>
!!bloque &&
typeof bloque === "object" &&
!Array.isArray(bloque) &&
Object.values(bloque as Record<string, unknown>).every((v) => typeof v === "boolean")
);
}

// GET /api/unidades/revisiones?eco=ECO-15&desde=2026-09-01&hasta=2026-09-30&limite=200
// Todos los filtros son opcionales. Orden: más reciente primero.
export async function GET(req: NextRequest) {
try {
const params = req.nextUrl.searchParams;
const eco = params.get("eco")?.trim() || "";
const desde = params.get("desde")?.trim() || "";
const hasta = params.get("hasta")?.trim() || "";
const limite = Math.min(Math.max(parseInt(params.get("limite") || "200", 10) || 200, 1), 1000);

if ((desde && !FECHA_RE.test(desde)) || (hasta && !FECHA_RE.test(hasta))) {
return NextResponse.json({ error: "Las fechas deben tener formato AAAA-MM-DD." }, { status: 400 });
}

const condiciones: string[] = [];
const valores: (string | number)[] = [];
if (eco) {
valores.push(eco);
condiciones.push(`eco = $${valores.length}`);
}
if (desde) {
valores.push(desde);
condiciones.push(`fecha >= ($${valores.length}::date)::timestamp AT TIME ZONE '${ZONA}'`);
}
if (hasta) {
valores.push(hasta);
condiciones.push(`fecha < ($${valores.length}::date + 1)::timestamp AT TIME ZONE '${ZONA}'`);
}
valores.push(limite);
const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";

await ensureSchema();
const pool = getPool();
const result = await pool.query(
`SELECT id, eco, fecha, resultados, observaciones, realizado_por, kilometraje
FROM unidades_revisiones
${where}
ORDER BY fecha DESC, id DESC
LIMIT $${valores.length}`,
valores
);
return NextResponse.json({ ok: true, registros: result.rows }, { headers: { "Cache-Control": "no-store" } });
} catch (err: unknown) {
return NextResponse.json({ error: mensajeError(err, "Error al leer las revisiones.") }, { status: 500 });
}
}

// POST /api/unidades/revisiones  body: { eco, resultados, observaciones? }
// Cada envío crea un registro nuevo (historial). Quien lo realiza se toma de la sesión.
export async function POST(req: NextRequest) {
try {
const body = await req.json();
const eco = typeof body?.eco === "string" ? body.eco.trim() : "";
if (!eco) {
return NextResponse.json({ error: "Falta el campo eco." }, { status: 400 });
}
if (!esResultadosValido(body?.resultados)) {
return NextResponse.json({ error: "El checklist no tiene un formato válido." }, { status: 400 });
}
const observaciones =
typeof body?.observaciones === "string" && body.observaciones.trim()
? body.observaciones.trim().slice(0, MAX_OBSERVACIONES)
: null;

let kilometraje: number | null = null;
if (body?.kilometraje !== undefined && body?.kilometraje !== null && body?.kilometraje !== "") {
const km = Number(body.kilometraje);
if (!Number.isInteger(km) || km < 0 || km > 2147483647) {
return NextResponse.json({ error: "El kilometraje debe ser un número entero no negativo." }, { status: 400 });
}
kilometraje = km;
}

const token = req.cookies.get(COOKIE_SESION)?.value;
const sesion = token ? await verificarTokenSesion(token) : null;
const realizadoPor = sesion?.nombre || null;

await ensureSchema();
const pool = getPool();
const existe = await pool.query(`SELECT 1 FROM unidades WHERE eco = $1`, [eco]);
if (existe.rowCount === 0) {
return NextResponse.json({ error: `No existe la unidad ${eco}.` }, { status: 404 });
}
const result = await pool.query(
`INSERT INTO unidades_revisiones (eco, fecha, resultados, observaciones, realizado_por, kilometraje)
VALUES ($1, now(), $2, $3, $4, $5)
RETURNING id, eco, fecha, resultados, observaciones, realizado_por, kilometraje`,
[eco, JSON.stringify(body.resultados), observaciones, realizadoPor, kilometraje]
);
return NextResponse.json({ ok: true, registro: result.rows[0] });
} catch (err: unknown) {
return NextResponse.json({ error: mensajeError(err, "Error al guardar la revisión.") }, { status: 500 });
}
}

// DELETE /api/unidades/revisiones?id=123  → elimina un registro del historial (solo sysadmin).
export async function DELETE(req: NextRequest) {
try {
const token = req.cookies.get(COOKIE_SESION)?.value;
const sesion = token ? await verificarTokenSesion(token) : null;
if (sesion?.rol !== "sysadmin") {
return NextResponse.json({ error: "No tienes permisos para eliminar revisiones." }, { status: 403 });
}
const id = Number(req.nextUrl.searchParams.get("id"));
if (!Number.isInteger(id) || id <= 0) {
return NextResponse.json({ error: "Falta un id válido." }, { status: 400 });
}
await ensureSchema();
const pool = getPool();
const result = await pool.query(`DELETE FROM unidades_revisiones WHERE id = $1 RETURNING id, eco`, [id]);
if (result.rowCount === 0) {
return NextResponse.json({ error: "La revisión ya no existe." }, { status: 404 });
}
return NextResponse.json({ ok: true, eliminado: result.rows[0] });
} catch (err: unknown) {
return NextResponse.json({ error: mensajeError(err, "Error al eliminar la revisión.") }, { status: 500 });
}
}