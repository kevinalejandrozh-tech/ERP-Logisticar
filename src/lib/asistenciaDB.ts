import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "./sesion";
import { ASISTENCIA_CONFIG_DEFAULT, AsistenciaConfig } from "./asistenciaData";
import { aplicarSeedViajesSemana40 } from "./viajesSemana40Seed";

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

  // v2: entrada/salida con fecha y hora (turnos que cruzan días), viajes foráneos y salida justificada.
  await p.query(`ALTER TABLE asistencia_registros ADD COLUMN IF NOT EXISTS entrada_ts TIMESTAMP;`);
  await p.query(`ALTER TABLE asistencia_registros ADD COLUMN IF NOT EXISTS salida_ts TIMESTAMP;`);
  await p.query(`ALTER TABLE asistencia_registros ADD COLUMN IF NOT EXISTS estado_destino TEXT;`);
  await p.query(`ALTER TABLE asistencia_registros ADD COLUMN IF NOT EXISTS ruta TEXT;`);
  await p.query(`ALTER TABLE asistencia_registros ADD COLUMN IF NOT EXISTS viaje_id INTEGER;`);
  await p.query(`ALTER TABLE asistencia_registros ADD COLUMN IF NOT EXISTS estado_salida TEXT;`);
  // Registros previos (solo hora): se completa la fecha-hora a partir de la fecha del registro.
  await p.query(`UPDATE asistencia_registros SET entrada_ts = (fecha + hora_entrada::time) WHERE entrada_ts IS NULL AND hora_entrada ~ '^[0-9]{2}:[0-9]{2}$';`);
  await p.query(`UPDATE asistencia_registros SET salida_ts = (fecha + hora_salida::time) WHERE salida_ts IS NULL AND hora_salida ~ '^[0-9]{2}:[0-9]{2}$' AND hora_salida >= COALESCE(hora_entrada, '00:00');`);

  // Horario individual (se define en el expediente). Si está vacío se usa el horario general.
  await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS hora_entrada TEXT;`);
  await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS hora_salida TEXT;`);

  // Reloj checador biométrico (Hikvision, ISAPI por red local).
  // Número de empleado en el reloj: si biometrico_id está vacío se usa el id del expediente.
  await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS biometrico_id TEXT;`);
  await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_expedientes_biometrico_id ON expedientes (biometrico_id) WHERE biometrico_id IS NOT NULL;`);
  // Dispositivos: la contraseña NO se guarda aquí (va en variables de entorno del servidor).
  await p.query(`
    CREATE TABLE IF NOT EXISTS biometrico_dispositivos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL DEFAULT 'Reloj checador',
      ip TEXT NOT NULL,
      usuario TEXT NOT NULL DEFAULT 'admin',
      modelo TEXT,
      serie TEXT,
      firmware TEXT,
      activo BOOLEAN NOT NULL DEFAULT true,
      ultimo_serial BIGINT NOT NULL DEFAULT 0,
      ultima_sincronizacion TIMESTAMPTZ,
      ultimo_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  // Checadas crudas tal como las entrega el reloj (una fila por evento, sin duplicados por serie).
  await p.query(`
    CREATE TABLE IF NOT EXISTS asistencia_checadas (
      id SERIAL PRIMARY KEY,
      dispositivo_id INTEGER NOT NULL REFERENCES biometrico_dispositivos(id) ON DELETE CASCADE,
      serial_no BIGINT NOT NULL,
      employee_no TEXT,
      expediente_id INTEGER REFERENCES expedientes(id) ON DELETE SET NULL,
      nombre_reloj TEXT,
      fecha_hora TIMESTAMP NOT NULL,
      metodo TEXT,
      minor INTEGER,
      estado_reloj TEXT,
      procesada BOOLEAN NOT NULL DEFAULT false,
      resultado TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (dispositivo_id, serial_no)
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_asistencia_checadas_fecha ON asistencia_checadas (fecha_hora);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_asistencia_checadas_expediente ON asistencia_checadas (expediente_id, fecha_hora);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_asistencia_checadas_pendientes ON asistencia_checadas (procesada) WHERE procesada = false;`);

  // Catálogo de rutas con bono por ruta.
  await p.query(`
    CREATE TABLE IF NOT EXISTS rutas (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      estado_destino TEXT,
      bono NUMERIC NOT NULL DEFAULT 0,
      activa BOOLEAN NOT NULL DEFAULT true,
      notas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // Bono por ruta según la unidad (ECO). Si la unidad no tiene uno propio se usa el bono general de la ruta.
  await p.query(`
    CREATE TABLE IF NOT EXISTS rutas_bonos_unidad (
      ruta_id INTEGER NOT NULL REFERENCES rutas(id) ON DELETE CASCADE,
      eco TEXT NOT NULL,
      bono NUMERIC NOT NULL DEFAULT 0,
      PRIMARY KEY (ruta_id, eco)
    );
  `);

  // Calendario de viajes por unidad (ECO).
  await p.query(`
    CREATE TABLE IF NOT EXISTS viajes_calendario (
      id SERIAL PRIMARY KEY,
      eco TEXT NOT NULL,
      fecha DATE NOT NULL,
      datos JSONB NOT NULL DEFAULT '{}'::jsonb,
      operador_id INTEGER REFERENCES expedientes(id) ON DELETE SET NULL,
      ayudante_id INTEGER REFERENCES expedientes(id) ON DELETE SET NULL,
      registrado_por TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_viajes_calendario_fecha ON viajes_calendario (fecha);`);
  // Catálogo de clientes (Nombre cuenta): lo que se captura en un viaje y no existe se agrega solo.
  await p.query(`CREATE TABLE IF NOT EXISTS clientes_catalogo (id SERIAL PRIMARY KEY, nombre TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now());`);
  await p.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_catalogo_nombre ON clientes_catalogo (LOWER(nombre));`);

  // Vacaciones: ajustes por persona y año de servicio (días, prima, saldos y comentarios).
  await p.query(`
    CREATE TABLE IF NOT EXISTS vacaciones_ajustes (
      expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
      anio_servicio INTEGER NOT NULL,
      dias_derecho NUMERIC,
      dias_pago NUMERIC,
      porcentaje_prima NUMERIC NOT NULL DEFAULT 25,
      salario_diario NUMERIC,
      monto_final NUMERIC,
      saldo_favor NUMERIC NOT NULL DEFAULT 0,
      saldo_pendiente NUMERIC NOT NULL DEFAULT 0,
      comentarios TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (expediente_id, anio_servicio)
    );
  `);

  // Datos de ruta: origen/destino, km, tiempos estimados y catálogos asociados (ids de catalogos_ruta).
  for (const col of [
    "origen TEXT",
    "destino TEXT",
    "km NUMERIC",
    "horas_ida NUMERIC",
    "horas_regreso_vacio NUMERIC",
    "horas_regreso_devolucion NUMERIC",
    "casetas JSONB NOT NULL DEFAULT '[]'::jsonb",
    "resguardos JSONB NOT NULL DEFAULT '[]'::jsonb",
    "alimentos JSONB NOT NULL DEFAULT '[]'::jsonb",
    "gasolineras JSONB NOT NULL DEFAULT '[]'::jsonb",
  ]) {
    await p.query(`ALTER TABLE rutas ADD COLUMN IF NOT EXISTS ${col};`);
  }

  // Configuración de la semana SOLO para el Calendario de viajes (no afecta Asistencia, Nómina ni otras páginas).
  // dia_inicio / dia_fin: 0 = domingo … 6 = sábado.
  await p.query(`
    CREATE TABLE IF NOT EXISTS viajes_calendario_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      dia_inicio INTEGER NOT NULL DEFAULT 1,
      dia_fin INTEGER NOT NULL DEFAULT 0,
      actualizado_por TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CHECK (id = 1)
    );
  `);

  // Carga única de la Semana 40 (PDF) al calendario de viajes. No interrumpe el esquema si falla.
  await aplicarSeedViajesSemana40();
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

// Columnas de asistencia_registros en el formato que usa el calendario.
export const SELECT_REGISTRO = `expediente_id, to_char(fecha, 'YYYY-MM-DD') AS fecha, tipo, hora_entrada, hora_salida, retardo, origen, notas,
  to_char(entrada_ts, 'YYYY-MM-DD"T"HH24:MI') AS entrada_ts, to_char(salida_ts, 'YYYY-MM-DD"T"HH24:MI') AS salida_ts,
  estado_destino, ruta, viaje_id, estado_salida`;

// Bono de una ruta para una unidad: el bono propio de la unidad o, si no tiene, el bono general de la ruta.
export async function leerBonosRuta(): Promise<(ruta: string | null | undefined, eco: string | null | undefined) => number> {
  const pool = getPool();
  const r = await pool.query(`SELECT id, lower(nombre) AS nombre, bono FROM rutas`);
  const u = await pool.query(`SELECT ruta_id, eco, bono FROM rutas_bonos_unidad`);
  const general = new Map<string, number>();
  const porId = new Map<number, string>();
  for (const x of r.rows) {
    general.set(x.nombre, Number(x.bono) || 0);
    porId.set(x.id, x.nombre);
  }
  const porUnidad = new Map<string, number>();
  for (const x of u.rows) porUnidad.set(`${porId.get(x.ruta_id)}|${String(x.eco).toLowerCase()}`, Number(x.bono) || 0);
  return (ruta, eco) => {
    const n = String(ruta || "").trim().toLowerCase();
    if (!n) return 0;
    const k = `${n}|${String(eco || "").toLowerCase()}`;
    return porUnidad.has(k) ? porUnidad.get(k)! : general.get(n) || 0;
  };
}
