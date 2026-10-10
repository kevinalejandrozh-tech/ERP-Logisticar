// Reloj checador biométrico — acceso a datos (servidor).
import { getPool } from "./db";
import { ensureAsistenciaSchema } from "./asistenciaDB";
import { credencialesReloj, infoDispositivo } from "./hikvision";
import type { BiometricoDispositivo } from "./biometricoData";

// Registro del dispositivo configurado en el servidor (se crea la primera vez a partir de BIOMETRICO_IP).
export async function dispositivoConfigurado(): Promise<BiometricoDispositivo | null> {
  await ensureAsistenciaSchema();
  const cred = credencialesReloj();
  if (!cred) return null;
  const pool = getPool();
  const sel = `SELECT id, nombre, ip, usuario, modelo, serie, firmware, activo, ultimo_serial::float8 AS ultimo_serial,
                      ultima_sincronizacion, ultimo_error FROM biometrico_dispositivos WHERE ip = $1 ORDER BY id LIMIT 1`;
  let r = await pool.query(sel, [cred.ip]);
  if (!r.rows[0]) {
    await pool.query(`INSERT INTO biometrico_dispositivos (ip, usuario) VALUES ($1, $2)`, [cred.ip, cred.usuario]);
    r = await pool.query(sel, [cred.ip]);
  }
  return r.rows[0] as BiometricoDispositivo;
}

// Actualiza modelo/serie/firmware (o el último error) del dispositivo.
export async function refrescarInfoDispositivo(id: number): Promise<string | null> {
  const pool = getPool();
  try {
    const info = await infoDispositivo();
    await pool.query(`UPDATE biometrico_dispositivos SET modelo = $2, serie = $3, firmware = $4, ultimo_error = NULL, updated_at = now() WHERE id = $1`, [
      id,
      info.modelo,
      info.serie,
      info.firmware,
    ]);
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error desconocido";
    await pool.query(`UPDATE biometrico_dispositivos SET ultimo_error = $2, updated_at = now() WHERE id = $1`, [id, msg]);
    return msg;
  }
}

export type PersonaReloj = { id: number; nombre: string; puesto: string | null; estatus: string; employee_no: string };

// Personal (activos y bajas) con su número de empleado en el reloj.
export async function personalParaReloj(): Promise<PersonaReloj[]> {
  await ensureAsistenciaSchema();
  const r = await getPool().query(
    `SELECT id, nombre, puesto, COALESCE(estatus_laboral, 'Activo') AS estatus,
            COALESCE(NULLIF(TRIM(biometrico_id), ''), id::text) AS employee_no
     FROM expedientes ORDER BY nombre ASC`
  );
  return r.rows as PersonaReloj[];
}
