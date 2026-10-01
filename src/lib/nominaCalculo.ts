// Módulo "Nómina" — tipos y cálculo compartidos (cliente y servidor).
// Recibo interno de pago semanal (no es CFDI / no timbrado).

export type NominaConfig = {
  dias_base: number; // divisor del sueldo semanal para obtener el salario diario (default 7)
  retardos_por_falta: number; // cuántos retardos equivalen a 1 falta (default 3)
  empresa: string;
};

export const CONFIG_DEFAULT: NominaConfig = { dias_base: 7, retardos_por_falta: 3, empresa: "Transportes Logisticar" };

export type EstadoPeriodo = "Abierta" | "Cerrada" | "Pagada";

// Valores por defecto por persona (editables en el expediente → sección Nómina).
export const DEFAULTS_EMPLEADO = { sueldo_base: 2310, imss: 75, caja_ahorro: 100, fonacot: 0, infonavit: 0 };

export type NominaPeriodo = {
  id: number;
  anio: number;
  semana: number;
  fecha_inicio: string; // YYYY-MM-DD
  fecha_fin: string; // YYYY-MM-DD
  estado: EstadoPeriodo;
  sueldo_base?: number | null; // sueldo base (depósito BBVA) aplicado a toda la semana
  total_neto?: number;
  empleados?: number;
  total_personal?: number;
};

// Conceptos capturables de un registro de nómina (empleado + semana).
export type CreditoCaptura = { prestamo_id: number; concepto: string; abono: number };

export type NominaCaptura = {
  sueldo_semanal: number; // sueldo ofertado semanal
  sueldo_base: number; // depósito BBVA
  fonacot: number;
  infonavit: number;
  bonos_ruta: number; // informativo: bonos calculados por rutas de viajes foráneos
  creditos: CreditoCaptura[]; // abonos de la semana a licencia federal / préstamos
  dias_asistidos: number;
  faltas: number;
  retardos: number;
  // Percepciones
  bonos: number;
  otros_incentivos: number;
  incentivos_detalle: string;
  // Deducciones
  licencia_federal: number;
  imss: number;
  caja_ahorro: number;
  prestamo: number;
  otros_descuentos: number;
  otros_descuentos_detalle: string;
  observaciones: string;
};

export type NominaTotales = {
  salario_diario: number;
  faltas_equivalentes: number;
  descuento_faltas: number;
  total_percepciones: number;
  total_deducciones: number;
  neto: number;
  deposito_bbva: number;
  deposito_viaticos: number;
};

export type NominaRegistro = NominaCaptura &
  NominaTotales & {
    id: number | null; // null = aún no guardado
    expediente_id: number;
    nombre: string;
    puesto: string | null;
    folio: string;
  };

export const CAPTURA_VACIA: NominaCaptura = {
  sueldo_semanal: 0,
  sueldo_base: DEFAULTS_EMPLEADO.sueldo_base,
  fonacot: 0,
  infonavit: 0,
  bonos_ruta: 0,
  creditos: [],
  dias_asistidos: 0,
  faltas: 0,
  retardos: 0,
  bonos: 0,
  otros_incentivos: 0,
  incentivos_detalle: "",
  licencia_federal: 0,
  imss: 0,
  caja_ahorro: 0,
  prestamo: 0,
  otros_descuentos: 0,
  otros_descuentos_detalle: "",
  observaciones: "",
};

export const CAMPOS_NUMERICOS: (keyof NominaCaptura)[] = [
  "sueldo_semanal",
  "sueldo_base",
  "fonacot",
  "infonavit",
  "bonos_ruta",
  "dias_asistidos",
  "faltas",
  "retardos",
  "bonos",
  "otros_incentivos",
  "licencia_federal",
  "imss",
  "caja_ahorro",
  "prestamo",
  "otros_descuentos",
];

export function redondear(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Convierte textos como "$3,500 semanal" o "3500.50" a número. Devuelve 0 si no hay número.
export function aNumero(valor: unknown): number {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  const limpio = String(valor ?? "").replace(/[^0-9.,-]/g, "").replace(/,/g, "");
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
}

export const CONCEPTO_LICENCIA = "Licencia federal";
export const CONCEPTO_PRESTAMO = "Préstamo personal";

// Suma de abonos de la semana por tipo de crédito (si hay créditos capturados, mandan sobre los campos).
export function sumarCreditos(c: Pick<NominaCaptura, "creditos" | "licencia_federal" | "prestamo">): { licencia_federal: number; prestamo: number } {
  if (!c.creditos || c.creditos.length === 0) return { licencia_federal: aNumero(c.licencia_federal), prestamo: aNumero(c.prestamo) };
  let lic = 0;
  let pre = 0;
  for (const x of c.creditos) {
    if (x.concepto === CONCEPTO_LICENCIA) lic += aNumero(x.abono);
    else pre += aNumero(x.abono);
  }
  return { licencia_federal: redondear(lic), prestamo: redondear(pre) };
}

export function calcularTotales(c: NominaCaptura, cfg: NominaConfig): NominaTotales {
  const diasBase = cfg.dias_base > 0 ? cfg.dias_base : 7;
  const retardosPorFalta = cfg.retardos_por_falta > 0 ? Math.floor(cfg.retardos_por_falta) : 0;
  const salario_diario = redondear(aNumero(c.sueldo_semanal) / diasBase);
  const faltas_equivalentes =
    Math.max(0, aNumero(c.faltas)) + (retardosPorFalta ? Math.floor(Math.max(0, aNumero(c.retardos)) / retardosPorFalta) : 0);
  const descuento_faltas = redondear((aNumero(c.sueldo_semanal) / diasBase) * faltas_equivalentes);
  const cr = sumarCreditos(c);
  const total_percepciones = redondear(aNumero(c.sueldo_semanal) + aNumero(c.bonos) + aNumero(c.otros_incentivos));
  const total_deducciones = redondear(
    descuento_faltas + aNumero(c.imss) + aNumero(c.caja_ahorro) + aNumero(c.fonacot) + aNumero(c.infonavit) +
      cr.licencia_federal + cr.prestamo + aNumero(c.otros_descuentos)
  );
  const neto = redondear(total_percepciones - total_deducciones);
  // Depósito BBVA = sueldo base; Depósito de viáticos = lo que resta del neto.
  // Si el resto es negativo, se descuenta del depósito BBVA y viáticos queda en $0.
  const base = Math.max(0, aNumero(c.sueldo_base));
  const resto = redondear(neto - base);
  const deposito_viaticos = resto > 0 ? resto : 0;
  const deposito_bbva = redondear(Math.max(0, resto > 0 ? base : base + resto));
  return { salario_diario, faltas_equivalentes, descuento_faltas, total_percepciones, total_deducciones, neto, deposito_bbva, deposito_viaticos };
}

export function folioNomina(anio: number, semana: number, expedienteId: number): string {
  return `NOM-${anio}-S${String(semana).padStart(2, "0")}-${String(expedienteId).padStart(4, "0")}`;
}

export function moneda(n: number): string {
  return (Number(n) || 0).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

export function fechaCorta(iso: string): string {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${meses[Number(m) - 1] || ""} ${a}`;
}

export function sumarDias(iso: string, dias: number): string {
  const f = new Date(iso.slice(0, 10) + "T00:00:00Z");
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

// ---------------- Fase 2 (estructura lista, sin pantalla todavía) ----------------
// Préstamos con saldo y caja de ahorro acumulada. Las tablas ya existen en nominaDB.ts.

export type EstadoPrestamo = "Activo" | "Liquidado" | "Cancelado";

export type NominaPrestamo = {
  id: number;
  expediente_id: number;
  concepto: string;
  monto_total: number;
  abono_semanal: number;
  saldo: number;
  fecha_inicio: string;
  estado: EstadoPrestamo;
  notas: string | null;
};

export type NominaPrestamoAbono = {
  id: number;
  prestamo_id: number;
  registro_id: number | null;
  periodo_id: number | null;
  importe: number;
  fecha: string;
  tipo: "Semanal" | "Extraordinario";
  notas: string | null;
};

// Estado de un crédito a una fecha de corte.
export type CreditoEstado = NominaPrestamo & {
  pagado: number;
  pagos: number;
  saldo_corte: number;
  semanas_restantes: number;
  termino_estimado: string | null; // fecha estimada del último abono
  termino_semana: string | null; // "Semana N AAAA"
  extraordinarios: { fecha: string; importe: number; notas: string | null }[]; // del periodo consultado
  abono_semana: number; // abono de la semana consultada
};

export function semanasRestantes(saldo: number, abono: number): number {
  return saldo > 0 && abono > 0 ? Math.ceil(saldo / abono - 1e-9) : 0;
}

export type TipoMovimientoCaja = "Aportacion" | "Retiro" | "Rendimiento";

export type NominaCajaAhorroMovimiento = {
  id: number;
  expediente_id: number;
  registro_id: number | null;
  periodo_id: number | null;
  tipo: TipoMovimientoCaja;
  importe: number;
  fecha: string;
  notas: string | null;
};
