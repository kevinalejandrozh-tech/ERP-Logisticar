import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sesionAsistencia } from "@/lib/asistenciaDB";
import { ahoraMx, horarioDe, lunesDe, sumarDiasIso } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Asistencia semanal desde el reloj checador (lunes a domingo).
// GET ?fecha=YYYY-MM-DD → semana que contiene esa fecha: personal activo, registros por día y número de checadas.
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const hoy = ahoraMx().fecha;
    const f = req.nextUrl.searchParams.get("fecha") || "";
    const desde = lunesDe(/^\d{4}-\d{2}-\d{2}$/.test(f) ? f : hoy);
    const hasta = sumarDiasIso(desde, 6);
    const pool = getPool();
    const cfg = await leerConfigAsistencia();
    const [personal, registros, checadas] = await Promise.all([
      pool.query(
        `SELECT id, nombre, puesto, hora_entrada, hora_salida, COALESCE(NULLIF(TRIM(biometrico_id), ''), id::text) AS employee_no
         FROM expedientes
         WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja'
            OR id IN (SELECT expediente_id FROM asistencia_checadas WHERE fecha_hora >= $1::date AND fecha_hora < ($2::date + 1))
         ORDER BY nombre ASC`,
        [desde, hasta]
      ),
      pool.query(
        `SELECT expediente_id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, hora_entrada, hora_salida, retardo, origen, estado_salida,
                to_char(entrada_ts, 'YYYY-MM-DD"T"HH24:MI') AS entrada_ts, to_char(salida_ts, 'YYYY-MM-DD"T"HH24:MI') AS salida_ts
         FROM asistencia_registros WHERE fecha BETWEEN $1 AND $2`,
        [desde, hasta]
      ),
      pool.query(
        `SELECT expediente_id, to_char(fecha_hora, 'YYYY-MM-DD') AS fecha, count(*)::int AS n
         FROM asistencia_checadas WHERE expediente_id IS NOT NULL AND fecha_hora >= $1::date AND fecha_hora < ($2::date + 1)
         GROUP BY 1, 2`,
        [desde, hasta]
      ),
    ]);

    const regs: Record<string, unknown> = {};
    for (const r of registros.rows) regs[`${r.expediente_id}|${r.fecha}`] = r;
    const ch: Record<string, number> = {};
    for (const c of checadas.rows) ch[`${c.expediente_id}|${c.fecha}`] = c.n;

    const filas = personal.rows.map((p) => {
      const h = horarioDe(p, cfg);
      const dias: Record<string, { registro: unknown; checadas: number }> = {};
      for (let i = 0; i < 7; i++) {
        const d = sumarDiasIso(desde, i);
        dias[d] = { registro: regs[`${p.id}|${d}`] || null, checadas: ch[`${p.id}|${d}`] || 0 };
      }
      return { id: p.id, nombre: p.nombre, puesto: p.puesto, employee_no: p.employee_no, horario: `${h.hora_entrada} – ${h.hora_salida}`, dias };
    });

    return NextResponse.json({ ok: true, desde, hasta, hoy, personal: filas });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo cargar la asistencia semanal." }, { status: 500 });
  }
}
