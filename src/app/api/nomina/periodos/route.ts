import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, sesionNomina } from "@/lib/nominaDB";
import { aNumero, calcularTotales, sumarDias } from "@/lib/nominaCalculo";
import { leerConfigNomina } from "@/lib/nominaDB";
import { ahoraMx, lunesSemanaIso, semanaIso } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ESTADOS = ["Abierta", "Cerrada", "Pagada"];

export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNominaSchema();
    const r = await getPool().query(`
      SELECT p.id, p.anio, p.semana, to_char(p.fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio,
             to_char(p.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, p.estado, p.sueldo_base,
             COALESCE(SUM(r.neto), 0) AS total_neto, COUNT(r.id)::int AS empleados,
             (SELECT COUNT(*)::int FROM expedientes e LEFT JOIN nomina_empleados n ON n.expediente_id = e.id
               WHERE COALESCE(e.estatus_laboral, 'Activo') != 'Baja' AND COALESCE(n.incluir, true) = true
                 AND (e.fecha_ingreso IS NULL OR e.fecha_ingreso <= p.fecha_fin)) AS total_personal
      FROM nomina_periodos p
      LEFT JOIN nomina_registros r ON r.periodo_id = p.id
      GROUP BY p.id
      ORDER BY p.anio DESC, p.semana DESC
    `);
    const periodos = r.rows.map((f) => ({ ...f, total_neto: aNumero(f.total_neto), sueldo_base: f.sueldo_base === null ? null : aNumero(f.sueldo_base) }));
    return NextResponse.json({ ok: true, periodos });
  } catch (err) {
    return errorJson(err, "Error al leer las semanas de nómina.");
  }
}

// Crea una semana: fecha_inicio (obligatoria), fin = inicio + 6 días. Semana y año se pueden indicar o se calculan.
export async function POST(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const body = await req.json();
    if (body.generar === true) return await generarSemanas();
    const inicio = String(body.fecha_inicio || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) return NextResponse.json({ error: "Indica la fecha de inicio de la semana." }, { status: 400 });
    const anio = Number(body.anio) || Number(inicio.slice(0, 4));
    await ensureNominaSchema();
    const pool = getPool();
    let semana = Number(body.semana);
    if (!semana) {
      const m = await pool.query(`SELECT COALESCE(MAX(semana), 0) + 1 AS siguiente FROM nomina_periodos WHERE anio = $1`, [anio]);
      semana = Number(m.rows[0].siguiente) || 1;
    }
    if (semana < 1 || semana > 53) return NextResponse.json({ error: "La semana debe estar entre 1 y 53." }, { status: 400 });
    const existe = await pool.query(`SELECT id FROM nomina_periodos WHERE anio = $1 AND semana = $2`, [anio, semana]);
    if (existe.rows.length) return NextResponse.json({ error: `La semana ${semana} de ${anio} ya existe.` }, { status: 409 });
    const r = await pool.query(
      `INSERT INTO nomina_periodos (anio, semana, fecha_inicio, fecha_fin) VALUES ($1, $2, $3, $4) RETURNING id`,
      [anio, semana, inicio, sumarDias(inicio, 6)]
    );
    return NextResponse.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    return errorJson(err, "Error al crear la semana.");
  }
}

// Cambia el estado: Abierta (editable) → Cerrada (bloqueada) → Pagada.
export async function PATCH(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const body = await req.json();
    const { id, estado } = body;
    if (Number(id) && body.sueldo_base !== undefined) return await aplicarSueldoBase(Number(id), body.sueldo_base);
    if (!Number(id) || !ESTADOS.includes(estado)) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    await ensureNominaSchema();
    await getPool().query(`UPDATE nomina_periodos SET estado = $2, updated_at = now() WHERE id = $1`, [Number(id), estado]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al actualizar la semana.");
  }
}

// Solo se puede eliminar una semana abierta y sin registros guardados.
export async function DELETE(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Falta la semana." }, { status: 400 });
    await ensureNominaSchema();
    const pool = getPool();
    const r = await pool.query(
      `SELECT p.estado, (SELECT COUNT(*)::int FROM nomina_registros WHERE periodo_id = p.id) AS registros FROM nomina_periodos p WHERE p.id = $1`,
      [id]
    );
    const f = r.rows[0];
    if (!f) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
    if (f.estado !== "Abierta" || f.registros > 0) {
      return NextResponse.json({ error: "Solo se puede eliminar una semana abierta y sin capturas." }, { status: 409 });
    }
    await pool.query(`DELETE FROM nomina_periodos WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorJson(err, "Error al eliminar la semana.");
  }
}

// Crea las semanas ISO (lunes a domingo) desde la 1 del año en curso hasta la semana actual.
// Las que ya existen se respetan sin modificarse.
async function generarSemanas() {
  await ensureNominaSchema();
  const { anio, semana: actual } = semanaIso(ahoraMx().fecha);
  const pool = getPool();
  const existentes = await pool.query(`SELECT semana FROM nomina_periodos WHERE anio = $1`, [anio]);
  const ya = new Set(existentes.rows.map((r) => Number(r.semana)));
  let creadas = 0;
  for (let s = 1; s <= actual; s++) {
    if (ya.has(s)) continue;
    const inicio = lunesSemanaIso(anio, s);
    const r = await pool.query(
      `INSERT INTO nomina_periodos (anio, semana, fecha_inicio, fecha_fin) VALUES ($1, $2, $3, $4) ON CONFLICT (anio, semana) DO NOTHING`,
      [anio, s, inicio, sumarDias(inicio, 6)]
    );
    creadas += r.rowCount || 0;
  }
  return NextResponse.json({ ok: true, anio, hasta_semana: actual, creadas });
}

// Sueldo base (depósito BBVA) de toda la semana: se guarda en la semana y se aplica a las capturas ya guardadas.
// null = cada persona usa su sueldo base individual.
async function aplicarSueldoBase(id: number, valor: unknown) {
  await ensureNominaSchema();
  const pool = getPool();
  const p = await pool.query(`SELECT estado FROM nomina_periodos WHERE id = $1`, [id]);
  if (!p.rows[0]) return NextResponse.json({ error: "La semana no existe." }, { status: 404 });
  if (p.rows[0].estado !== "Abierta") return NextResponse.json({ error: "La semana no está abierta." }, { status: 409 });
  const base = valor === null || valor === "" ? null : Math.max(0, aNumero(valor));
  await pool.query(`UPDATE nomina_periodos SET sueldo_base = $2, updated_at = now() WHERE id = $1`, [id, base]);
  if (base !== null) {
    const cfg = await leerConfigNomina();
    const regs = await pool.query(`SELECT * FROM nomina_registros WHERE periodo_id = $1`, [id]);
    for (const r of regs.rows) {
      const num: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) num[k] = typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v;
      const cap = { ...num, sueldo_base: base, creditos: [] } as unknown as Parameters<typeof calcularTotales>[0];
      const t = calcularTotales(cap, cfg);
      await pool.query(`UPDATE nomina_registros SET sueldo_base = $2, deposito_bbva = $3, deposito_viaticos = $4, updated_at = now() WHERE id = $1`, [r.id, base, t.deposito_bbva, t.deposito_viaticos]);
    }
  }
  return NextResponse.json({ ok: true });
}
