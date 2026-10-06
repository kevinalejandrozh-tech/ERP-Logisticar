import { getPool } from "./db";

// Configuración global del sistema (modo mantenimiento) y preferencias personales por usuario.
let esquemaListo: Promise<void> | null = null;

async function crear() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS sistema_config (
      clave TEXT PRIMARY KEY,
      valor JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS usuario_preferencias (
      usuario_id INTEGER NOT NULL,
      clave TEXT NOT NULL,
      valor JSONB NOT NULL DEFAULT 'null'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (usuario_id, clave)
    );
  `);
}
export function ensureSistemaSchema(): Promise<void> {
  if (!esquemaListo) esquemaListo = crear().catch((e) => ((esquemaListo = null), Promise.reject(e)));
  return esquemaListo;
}

export const CLAVES_PREFERENCIAS = ["inicio_orden", "notif_max", "notas_min"];
export const OPCIONES_NOTIF_MAX = [10, 25, 50, 100, 200];

export async function leerPreferencia<T>(usuarioId: number, clave: string, defecto: T): Promise<T> {
  await ensureSistemaSchema();
  const r = await getPool().query(`SELECT valor FROM usuario_preferencias WHERE usuario_id = $1 AND clave = $2`, [usuarioId, clave]);
  return r.rowCount ? (r.rows[0].valor as T) : defecto;
}
