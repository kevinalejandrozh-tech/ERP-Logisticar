import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNominaSchema, errorJson, sesionNomina } from "@/lib/nominaDB";
import { aNumero } from "@/lib/nominaCalculo";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Alta y baja de personas desde la tabla de una semana de nómina.
// - GET: expedientes disponibles para agregar (activos y de baja).
// - POST accion "agregar": incluye en nómina un expediente existente (si estaba de baja, se reactiva).
// - POST accion "nueva": crea el expediente con datos básicos y lo incluye en nómina.
// - POST accion "baja": da de baja con la fecha indicada (por defecto hoy).
// - POST accion "fecha_baja": corrige la fecha (y motivo) de una baja existente.

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
// La fecha de baja se guarda a mediodía hora de México para que no cambie de día por zona horaria.
const SQL_FECHA_BAJA = `(($2::date + time '12:00') AT TIME ZONE 'America/Mexico_City')`;

function formatoMoneda(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNominaSchema();
    const r = await getPool().query(
      `SELECT e.id, e.nombre, e.puesto, COALESCE(e.estatus_laboral, 'Activo') AS estatus_laboral,
              to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
              to_char((e.fecha_baja AT TIME ZONE 'America/Mexico_City')::date, 'YYYY-MM-DD') AS fecha_baja,
              COALESCE(n.incluir, true) AS incluir
       FROM expedientes e LEFT JOIN nomina_empleados n ON n.expediente_id = e.id
       ORDER BY e.nombre ASC`
    );
    return NextResponse.json({ ok: true, personas: r.rows });
  } catch (err) {
    return errorJson(err, "Error al leer el personal.");
  }
}

export async function POST(req: NextRequest) {
  const s = await sesionNomina(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const accion = String(b.accion || "");
    await ensureNominaSchema();
    const pool = getPool();

    if (accion === "nueva") {
      const nombre = String(b.nombre || "").replace(/\s+/g, " ").trim();
      if (!nombre) return NextResponse.json({ error: "Escribe el nombre de la persona." }, { status: 400 });
      const ingreso = String(b.fecha_ingreso || "").slice(0, 10);
      if (!FECHA.test(ingreso)) return NextResponse.json({ error: "Indica la fecha de ingreso." }, { status: 400 });
      const sueldo = Math.max(0, aNumero(b.sueldo_semanal));
      const dup = await pool.query(`SELECT id FROM expedientes WHERE upper(trim(nombre)) = upper($1) LIMIT 1`, [nombre]);
      if (dup.rows.length) return NextResponse.json({ error: "Ya existe un expediente con ese nombre. Agrégalo desde la lista." }, { status: 409 });
      const ins = await pool.query(
        `INSERT INTO expedientes (nombre, puesto, fecha_ingreso, sueldo_ofertado) VALUES ($1, $2, $3, $4) RETURNING id`,
        [nombre, b.puesto ? String(b.puesto).trim() : null, ingreso, formatoMoneda(sueldo)]
      );
      const id = ins.rows[0].id as number;
      await pool.query(
        `INSERT INTO nomina_empleados (expediente_id, sueldo_semanal, incluir) VALUES ($1, $2, true)
         ON CONFLICT (expediente_id) DO UPDATE SET sueldo_semanal = $2, incluir = true, updated_at = now()`,
        [id, sueldo]
      );
      return NextResponse.json({ ok: true, id });
    }

    const id = Number(b.expediente_id);
    if (!id) return NextResponse.json({ error: "Falta la persona." }, { status: 400 });
    const exp = await pool.query(`SELECT id, nombre, COALESCE(estatus_laboral, 'Activo') AS estatus FROM expedientes WHERE id = $1`, [id]);
    if (!exp.rows[0]) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });

    if (accion === "agregar") {
      if (exp.rows[0].estatus === "Baja") {
        await pool.query(`UPDATE expedientes SET estatus_laboral = 'Activo', fecha_baja = NULL, updated_at = now() WHERE id = $1`, [id]);
      }
      await pool.query(
        `INSERT INTO nomina_empleados (expediente_id, incluir, sueldo_semanal)
         SELECT e.id, true, COALESCE(NULLIF(regexp_replace(COALESCE(e.sueldo_ofertado, ''), '[^0-9.]', '', 'g'), '')::numeric, 0)
         FROM expedientes e WHERE e.id = $1
         ON CONFLICT (expediente_id) DO UPDATE SET incluir = true, updated_at = now()`,
        [id]
      );
      return NextResponse.json({ ok: true });
    }

    if (accion === "baja" || accion === "fecha_baja") {
      const fecha = String(b.fecha_baja || "").slice(0, 10);
      if (!FECHA.test(fecha)) return NextResponse.json({ error: "Indica la fecha de baja." }, { status: 400 });
      const motivo = b.motivo_baja ? String(b.motivo_baja).trim().slice(0, 300) : "";
      if (accion === "baja") {
        if (!motivo) return NextResponse.json({ error: "Escribe el motivo de baja." }, { status: 400 });
        await pool.query(
          `UPDATE expedientes SET estatus_laboral = 'Baja', motivo_baja = $3, fecha_baja = ${SQL_FECHA_BAJA}, updated_at = now() WHERE id = $1`,
          [id, fecha, motivo]
        );
      } else {
        if (exp.rows[0].estatus !== "Baja") return NextResponse.json({ error: "La persona no está dada de baja." }, { status: 409 });
        await pool.query(
          `UPDATE expedientes SET fecha_baja = ${SQL_FECHA_BAJA}, motivo_baja = COALESCE(NULLIF($3, ''), motivo_baja), updated_at = now() WHERE id = $1`,
          [id, fecha, motivo]
        );
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
  } catch (err) {
    return errorJson(err, "Error al actualizar el personal de nómina.");
  }
}
