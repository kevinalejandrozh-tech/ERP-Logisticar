import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "./sesion";
import { CONFIG_DEFAULT, CreditoEstado, NominaConfig, aNumero, redondear, semanasRestantes } from "./nominaCalculo";
import { semanaIso, sumarDiasIso } from "./asistenciaData";

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

  // ---------- v2: conceptos por persona, sueldo base (depósito BBVA) y viáticos ----------
  await p.query(`ALTER TABLE nomina_empleados ADD COLUMN IF NOT EXISTS sueldo_base NUMERIC NOT NULL DEFAULT 2310;`);
  await p.query(`ALTER TABLE nomina_empleados ADD COLUMN IF NOT EXISTS imss NUMERIC NOT NULL DEFAULT 75;`);
  await p.query(`ALTER TABLE nomina_empleados ADD COLUMN IF NOT EXISTS caja_ahorro NUMERIC NOT NULL DEFAULT 100;`);
  await p.query(`ALTER TABLE nomina_empleados ADD COLUMN IF NOT EXISTS fonacot NUMERIC NOT NULL DEFAULT 0;`);
  await p.query(`ALTER TABLE nomina_empleados ADD COLUMN IF NOT EXISTS infonavit NUMERIC NOT NULL DEFAULT 0;`);
  await p.query(`ALTER TABLE nomina_periodos ADD COLUMN IF NOT EXISTS sueldo_base NUMERIC;`);
  for (const col of ["sueldo_base", "fonacot", "infonavit", "deposito_bbva", "deposito_viaticos", "bonos_ruta"]) {
    await p.query(`ALTER TABLE nomina_registros ADD COLUMN IF NOT EXISTS ${col} NUMERIC NOT NULL DEFAULT 0;`);
  }
  await p.query(`ALTER TABLE nomina_registros ADD COLUMN IF NOT EXISTS creditos JSONB NOT NULL DEFAULT '[]'::jsonb;`);

  // ---------- Fase 2: créditos (licencia federal, préstamos) y caja de ahorro ----------
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
  await p.query(`ALTER TABLE nomina_prestamo_abonos ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Semanal';`);
  await p.query(`ALTER TABLE nomina_prestamo_abonos ADD COLUMN IF NOT EXISTS notas TEXT;`);
  await p.query(`ALTER TABLE nomina_prestamo_abonos ADD COLUMN IF NOT EXISTS registrado_por TEXT;`);
  await p.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_nomina_abono_semanal ON nomina_prestamo_abonos (prestamo_id, periodo_id) WHERE tipo = 'Semanal';`
  );
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

// Estado de los créditos (licencia federal / préstamos) de varias personas a la fecha de corte de una semana.
// - pagado/pagos: abonos semanales de semanas que terminan en o antes del corte + extraordinarios con fecha ≤ corte.
// - abono_semana: abono semanal ya guardado en esa semana, o la propuesta (abono pactado, sin exceder el saldo).
export async function estadoCreditos(
  expedienteIds: number[],
  corte: { periodo_id: number | null; desde: string; hasta: string }
): Promise<Map<number, CreditoEstado[]>> {
  const mapa = new Map<number, CreditoEstado[]>();
  if (!expedienteIds.length) return mapa;
  const pool = getPool();
  const cr = await pool.query(
    `SELECT id, expediente_id, concepto, monto_total, abono_semanal, saldo, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, estado, notas
     FROM nomina_prestamos WHERE expediente_id = ANY($1::int[]) AND estado != 'Cancelado' ORDER BY fecha_inicio, id`,
    [expedienteIds]
  );
  if (!cr.rows.length) return mapa;
  const ab = await pool.query(
    `SELECT a.prestamo_id, a.tipo, a.importe, a.periodo_id, a.notas, to_char(a.fecha, 'YYYY-MM-DD') AS fecha,
            to_char(p.fecha_fin, 'YYYY-MM-DD') AS fin_periodo
     FROM nomina_prestamo_abonos a LEFT JOIN nomina_periodos p ON p.id = a.periodo_id
     WHERE a.prestamo_id = ANY($1::int[])`,
    [cr.rows.map((r) => r.id)]
  );
  for (const c of cr.rows) {
    const abonos = ab.rows.filter((a) => a.prestamo_id === c.id);
    const monto = aNumero(c.monto_total);
    const abonoPactado = aNumero(c.abono_semanal);
    let pagadoPrevio = 0;
    let pagosPrevios = 0;
    let abonoGuardado: number | null = null;
    const extraordinarios: CreditoEstado["extraordinarios"] = [];
    for (const a of abonos) {
      const imp = aNumero(a.importe);
      const esEstaSemana = a.tipo === "Semanal" && corte.periodo_id !== null && a.periodo_id === corte.periodo_id;
      if (esEstaSemana) {
        abonoGuardado = imp;
        continue;
      }
      const fechaRef = a.tipo === "Semanal" ? a.fin_periodo || a.fecha : a.fecha;
      if (fechaRef <= corte.hasta) {
        pagadoPrevio += imp;
        pagosPrevios += 1;
      }
      if (a.tipo === "Extraordinario" && a.fecha >= corte.desde && a.fecha <= corte.hasta) {
        extraordinarios.push({ fecha: a.fecha, importe: imp, notas: a.notas });
      }
    }
    const saldoPrevio = Math.max(0, redondear(monto - pagadoPrevio));
    const iniciado = c.fecha_inicio <= corte.hasta;
    const abonoSemana =
      abonoGuardado !== null ? abonoGuardado : c.estado === "Activo" && iniciado ? Math.min(abonoPactado, saldoPrevio) : 0;
    const pagado = redondear(pagadoPrevio + abonoSemana);
    const saldo = Math.max(0, redondear(monto - pagado));
    const restantes = semanasRestantes(saldo, abonoPactado);
    const termino = restantes ? sumarDiasIso(corte.hasta, restantes * 7) : saldo <= 0 ? corte.hasta : null;
    const sem = termino ? semanaIso(termino) : null;
    const estado: CreditoEstado = {
      id: c.id,
      expediente_id: c.expediente_id,
      concepto: c.concepto,
      monto_total: monto,
      abono_semanal: abonoPactado,
      saldo: aNumero(c.saldo),
      fecha_inicio: c.fecha_inicio,
      estado: c.estado,
      notas: c.notas,
      pagado,
      pagos: pagosPrevios + (abonoSemana > 0 ? 1 : 0),
      saldo_corte: saldo,
      semanas_restantes: restantes,
      termino_estimado: termino,
      termino_semana: sem ? `Semana ${sem.semana} ${sem.anio}` : null,
      extraordinarios,
      abono_semana: redondear(abonoSemana),
    };
    if (!mapa.has(c.expediente_id)) mapa.set(c.expediente_id, []);
    mapa.get(c.expediente_id)!.push(estado);
  }
  return mapa;
}

// Recalcula el saldo y estado de un crédito con todos sus abonos.
export async function recalcularSaldoCredito(prestamoId: number) {
  await getPool().query(
    `UPDATE nomina_prestamos p SET
       saldo = GREATEST(0, p.monto_total - COALESCE((SELECT SUM(importe) FROM nomina_prestamo_abonos WHERE prestamo_id = p.id), 0)),
       estado = CASE WHEN p.estado = 'Cancelado' THEN 'Cancelado'
                     WHEN p.monto_total - COALESCE((SELECT SUM(importe) FROM nomina_prestamo_abonos WHERE prestamo_id = p.id), 0) <= 0 THEN 'Liquidado'
                     ELSE 'Activo' END,
       updated_at = now()
     WHERE p.id = $1`,
    [prestamoId]
  );
}
