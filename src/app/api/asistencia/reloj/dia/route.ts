import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sesionAsistencia } from "@/lib/asistenciaDB";
import { ahoraMx, horarioDe } from "@/lib/asistenciaData";
import { dispositivoConfigurado } from "@/lib/biometricoDB";
import { sincronizarReloj } from "@/lib/biometricoSync";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Asistencia del día desde el reloj checador.
// GET ?fecha=YYYY-MM-DD[&sincronizar=1] → personal activo con su registro del día y sus checadas.
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const hoy = ahoraMx().fecha;
    const q = req.nextUrl.searchParams;
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(q.get("fecha") || "") ? (q.get("fecha") as string) : hoy;

    let sync: { ok: boolean; nuevas: number; error: string | null } | null = null;
    if (q.get("sincronizar") === "1" || fecha === hoy) {
      sync = await Promise.race([
        sincronizarReloj(),
        new Promise<{ ok: boolean; nuevas: number; error: string | null }>((r) => setTimeout(() => r({ ok: false, nuevas: 0, error: "La sincronización tardó demasiado; se mostrará lo último guardado." }), 20000)),
      ]);
    }

    const pool = getPool();
    const cfg = await leerConfigAsistencia();
    const [personal, registros, checadas] = await Promise.all([
      pool.query(
        `SELECT id, nombre, puesto, hora_entrada, hora_salida, COALESCE(NULLIF(TRIM(biometrico_id), ''), id::text) AS employee_no
         FROM expedientes
         WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja'
            OR id IN (SELECT expediente_id FROM asistencia_checadas WHERE fecha_hora >= $1::date AND fecha_hora < ($1::date + 1))
         ORDER BY nombre ASC`,
        [fecha]
      ),
      pool.query(
        `SELECT expediente_id, tipo, hora_entrada, hora_salida, retardo, origen, estado_salida, notas,
                to_char(entrada_ts, 'YYYY-MM-DD"T"HH24:MI') AS entrada_ts, to_char(salida_ts, 'YYYY-MM-DD"T"HH24:MI') AS salida_ts
         FROM asistencia_registros WHERE fecha = $1`,
        [fecha]
      ),
      pool.query(
        `SELECT expediente_id, employee_no, nombre_reloj, to_char(fecha_hora, 'HH24:MI:SS') AS hora, metodo
         FROM asistencia_checadas WHERE fecha_hora >= $1::date AND fecha_hora < ($1::date + 1) ORDER BY fecha_hora`,
        [fecha]
      ),
    ]);

    const regPor = new Map(registros.rows.map((r) => [r.expediente_id as number, r]));
    const chPor = new Map<number, { hora: string; metodo: string }[]>();
    const sinExpediente: { employee_no: string; nombre: string | null; hora: string; metodo: string }[] = [];
    for (const c of checadas.rows) {
      if (!c.expediente_id) {
        sinExpediente.push({ employee_no: c.employee_no, nombre: c.nombre_reloj, hora: c.hora, metodo: c.metodo });
        continue;
      }
      const l = chPor.get(c.expediente_id) || [];
      l.push({ hora: c.hora, metodo: c.metodo });
      chPor.set(c.expediente_id, l);
    }

    const filas = personal.rows.map((p) => {
      const h = horarioDe(p, cfg);
      return {
        id: p.id,
        nombre: p.nombre,
        puesto: p.puesto,
        employee_no: p.employee_no,
        horario: `${h.hora_entrada} – ${h.hora_salida}`,
        registro: regPor.get(p.id) || null,
        checadas: chPor.get(p.id) || [],
      };
    });

    const disp = await dispositivoConfigurado();
    return NextResponse.json({
      ok: true,
      fecha,
      hoy,
      tolerancia_min: cfg.tolerancia_min,
      personal: filas,
      sin_expediente: sinExpediente,
      sync,
      reloj: disp ? { ultima_sincronizacion: disp.ultima_sincronizacion, ultimo_error: disp.ultimo_error } : null,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "No se pudo cargar la asistencia del día." }, { status: 500 });
  }
}
