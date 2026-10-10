// Reloj checador — sincronización de checadas (servidor).
// Lee los eventos del reloj por ISAPI, los guarda en asistencia_checadas y arma la asistencia del día:
//   1ª checada del día = ENTRADA · última checada del día (2ª en adelante) = SALIDA.
// No sobrescribe registros capturados a mano ni días con otro tipo (vacaciones, viaje, falta, permiso…).
import { randomBytes } from "crypto";
import { getPool } from "./db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sincronizarAsistenciaDiaria } from "./asistenciaDB";
import { evaluarJornada, horarioDe, type AsistenciaConfig } from "./asistenciaData";
import { dispositivoConfigurado } from "./biometricoDB";
import { MINOR_CHECADA, fechaLocalDeEvento, metodoDeMinor } from "./biometricoData";
import { isapi } from "./hikvision";

type Evento = {
  time: string;
  employeeNoString?: string;
  employeeNo?: number | string;
  name?: string;
  serialNo: number;
  minor: number;
  attendanceStatus?: string;
};

export type ResultadoSync = { ok: boolean; nuevas: number; dias: number; error: string | null };

const OFFSET_MX = "-06:00"; // México sin horario de verano desde 2022

async function eventosRango(inicio: string, fin: string, minor: number): Promise<Evento[]> {
  const todos: Evento[] = [];
  const searchID = randomBytes(6).toString("hex");
  for (let pos = 0; pos < 150000; ) {
    const r = await isapi<{ AcsEvent?: { responseStatusStrg?: string; InfoList?: Evento[] } }>("POST", "/ISAPI/AccessControl/AcsEvent?format=json", {
      AcsEventCond: { searchID, searchResultPosition: pos, maxResults: 30, major: 5, minor, startTime: inicio, endTime: fin },
    });
    const lote = r.AcsEvent?.InfoList || [];
    todos.push(...lote);
    pos += lote.length;
    if (!lote.length || r.AcsEvent?.responseStatusStrg !== "MORE") break;
  }
  return todos;
}

const minutosEntre = (a: string, b: string) => (new Date(b + "Z").getTime() - new Date(a + "Z").getTime()) / 60000;

// Recalcula la asistencia de una persona en un día a partir de sus checadas.
export async function recalcularDia(expedienteId: number, fecha: string, cfg: AsistenciaConfig): Promise<string> {
  const pool = getPool();
  const ch = await pool.query(
    `SELECT to_char(fecha_hora, 'YYYY-MM-DD"T"HH24:MI:SS') AS t FROM asistencia_checadas
     WHERE expediente_id = $1 AND fecha_hora >= $2::date AND fecha_hora < ($2::date + 1) ORDER BY fecha_hora`,
    [expedienteId, fecha]
  );
  // Descarta checadas repetidas en pocos minutos (doble lectura accidental).
  const separacion = Math.max(1, cfg.minutos_entre_registros || 0);
  const marcas: string[] = [];
  for (const { t } of ch.rows as { t: string }[]) {
    if (!marcas.length || minutosEntre(marcas[marcas.length - 1], t) >= separacion) marcas.push(t);
  }
  if (!marcas.length) return "Sin checadas";

  const marcar = (resultado: string) =>
    pool.query(
      `UPDATE asistencia_checadas SET procesada = true, resultado = $3
       WHERE expediente_id = $1 AND fecha_hora >= $2::date AND fecha_hora < ($2::date + 1)`,
      [expedienteId, fecha, resultado]
    );

  const ex = await pool.query(`SELECT tipo, origen FROM asistencia_registros WHERE expediente_id = $1 AND fecha = $2`, [expedienteId, fecha]);
  const previo = ex.rows[0] as { tipo: string; origen: string } | undefined;
  if (previo && (previo.tipo !== "Asistencia" || previo.origen === "Manual")) {
    const r = `Se conservó el registro existente (${previo.tipo}${previo.origen === "Manual" ? ", manual" : ""})`;
    await marcar(r);
    return r;
  }

  const entrada = marcas[0].slice(0, 16);
  const salida = marcas.length > 1 ? marcas[marcas.length - 1].slice(0, 16) : null;
  const emp = await pool.query(`SELECT hora_entrada, hora_salida FROM expedientes WHERE id = $1`, [expedienteId]);
  const ev = evaluarJornada(entrada, salida, horarioDe(emp.rows[0], cfg));

  await pool.query(
    `INSERT INTO asistencia_registros (expediente_id, fecha, tipo, hora_entrada, hora_salida, entrada_ts, salida_ts, retardo, estado_salida, origen, registrado_por)
     VALUES ($1, $2, 'Asistencia', $3, $4, $5, $6, $7, $8, 'Biométrico', 'Reloj checador')
     ON CONFLICT (expediente_id, fecha) DO UPDATE SET tipo = 'Asistencia', hora_entrada = $3, hora_salida = $4, entrada_ts = $5, salida_ts = $6,
       retardo = $7, estado_salida = $8, origen = 'Biométrico', registrado_por = 'Reloj checador', updated_at = now()
     WHERE asistencia_registros.tipo = 'Asistencia' AND asistencia_registros.origen <> 'Manual'`,
    [expedienteId, fecha, entrada.slice(11, 16), salida ? salida.slice(11, 16) : null, entrada, salida, ev.retardo, ev.estado_salida]
  );
  await sincronizarAsistenciaDiaria(expedienteId, fecha, "Asistencia");
  const r = salida ? "Entrada y salida registradas" : "Entrada registrada";
  await marcar(r);
  return r;
}

let enCurso: Promise<ResultadoSync> | null = null;

// Descarga las checadas nuevas del reloj y actualiza la asistencia. Una sola ejecución a la vez.
export function sincronizarReloj(): Promise<ResultadoSync> {
  if (!enCurso) enCurso = ejecutarSync().finally(() => (enCurso = null));
  return enCurso;
}

async function ejecutarSync(): Promise<ResultadoSync> {
  await ensureAsistenciaSchema();
  const disp = await dispositivoConfigurado();
  if (!disp) return { ok: false, nuevas: 0, dias: 0, error: "Reloj no configurado" };
  const pool = getPool();
  try {
    // Ventana: desde la última sincronización (−2 h de margen) o los últimos 7 días la primera vez.
    const v = await pool.query(
      `SELECT to_char((COALESCE(ultima_sincronizacion, now() - interval '7 days') - interval '2 hours') AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD"T"HH24:MI:SS') AS inicio,
              to_char((now() + interval '1 day') AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD"T"HH24:MI:SS') AS fin
       FROM biometrico_dispositivos WHERE id = $1`,
      [disp.id]
    );
    const inicio = v.rows[0].inicio + OFFSET_MX;
    const fin = v.rows[0].fin + OFFSET_MX;

    const eventos: Evento[] = [];
    for (const minor of Object.keys(MINOR_CHECADA).map(Number)) eventos.push(...(await eventosRango(inicio, fin, minor)));

    // Número de empleado del reloj → expediente.
    const mapa = new Map<string, number>();
    const ex = await pool.query(`SELECT id, COALESCE(NULLIF(TRIM(biometrico_id), ''), id::text) AS emp FROM expedientes`);
    for (const r of ex.rows as { id: number; emp: string }[]) mapa.set(r.emp, r.id);

    const afectados = new Set<string>();
    let nuevas = 0;
    let maxSerial = Number(disp.ultimo_serial) || 0;
    for (const e of eventos) {
      const emp = String(e.employeeNoString ?? e.employeeNo ?? "").trim();
      if (!emp || !e.time) continue;
      const fechaHora = fechaLocalDeEvento(e.time);
      const expId = mapa.get(emp) ?? null;
      const ins = await pool.query(
        `INSERT INTO asistencia_checadas (dispositivo_id, serial_no, employee_no, expediente_id, nombre_reloj, fecha_hora, metodo, minor, estado_reloj, resultado, procesada)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (dispositivo_id, serial_no) DO NOTHING`,
        [disp.id, e.serialNo, emp, expId, e.name || null, fechaHora, metodoDeMinor(e.minor), e.minor, e.attendanceStatus || null, expId ? null : "Sin expediente", !expId]
      );
      if (ins.rowCount) {
        nuevas++;
        if (expId) afectados.add(`${expId}|${fechaHora.slice(0, 10)}`);
      }
      if (e.serialNo > maxSerial) maxSerial = e.serialNo;
    }

    const cfg = await leerConfigAsistencia();
    for (const clave of afectados) {
      const [id, fecha] = clave.split("|");
      await recalcularDia(Number(id), fecha, cfg);
    }

    await pool.query(
      `UPDATE biometrico_dispositivos SET ultima_sincronizacion = now(), ultimo_serial = GREATEST(ultimo_serial, $2), ultimo_error = NULL, updated_at = now() WHERE id = $1`,
      [disp.id, maxSerial]
    );
    return { ok: true, nuevas, dias: afectados.size, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al sincronizar";
    await pool.query(`UPDATE biometrico_dispositivos SET ultimo_error = $2, updated_at = now() WHERE id = $1`, [disp.id, msg]).catch(() => {});
    return { ok: false, nuevas: 0, dias: 0, error: msg };
  }
}
