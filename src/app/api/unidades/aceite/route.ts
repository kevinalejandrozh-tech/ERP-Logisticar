import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Intervalo fijo entre cambios de aceite (km). Duplicado a propósito en el frontend
// (revisiones-aceite/page.tsx), siguiendo la convención ya usada en el proyecto para
// constantes de validación (p. ej. TIPOS_NEUMATICOS).
const INTERVALO_KM_ACEITE = 18000;
const KM_MAX = 2147483647;

function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// Entero positivo (no negativo, no cero) y dentro de rango de INTEGER.
function esKmValido(valor: unknown): valor is number {
  return typeof valor === "number" && Number.isInteger(valor) && valor > 0 && valor <= KM_MAX;
}

// GET /api/unidades/aceite
// → { ok: true, registros: [ { eco, unidad, kmUltimoCambio, fechaUltimoCambio, kmProximoCambio, kmActual }, ... ] }
// Combina TODAS las unidades (fuente: tabla unidades) con su estado de aceite (LEFT JOIN).
// kmActual NO se captura aquí: se recupera de la última revisión guardada en el módulo de
// Unidades (unidades_revisiones.kilometraje), que es donde se registra el kilometraje real
// de la unidad. Es un campo de solo lectura para este submódulo.
export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT u.eco,
              u.datos->>'Unidad' AS unidad,
              a.km_ultimo_cambio,
              a.fecha_ultimo_cambio,
              r.kilometraje AS km_actual
       FROM unidades u
       LEFT JOIN unidades_aceite a ON a.eco = u.eco
       LEFT JOIN (
         SELECT DISTINCT ON (eco) eco, kilometraje
         FROM unidades_revisiones
         WHERE kilometraje IS NOT NULL
         ORDER BY eco, fecha DESC, id DESC
       ) r ON r.eco = u.eco
       ORDER BY u.eco ASC`
    );
    const registros = result.rows.map((fila) => {
      const kmUltimoCambio: number | null = fila.km_ultimo_cambio;
      return {
        eco: fila.eco,
        unidad: fila.unidad || "",
        kmUltimoCambio,
        fechaUltimoCambio: fila.fecha_ultimo_cambio,
        kmProximoCambio: kmUltimoCambio !== null ? kmUltimoCambio + INTERVALO_KM_ACEITE : null,
        kmActual: fila.km_actual,
      };
    });
    return NextResponse.json({ ok: true, registros }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al leer los cambios de aceite.") }, { status: 500 });
  }
}

// POST /api/unidades/aceite  body: { eco, kmUltimoCambio }
// Único campo capturable en este submódulo. Al guardarlo se recalcula fecha_ultimo_cambio =
// now() automáticamente (campo bloqueado en el frontend). kmActual ya no se recibe aquí: se
// valida contra el kilometraje más reciente registrado en unidades_revisiones (módulo de
// Unidades) para mantener la regla de consistencia: ese kilometraje no puede ser menor que el
// KM del último cambio (sí puede exceder el próximo cambio, es decir, unidades vencidas/
// "urgente" son válidas).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eco = typeof body?.eco === "string" ? body.eco.trim() : "";
    if (!eco) {
      return NextResponse.json({ error: "Falta el campo eco." }, { status: 400 });
    }

    if (body?.kmUltimoCambio === undefined || body?.kmUltimoCambio === null || body?.kmUltimoCambio === "") {
      return NextResponse.json({ error: "Falta el KM del último cambio." }, { status: 400 });
    }
    const kmUltimoCambio = Number(body.kmUltimoCambio);
    if (!esKmValido(kmUltimoCambio)) {
      return NextResponse.json({ error: "El KM del último cambio debe ser un número entero positivo." }, { status: 400 });
    }

    await ensureSchema();
    const pool = getPool();

    const existeUnidad = await pool.query(`SELECT 1 FROM unidades WHERE eco = $1`, [eco]);
    if (existeUnidad.rowCount === 0) {
      return NextResponse.json({ error: `No existe la unidad ${eco}.` }, { status: 404 });
    }

    // Kilometraje actual conocido (última revisión capturada en Unidades), para validar consistencia.
    const ultimaRevision = await pool.query(
      `SELECT kilometraje FROM unidades_revisiones WHERE eco = $1 AND kilometraje IS NOT NULL ORDER BY fecha DESC, id DESC LIMIT 1`,
      [eco]
    );
    const kmActualConocido: number | null = ultimaRevision.rows[0]?.kilometraje ?? null;
    if (kmActualConocido !== null && kmActualConocido < kmUltimoCambio) {
      return NextResponse.json(
        { error: "El KM actual de la unidad (última revisión registrada) no puede ser menor que el KM del último cambio." },
        { status: 400 }
      );
    }

    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    const actualizadoPor = sesion?.nombre || null;

    const result = await pool.query(
      `INSERT INTO unidades_aceite (eco, km_ultimo_cambio, fecha_ultimo_cambio, actualizado_por, updated_at)
       VALUES ($1, $2, now(), $3, now())
       ON CONFLICT (eco) DO UPDATE SET
         km_ultimo_cambio = $2,
         fecha_ultimo_cambio = now(),
         actualizado_por = $3,
         updated_at = now()
       RETURNING eco, km_ultimo_cambio, fecha_ultimo_cambio`,
      [eco, kmUltimoCambio, actualizadoPor]
    );
    return NextResponse.json({ ok: true, registro: result.rows[0] });
  } catch (err: unknown) {
    return NextResponse.json({ error: mensajeError(err, "Error al guardar el cambio de aceite.") }, { status: 500 });
  }
}