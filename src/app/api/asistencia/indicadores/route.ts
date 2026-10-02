import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";
import { TIPOS_TRABAJADOS, ahoraMx } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Indicadores de asistencia y puntualidad de una persona, calculados con los registros del módulo Asistencia
// (año en curso, desde el 1 de enero o la fecha de ingreso si es posterior, hasta hoy).
// - Asistencia = días trabajados ÷ (días trabajados + faltas).
// - Puntualidad = asistencias sin retardo ÷ asistencias registradas.
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("expediente_id"));
    if (!id) return NextResponse.json({ error: "Falta el expediente." }, { status: 400 });
    await ensureAsistenciaSchema();
    const hoy = ahoraMx().fecha;
    const pool = getPool();
    const e = await pool.query(`SELECT to_char(fecha_ingreso, 'YYYY-MM-DD') AS ingreso FROM expedientes WHERE id = $1`, [id]);
    if (!e.rows[0]) return NextResponse.json({ error: "El expediente no existe." }, { status: 404 });
    const inicioAnio = `${hoy.slice(0, 4)}-01-01`;
    const desde = e.rows[0].ingreso && e.rows[0].ingreso > inicioAnio ? e.rows[0].ingreso : inicioAnio;
    const r = await pool.query(
      `SELECT tipo, COUNT(*)::int AS dias, COUNT(*) FILTER (WHERE retardo)::int AS retardos
       FROM asistencia_registros WHERE expediente_id = $1 AND fecha BETWEEN $2 AND $3 GROUP BY tipo`,
      [id, desde, hoy]
    );
    const por = (t: string) => r.rows.find((x) => x.tipo === t) || { dias: 0, retardos: 0 };
    const trabajados = TIPOS_TRABAJADOS.reduce((a, t) => a + por(t).dias, 0);
    const faltas = por("Falta").dias;
    const asistencias = por("Asistencia").dias;
    const retardos = por("Asistencia").retardos;
    const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 1000) / 10 : null);
    return NextResponse.json({
      ok: true,
      desde,
      hasta: hoy,
      asistencia: pct(trabajados, trabajados + faltas),
      puntualidad: pct(asistencias - retardos, asistencias),
      trabajados,
      faltas,
      retardos,
      vacaciones: por("Vacaciones").dias,
      permisos: por("Permiso").dias,
      incapacidades: por("Incapacidad").dias,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al calcular los indicadores." }, { status: 500 });
  }
}
