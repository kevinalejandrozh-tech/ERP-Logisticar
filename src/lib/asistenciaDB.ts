import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "./sesion";
import { ASISTENCIA_CONFIG_DEFAULT, AsistenciaConfig } from "./asistenciaData";

// Esquema propio del módulo "Asistencia" (registro por QR y calendario).
// Se mantiene separado de db.ts. La tabla antigua asistencia_diaria se sigue alimentando
// (presente sí/no) para que el módulo "Asistencia diaria" existente no pierda información.

let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  await ensureSchema();
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS asistencia_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      hora_entrada TEXT NOT NULL DEFAULT '08:00',
      hora_salida TEXT NOT NULL DEFAULT '17:00',
      tolerancia_min INTEGER NOT NULL DEFAULT 10,
      minutos_entre_registros INTEGER NOT NULL DEFAULT 2,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`INSERT INTO asistencia_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);
  await p.query(`
    CREATE TABLE IF NOT EXISTS asistencia_registros (
      id SERIAL PRIMARY KEY,
      expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
      fecha DATE NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Asistencia',
      hora_entrada TEXT,
      hora_salida TEXT,
      retardo BOOLEAN NOT NULL DEFAULT false,
      origen TEXT NOT NULL DEFAULT 'Manual',
      notas TEXT,
      registrado_por TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (expediente_id, fecha)
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_asistencia_registros_fecha ON asistencia_registros (fecha);`);
}

export function ensureAsistenciaSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((err) => {
      esquemaListo = null;
      throw err;
    });
  }
  return esquemaListo;
}

export async function leerConfigAsistencia(): Promise<AsistenciaConfig> {
  const r = await getPool().query(`SELECT hora_entrada, hora_salida, tolerancia_min, minutos_entre_registros FROM asistencia_config WHERE id = 1`);
  const f = r.rows[0];
  if (!f) return ASISTENCIA_CONFIG_DEFAULT;
  return {
    hora_entrada: f.hora_entrada || "08:00",
    hora_salida: f.hora_salida || "17:00",
    tolerancia_min: Number(f.tolerancia_min) || 0,
    minutos_entre_registros: Number(f.minutos_entre_registros) || 0,
  };
}

// Mantiene sincronizado el módulo antiguo "Asistencia diaria" (presente sí/no).
export async function sincronizarAsistenciaDiaria(expedienteId: number, fecha: string, tipo: string) {
  const pool = getPool();
  if (tipo === "Asistencia" || tipo === "Falta") {
    await pool.query(
      `INSERT INTO asistencia_diaria (expediente_id, fecha, presente) VALUES ($1, $2, $3)
       ON CONFLICT (expediente_id, fecha) DO UPDATE SET presente = $3`,
      [expedienteId, fecha, tipo === "Asistencia"]
    );
  }
}

// Solo usuarios con permisos administrativos administran el calendario (el middleware ya excluye supervisor_tms).
export async function sesionAsistencia(req: NextRequest): Promise<{ nombre: string } | NextResponse> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarTokenSesion(token) : null;
  if (!sesion || !tienePermisosAdmin(sesion.rol)) {
    return NextResponse.json({ error: "No tienes permisos para la asistencia." }, { status: 403 });
  }
  return { nombre: sesion.nombre };
}
