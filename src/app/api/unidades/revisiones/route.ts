import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Zona horaria para filtrar "por fecha" con el día local de la operación.
const ZONA = "America/Mexico_City";
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OBSERVACIONES = 2000;

// resultados = { "Auditoría GPS": { "Paro de motor desde Plataforma": true, ... }, "Funcionamiento": { ... }, ... }
type Resultados = Record<string, Record<string, boolean>>;

// neumaticos = { P1: { folio: "A123", mm: 6.5 }, ..., PR: { folio: "", mm: null } }
type Llanta = { folio: string; mm: number | null };
type Neumaticos = Record<string, Llanta>;

// Posiciones y MM máximo por tipo de unidad (mismas reglas que la pantalla de Unidades).
// El tipo se detecta por el nombre de la unidad ("Unidad" o "Modelo/Tipo" en su ficha).
const MAX_FOLIO = 40;
const posicionesLlantas = (n: number) => [...Array.from({ length: n }, (_, i) => `P${i + 1}`), "PR"];
const TIPOS_NEUMATICOS: { tipo: string; patron: RegExp; posiciones: string[]; mmMax: number }[] = [
{ tipo: "Transporter", patron: /transporter/i, posiciones: posicionesLlantas(4), mmMax: 9.2 },
{ tipo: "Sprinter", patron: /sprinter/i, posiciones: posicionesLlantas(4), mmMax: 11 },
{ tipo: "Delivery", patron: /delivery/i, posiciones: posicionesLlantas(6), mmMax: 11 },
{ tipo: "Torthon", patron: /torth?on/i, posiciones: posicionesLlantas(10), mmMax: 18 },
];

function tipoNeumaticos(datos: Record<string, unknown> | null | undefined) {
if (!datos) return null;
const texto = `${datos["Unidad"] ?? ""} ${datos["Modelo/Tipo"] ?? ""}`;
return TIPOS_NEUMATICOS.find((t) => t.patron.test(texto)) || null;
}

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

// Valida y normaliza los neumáticos que envía la pantalla. Regresa el objeto limpio o un mensaje de error.
function validarNeumaticos(valor: unknown, tipo: (typeof TIPOS_NEUMATICOS)[number] | null): { ok: true; neumaticos: Neumaticos | null } | { ok: false; error: string } {
if (valor === undefined || valor === null) return { ok: true, neumaticos: null };
if (typeof valor !== "object" || Array.isArray(valor)) {
return { ok: false, error: "Los neumáticos no tienen un formato válido." };
}
if (!tipo) {
return { ok: false, error: "No se identificó el tipo de unidad (Transporter, Sprinter, Delivery o Torthon) para registrar neumáticos." };
}
const limpio: Neumaticos = {};
for (const [posicion, llanta] of Object.entries(valor as Record<string, unknown>)) {
if (!tipo.posiciones.includes(posicion)) {
return { ok: false, error: `La posición ${posicion} no corresponde a una unidad ${tipo.tipo}.` };
}
if (!llanta || typeof llanta !== "object" || Array.isArray(llanta)) {
return { ok: false, error: `La llanta ${posicion} no tiene un formato válido.` };
}
const { folio, mm } = llanta as { folio?: unknown; mm?: unknown };
if (folio !== undefined && folio !== null && typeof folio !== "string") {
return { ok: false, error: `El folio de la llanta ${posicion} no es válido.` };
}
const folioLimpio = typeof folio === "string" ? folio.trim().slice(0, MAX_FOLIO) : "";
let mmLimpio: number | null = null;
if (mm !== undefined && mm !== null && mm !== "") {
const numero = Number(mm);
if (!Number.isFinite(numero) || numero <= 0) {
return { ok: false, error: `El valor en MM de la llanta ${posicion} debe ser mayor a 0.` };
}
if (numero > tipo.mmMax) {
return { ok: false, error: `El valor en MM de la llanta ${posicion} excede el máximo permitido para ${tipo.tipo} (${tipo.mmMax} mm).` };
}
mmLimpio = Math.round(numero * 100) / 100;
}
limpio[posicion] = { folio: folioLimpio, mm: mmLimpio };
}
return { ok: true, neumaticos: Object.keys(limpio).length ? limpio : null };
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
`SELECT id, eco, fecha, resultados, observaciones, realizado_por, kilometraje, neumaticos
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

// POST /api/unidades/revisiones  body: { eco, resultados, observaciones?, kilometraje?, neumaticos? }
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
const existe = await pool.query(`SELECT datos FROM unidades WHERE eco = $1`, [eco]);
if (existe.rowCount === 0) {
return NextResponse.json({ error: `No existe la unidad ${eco}.` }, { status: 404 });
}
// Los límites de MM dependen del tipo de unidad guardado en su ficha.
const validacion = validarNeumaticos(body?.neumaticos, tipoNeumaticos(existe.rows[0].datos));
if (!validacion.ok) {
return NextResponse.json({ error: validacion.error }, { status: 400 });
}
const result = await pool.query(
`INSERT INTO unidades_revisiones (eco, fecha, resultados, observaciones, realizado_por, kilometraje, neumaticos)
VALUES ($1, now(), $2, $3, $4, $5, $6)
RETURNING id, eco, fecha, resultados, observaciones, realizado_por, kilometraje, neumaticos`,
[
eco,
JSON.stringify(body.resultados),
observaciones,
realizadoPor,
kilometraje,
validacion.neumaticos ? JSON.stringify(validacion.neumaticos) : null,
]
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
if (!tienePermisosAdmin(sesion?.rol)) {
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