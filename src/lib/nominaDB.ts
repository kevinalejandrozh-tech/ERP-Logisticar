import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "./sesion";
import { CONFIG_DEFAULT, NominaConfig, aNumero } from "./nominaCalculo";

// Esquema propio del módulo "Nómina" (Personas).
// Se mantiene separado de db.ts para no tocar las tablas de los demás módulos.
// Nota: las tablas antiguas empleados_* de db.ts no se usan ni se modifican aquí.

let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  await ensureSchema(); // garantiza que exista expedientes / asistencia_diaria
  const p = getPool();

  // ---------- Fase 1 ----------
  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_config (
      id INTEGER PRIMARY KEY DEFAULT 1,
      dias_base NUMERIC NOT NULL DEFAULT 7,
      retardos_por_falta INTEGER NOT NULL DEFAULT 3,
      empresa TEXT NOT NULL DEFAULT 'Transportes Logisticar',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`INSERT INTO nomina_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;`);

  // Sueldo semanal vigente por persona (se precarga del sueldo ofertado del expediente).
  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_empleados (
      expediente_id INTEGER PRIMARY KEY REFERENCES expedientes(id) ON DELETE CASCADE,
      sueldo_semanal NUMERIC NOT NULL DEFAULT 0,
      incluir BOOLEAN NOT NULL DEFAULT true,
      notas TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_periodos (
      id SERIAL PRIMARY KEY,
      anio INTEGER NOT NULL,
      semana INTEGER NOT NULL,
      fecha_inicio DATE NOT NULL,
      fecha_fin DATE NOT NULL,
      estado TEXT NOT NULL DEFAULT 'Abierta',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (anio, semana)
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_registros (
      id SERIAL PRIMARY KEY,
      periodo_id INTEGER NOT NULL REFERENCES nomina_periodos(id) ON DELETE CASCADE,
      expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
      folio TEXT NOT NULL,
      nombre TEXT NOT NULL,
      puesto TEXT,
      sueldo_semanal NUMERIC NOT NULL DEFAULT 0,
      dias_asistidos NUMERIC NOT NULL DEFAULT 0,
      faltas NUMERIC NOT NULL DEFAULT 0,
      retardos NUMERIC NOT NULL DEFAULT 0,
      bonos NUMERIC NOT NULL DEFAULT 0,
      otros_incentivos NUMERIC NOT NULL DEFAULT 0,
      incentivos_detalle TEXT,
      licencia_federal NUMERIC NOT NULL DEFAULT 0,
      imss NUMERIC NOT NULL DEFAULT 0,
      caja_ahorro NUMERIC NOT NULL DEFAULT 0,
      prestamo NUMERIC NOT NULL DEFAULT 0,
      otros_descuentos NUMERIC NOT NULL DEFAULT 0,
      otros_descuentos_detalle TEXT,
      salario_diario NUMERIC NOT NULL DEFAULT 0,
      faltas_equivalentes NUMERIC NOT NULL DEFAULT 0,
      descuento_faltas NUMERIC NOT NULL DEFAULT 0,
      total_percepciones NUMERIC NOT NULL DEFAULT 0,
      total_deducciones NUMERIC NOT NULL DEFAULT 0,
      neto NUMERIC NOT NULL DEFAULT 0,
      observaciones TEXT,
      capturado_por TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (periodo_id, expediente_id)
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_nomina_registros_exp ON nomina_registros (expediente_id);`);

  // ---------- Fase 2 (estructura lista, sin pantalla todavía) ----------
  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_prestamos (
      id SERIAL PRIMARY KEY,
      expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
      concepto TEXT NOT NULL DEFAULT 'Préstamo personal',
      monto_total NUMERIC NOT NULL,
      abono_semanal NUMERIC NOT NULL,
      saldo NUMERIC NOT NULL,
      fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
      estado TEXT NOT NULL DEFAULT 'Activo',
      notas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_prestamo_abonos (
      id SERIAL PRIMARY KEY,
      prestamo_id INTEGER NOT NULL REFERENCES nomina_prestamos(id) ON DELETE CASCADE,
      registro_id INTEGER REFERENCES nomina_registros(id) ON DELETE SET NULL,
      periodo_id INTEGER REFERENCES nomina_periodos(id) ON DELETE SET NULL,
      importe NUMERIC NOT NULL,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS nomina_caja_ahorro (
      id SERIAL PRIMARY KEY,
      expediente_id INTEGER NOT NULL REFERENCES expedientes(id) ON DELETE CASCADE,
      registro_id INTEGER REFERENCES nomina_registros(id) ON DELETE SET NULL,
      periodo_id INTEGER REFERENCES nomina_periodos(id) ON DELETE SET NULL,
      tipo TEXT NOT NULL DEFAULT 'Aportacion',
      importe NUMERIC NOT NULL,
      fecha DATE NOT NULL DEFAULT CURRENT_DATE,
      notas TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_nomina_prestamos_exp ON nomina_prestamos (expediente_id);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_nomina_caja_exp ON nomina_caja_ahorro (expediente_id);`);
}

export function ensureNominaSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((err) => {
      esquemaListo = null;
      throw err;
    });
  }
  return esquemaListo;
}

export async function leerConfigNomina(): Promise<NominaConfig> {
  const r = await getPool().query(`SELECT dias_base, retardos_por_falta, empresa FROM nomina_config WHERE id = 1`);
  const f = r.rows[0];
  if (!f) return CONFIG_DEFAULT;
  return { dias_base: aNumero(f.dias_base) || 7, retardos_por_falta: Number(f.retardos_por_falta) || 0, empresa: f.empresa || CONFIG_DEFAULT.empresa };
}

// La nómina es información sensible: solo usuarios con permisos administrativos (el middleware ya excluye supervisor_tms).
export async function sesionNomina(req: NextRequest): Promise<{ nombre: string } | NextResponse> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarTokenSesion(token) : null;
  if (!sesion || !tienePermisosAdmin(sesion.rol)) {
    return NextResponse.json({ error: "No tienes permisos para la nómina." }, { status: 403 });
  }
  return { nombre: sesion.nombre };
}

export function errorJson(err: unknown, mensaje: string) {
  const texto = err instanceof Error ? err.message : mensaje;
  return NextResponse.json({ error: texto || mensaje }, { status: 500 });
}
