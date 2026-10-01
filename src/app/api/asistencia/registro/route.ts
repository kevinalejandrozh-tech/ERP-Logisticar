import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sincronizarAsistenciaDiaria } from "@/lib/asistenciaDB";
import { ahoraMx, evaluarJornada, horarioDe } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Ruta PÚBLICA usada por la página del código QR (sin cuenta).
// GET: solo nombres del personal activo.
// POST: si la persona tiene un turno abierto (entrada sin salida, últimas 36 h) registra la SALIDA
//       —aunque sea otro día (turnos seguidos)—; si no, registra la ENTRADA de hoy.
// La fecha y la hora siempre las pone el servidor (zona horaria de la empresa).

export async function GET() {
  try {
    await ensureAsistenciaSchema();
    const r = await getPool().query(`SELECT id, nombre FROM expedientes WHERE COALESCE(estatus_laboral, 'Activo') != 'Baja' ORDER BY nombre ASC`);
    return NextResponse.json({ ok: true, personas: r.rows });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la lista del personal." }, { status: 500 });
  }
}

const minutosEntre = (a: string, b: string) => (new Date(b + ":00Z").getTime() - new Date(a + ":00Z").getTime()) / 60000;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const expedienteId = Number(body.expediente_id);
    if (!expedienteId) return NextResponse.json({ error: "Selecciona tu nombre." }, { status: 400 });
    await ensureAsistenciaSchema();
    const pool = getPool();
    const emp = await pool.query(
      `SELECT id, nombre, hora_entrada, hora_salida FROM expedientes WHERE id = $1 AND COALESCE(estatus_laboral, 'Activo') != 'Baja'`,
      [expedienteId]
    );
    if (!emp.rows[0]) return NextResponse.json({ error: "No se encontró tu nombre en el personal activo." }, { status: 404 });
    const nombre = emp.rows[0].nombre as string;
    const { fecha, hora } = ahoraMx();
    const ahora = `${fecha}T${hora}`;
    const cfg = await leerConfigAsistencia();
    const h = horarioDe(emp.rows[0], cfg);

    // Turno abierto o registro completo más reciente (hasta 36 h atrás).
    const ult = await pool.query(
      `SELECT to_char(fecha, 'YYYY-MM-DD') AS fecha, to_char(entrada_ts, 'YYYY-MM-DD"T"HH24:MI') AS entrada,
              to_char(salida_ts, 'YYYY-MM-DD"T"HH24:MI') AS salida
       FROM asistencia_registros
       WHERE expediente_id = $1 AND tipo = 'Asistencia' AND entrada_ts IS NOT NULL
         AND entrada_ts >= ($2::timestamp - interval '36 hours') AND entrada_ts <= $2::timestamp
       ORDER BY entrada_ts DESC LIMIT 1`,
      [expedienteId, ahora]
    );
    const r = ult.rows[0] as { fecha: string; entrada: string; salida: string | null } | undefined;
    const abierto = r && !r.salida;
    const completoHoy = r && r.salida && r.fecha === fecha;

    if (abierto || completoHoy) {
      if (minutosEntre(r!.salida || r!.entrada, ahora) < cfg.minutos_entre_registros) {
        return NextResponse.json({ ok: true, accion: "duplicado", nombre, hora: (r!.salida || r!.entrada).slice(11), fecha });
      }
      const ev = evaluarJornada(r!.entrada, ahora, h);
      await pool.query(
        `UPDATE asistencia_registros SET salida_ts = $3, hora_salida = $4, estado_salida = $5, origen = 'QR', updated_at = now()
         WHERE expediente_id = $1 AND fecha = $2`,
        [expedienteId, r!.fecha, ahora, hora, ev.estado_salida]
      );
      return NextResponse.json({ ok: true, accion: "salida", nombre, hora, fecha, estado_salida: ev.estado_salida });
    }

    const ev = evaluarJornada(ahora, null, h);
    await pool.query(
      `INSERT INTO asistencia_registros (expediente_id, fecha, tipo, hora_entrada, hora_salida, entrada_ts, salida_ts, retardo, estado_salida, origen, registrado_por)
       VALUES ($1, $2, 'Asistencia', $3, NULL, $4, NULL, $5, NULL, 'QR', 'QR')
       ON CONFLICT (expediente_id, fecha) DO UPDATE SET tipo = 'Asistencia', hora_entrada = $3, hora_salida = NULL, entrada_ts = $4, salida_ts = NULL,
         retardo = $5, estado_salida = NULL, estado_destino = NULL, ruta = NULL, viaje_id = NULL, origen = 'QR', registrado_por = 'QR', updated_at = now()`,
      [expedienteId, fecha, hora, ahora, ev.retardo]
    );
    await sincronizarAsistenciaDiaria(expedienteId, fecha, "Asistencia");
    return NextResponse.json({ ok: true, accion: "entrada", nombre, hora, fecha, retardo: ev.retardo });
  } catch {
    return NextResponse.json({ error: "No se pudo registrar la asistencia. Intenta de nuevo." }, { status: 500 });
  }
}
