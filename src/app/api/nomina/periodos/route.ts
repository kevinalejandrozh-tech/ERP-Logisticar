import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, sesionNomina } from "@/lib/nominaDB";
import { aNumero, sumarDias } from "@/lib/nominaCalculo";

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
             to_char(p.fecha_fin, 'YYYY-MM-DD') AS fecha_fin, p.estado,
             COALESCE(SUM(r.neto), 0) AS total_neto, COUNT(r.id)::int AS empleados
      FROM nomina_periodos p
      LEFT JOIN nomina_registros r ON r.periodo_id = p.id
      GROUP BY p.id
      ORDER BY p.anio DESC, p.semana DESC
    `);
    const periodos = r.rows.map((f) => ({ ...f, total_neto: aNumero(f.total_neto) }));
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
    const { id, estado } = await req.json();
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
