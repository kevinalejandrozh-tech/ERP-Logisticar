import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";
import { ensureNominaSchema } from "@/lib/nominaDB";
import { ahoraMx, antiguedad, diasVacacionesLey, sumarDiasIso } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

function error(e: unknown, m: string) {
  return NextResponse.json({ error: e instanceof Error ? e.message : m }, { status: 500 });
}

// Programación de vacaciones del personal activo con 1 año o más de antigüedad.
// Días por ley según años cumplidos; los días marcados "Vacaciones" en Asistencia dentro del periodo vigente
// (aniversario a aniversario) se descuentan. Los que no fueron programados aquí se consideran "adelanto".
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    await ensureNominaSchema();
    const pool = getPool();
    const hoy = ahoraMx().fecha;
    const emp = await pool.query(`
      SELECT e.id, e.nombre, e.puesto, to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso, COALESCE(n.sueldo_base, 2310) AS sueldo_base
      FROM expedientes e LEFT JOIN nomina_empleados n ON n.expediente_id = e.id
      WHERE COALESCE(e.estatus_laboral, 'Activo') != 'Baja' AND e.fecha_ingreso IS NOT NULL AND e.fecha_ingreso <= (CURRENT_DATE - interval '1 year')
      ORDER BY e.nombre`);
    const personas = [];
    for (const e of emp.rows) {
      const a = antiguedad(e.fecha_ingreso, hoy);
      if (a.anios < 1) continue;
      const vac = await pool.query(
        `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, origen, notas FROM asistencia_registros
         WHERE expediente_id = $1 AND tipo = 'Vacaciones' AND fecha BETWEEN $2 AND $3 ORDER BY fecha`,
        [e.id, a.desde, a.hasta]
      );
      const aj = await pool.query(`SELECT * FROM vacaciones_ajustes WHERE expediente_id = $1 AND anio_servicio = $2`, [e.id, a.anios]);
      const ajuste = aj.rows[0] || null;
      personas.push({
        id: e.id,
        nombre: e.nombre,
        puesto: e.puesto,
        fecha_ingreso: e.fecha_ingreso,
        anios: a.anios,
        periodo_desde: a.desde,
        periodo_hasta: a.hasta,
        dias_ley: diasVacacionesLey(a.anios),
        sueldo_base: Number(e.sueldo_base) || 2310,
        programados: vac.rows.filter((r) => r.origen === "Programada"),
        adelantos: vac.rows.filter((r) => r.origen !== "Programada"),
        ajuste: ajuste && {
          dias_derecho: num(ajuste.dias_derecho),
          dias_pago: num(ajuste.dias_pago),
          porcentaje_prima: num(ajuste.porcentaje_prima) ?? 25,
          salario_diario: num(ajuste.salario_diario),
          monto_final: num(ajuste.monto_final),
          saldo_favor: num(ajuste.saldo_favor) ?? 0,
          saldo_pendiente: num(ajuste.saldo_pendiente) ?? 0,
          comentarios: ajuste.comentarios || "",
        },
      });
    }
    return NextResponse.json({ ok: true, hoy, personas });
  } catch (e) {
    return error(e, "Error al leer las vacaciones.");
  }
}

// Guarda los ajustes (días, prima, salario diario, monto final, saldos y comentarios) del año de servicio.
export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.expediente_id);
    const anio = Number(b.anio_servicio);
    if (!id || !anio) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    const pct = num(b.porcentaje_prima) ?? 25;
    if (pct < 0 || pct > 200) return NextResponse.json({ error: "El porcentaje de prima debe estar entre 0 y 200." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(
      `INSERT INTO vacaciones_ajustes (expediente_id, anio_servicio, dias_derecho, dias_pago, porcentaje_prima, salario_diario, monto_final, saldo_favor, saldo_pendiente, comentarios)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (expediente_id, anio_servicio) DO UPDATE SET dias_derecho = $3, dias_pago = $4, porcentaje_prima = $5, salario_diario = $6,
         monto_final = $7, saldo_favor = $8, saldo_pendiente = $9, comentarios = $10, updated_at = now()`,
      [id, anio, num(b.dias_derecho), num(b.dias_pago), pct, num(b.salario_diario), num(b.monto_final), num(b.saldo_favor) ?? 0, num(b.saldo_pendiente) ?? 0,
        b.comentarios ? String(b.comentarios).slice(0, 600) : null]
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e, "Error al guardar los ajustes.");
  }
}

// Programa vacaciones en un rango: crea "Vacaciones" (origen Programada) en Asistencia.
// Los días que ya tienen otro registro se respetan y se informan como omitidos.
export async function POST(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.expediente_id);
    const desde = String(b.desde || "");
    const hasta = String(b.hasta || "");
    if (!id || !FECHA.test(desde) || !FECHA.test(hasta) || hasta < desde) return NextResponse.json({ error: "Rango de fechas inválido." }, { status: 400 });
    if (sumarDiasIso(desde, 45) < hasta) return NextResponse.json({ error: "Máximo 46 días por programación." }, { status: 400 });
    await ensureAsistenciaSchema();
    const pool = getPool();
    let creados = 0;
    let omitidos = 0;
    for (let f = desde; f <= hasta; f = sumarDiasIso(f, 1)) {
      if (b.excluir_domingos !== false && new Date(f + "T00:00:00Z").getUTCDay() === 0) continue;
      const r = await pool.query(
        `INSERT INTO asistencia_registros (expediente_id, fecha, tipo, origen, notas, registrado_por)
         VALUES ($1, $2, 'Vacaciones', 'Programada', $3, $4) ON CONFLICT (expediente_id, fecha) DO NOTHING`,
        [id, f, b.notas ? String(b.notas).slice(0, 300) : "Vacaciones programadas", s.nombre]
      );
      if (r.rowCount) creados++;
      else omitidos++;
    }
    return NextResponse.json({ ok: true, creados, omitidos });
  } catch (e) {
    return error(e, "Error al programar las vacaciones.");
  }
}

// Quita un día programado (solo los de origen Programada).
export async function DELETE(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("expediente_id"));
    const fecha = req.nextUrl.searchParams.get("fecha") || "";
    if (!id || !FECHA.test(fecha)) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(`DELETE FROM asistencia_registros WHERE expediente_id = $1 AND fecha = $2 AND tipo = 'Vacaciones' AND origen = 'Programada'`, [id, fecha]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return error(e, "Error al quitar el día.");
  }
}
