// Módulo "Asistencia" — tipos, catálogos y utilidades de fecha compartidas (cliente y servidor).

export const TIPOS_ASISTENCIA = ["Asistencia", "Viaje foráneo", "Falta", "Vacaciones", "Descanso", "Permiso", "Incapacidad"] as const;

// Tipos que cuentan como día trabajado para la nómina.
export const TIPOS_TRABAJADOS: string[] = ["Asistencia", "Viaje foráneo"];
export type TipoAsistencia = (typeof TIPOS_ASISTENCIA)[number];

export type AsistenciaConfig = {
  hora_entrada: string; // "HH:MM" hora de entrada esperada
  hora_salida: string; // "HH:MM" hora de salida esperada
  tolerancia_min: number; // minutos de tolerancia antes de marcar retardo
  minutos_entre_registros: number; // evita doble escaneo accidental
};

export const ASISTENCIA_CONFIG_DEFAULT: AsistenciaConfig = { hora_entrada: "08:00", hora_salida: "17:00", tolerancia_min: 10, minutos_entre_registros: 2 };

export type AsistenciaRegistro = {
  expediente_id: number;
  fecha: string; // YYYY-MM-DD
  tipo: TipoAsistencia;
  hora_entrada: string | null;
  hora_salida: string | null;
  retardo: boolean;
  origen: "QR" | "Manual" | "Programada" | "Viaje" | "Biométrico";
  notas: string | null;
  entrada_ts: string | null; // "YYYY-MM-DDTHH:MM" (hora local)
  salida_ts: string | null;
  estado_destino: string | null;
  ruta: string | null;
  viaje_id: number | null;
  estado_salida: EstadoSalida | null;
};

export type EstadoSalida = "Justificada" | "Anticipada";

export type AsistenciaEmpleado = { id: number; nombre: string; puesto: string | null; area: string | null; hora_entrada: string | null; hora_salida: string | null; fecha_ingreso: string | null };

// Colores de cada estado en el calendario (paleta del sistema).
export type ClaveEstilo = TipoAsistencia | "Retardo" | "Salida anticipada" | "Salida justificada" | "Vacaciones adelanto";
export const ESTILO_TIPO: Record<ClaveEstilo, { fondo: string; texto: string; borde: string }> = {
  Asistencia: { fondo: "#eef3fd", texto: "#16215c", borde: "#c9d8fa" },
  "Viaje foráneo": { fondo: "#e8f1ff", texto: "#1d4ed8", borde: "#9ec2ff" },
  "Salida justificada": { fondo: "#e6f6f4", texto: "#0f766e", borde: "#b9e5df" },
  "Salida anticipada": { fondo: "#fdecea", texto: "#b42318", borde: "#f5c2bc" },
  "Vacaciones adelanto": { fondo: "#fbf3e2", texto: "#8a5a00", borde: "#e9cf95" },
  Retardo: { fondo: "#fff4dc", texto: "#8a5a00", borde: "#f3d79a" },
  Falta: { fondo: "#fdecea", texto: "#b42318", borde: "#f5c2bc" },
  Vacaciones: { fondo: "#f1ecfd", texto: "#5b3fb0", borde: "#d9cdf7" },
  Descanso: { fondo: "#f1f2f5", texto: "#4b5563", borde: "#dfe2e8" },
  Permiso: { fondo: "#e6f6f4", texto: "#0f766e", borde: "#b9e5df" },
  Incapacidad: { fondo: "#fdebf3", texto: "#a3245f", borde: "#f4c3da" },
};

export const ZONA_HORARIA = "America/Mexico_City";

// Fecha y hora actuales en la zona horaria de la empresa.
export function ahoraMx(): { fecha: string; hora: string } {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const v = (t: string) => partes.find((p) => p.type === t)?.value || "00";
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

export function minutos(hhmm: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function esRetardo(horaEntrada: string | null, cfg: AsistenciaConfig): boolean {
  const e = minutos(horaEntrada);
  const esperada = minutos(cfg.hora_entrada);
  if (e === null || esperada === null) return false;
  return e > esperada + Math.max(0, cfg.tolerancia_min);
}

export function sumarDiasIso(iso: string, dias: number): string {
  const f = new Date(iso.slice(0, 10) + "T00:00:00Z");
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

// Lunes de la semana que contiene la fecha (semana lunes–domingo).
export function lunesDe(iso: string): string {
  const f = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const dia = (f.getUTCDay() + 6) % 7;
  return sumarDiasIso(iso, -dia);
}

// Semana ISO-8601 (la semana 1 es la que contiene el primer jueves del año).
export function semanaIso(iso: string): { anio: number; semana: number } {
  const f = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const dia = (f.getUTCDay() + 6) % 7;
  f.setUTCDate(f.getUTCDate() - dia + 3); // jueves de esa semana
  const anio = f.getUTCFullYear();
  const primerJueves = new Date(Date.UTC(anio, 0, 4));
  primerJueves.setUTCDate(primerJueves.getUTCDate() - ((primerJueves.getUTCDay() + 6) % 7) + 3);
  return { anio, semana: 1 + Math.round((f.getTime() - primerJueves.getTime()) / (7 * 86400000)) };
}

// Lunes de la semana ISO indicada.
export function lunesSemanaIso(anio: number, semana: number): string {
  const cuatroEnero = `${anio}-01-04`;
  return sumarDiasIso(lunesDe(cuatroEnero), (semana - 1) * 7);
}

export const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

// Día corto de una fecha ("Dom", "Lun"…), sin depender de la posición en la semana.
export function diaCorto(iso: string): string {
  const f = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return DIAS_CORTOS[(f.getUTCDay() + 6) % 7];
}

// ---------------- Semana de nómina: lunes a domingo (semana ISO) ----------------
// Semana 1 de 2026: lunes 29-dic-2025 a domingo 04-ene-2026.

// Sábado anterior o igual a la fecha (se conserva por compatibilidad; ya no define la semana de nómina).
export function sabadoInicio(iso: string): string {
  const f = new Date(iso.slice(0, 10) + "T00:00:00Z");
  const desdeSabado = (f.getUTCDay() + 1) % 7; // sáb=0, dom=1, lun=2 … vie=6
  return sumarDiasIso(iso, -desdeSabado);
}

// Semana de nómina que contiene la fecha: lunes a domingo, número = semana ISO.
export function semanaNomina(iso: string): { anio: number; semana: number; inicio: string; fin: string } {
  const inicio = lunesDe(iso);
  return { ...semanaIso(inicio), inicio, fin: sumarDiasIso(inicio, 6) };
}

// Lunes de inicio de la semana de nómina N (termina el domingo siguiente).
export function inicioSemanaNomina(anio: number, semana: number): string {
  return lunesSemanaIso(anio, semana);
}

// ---------------- Fecha-hora de entrada/salida (turnos que cruzan días) ----------------

export const RE_FECHA_HORA = /^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/;

function aMs(fh: string): number {
  return new Date(fh.slice(0, 16) + ":00Z").getTime();
}

// Horas trabajadas entre dos "YYYY-MM-DDTHH:MM" (0 si falta alguna).
export function horasTrabajadas(entrada: string | null, salida: string | null): number {
  if (!entrada || !salida) return 0;
  const h = (aMs(salida) - aMs(entrada)) / 3600000;
  return h > 0 ? Math.round(h * 100) / 100 : 0;
}

export type Horario = { hora_entrada: string; hora_salida: string; tolerancia_min: number };

export function horarioDe(emp: { hora_entrada?: string | null; hora_salida?: string | null } | null | undefined, cfg: AsistenciaConfig): Horario {
  const ok = (h?: string | null) => !!h && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  return {
    hora_entrada: ok(emp?.hora_entrada) ? (emp!.hora_entrada as string) : cfg.hora_entrada,
    hora_salida: ok(emp?.hora_salida) ? (emp!.hora_salida as string) : cfg.hora_salida,
    tolerancia_min: cfg.tolerancia_min,
  };
}

// Duración de la jornada estipulada (si la salida es menor que la entrada, cruza la medianoche).
export function minutosJornada(h: Horario): number {
  const e = minutos(h.hora_entrada) ?? 0;
  const s = minutos(h.hora_salida) ?? 0;
  return s > e ? s - e : s + 1440 - e;
}

// Retardo y estado de salida:
// - Retardo: la entrada pasa la hora estipulada + tolerancia.
// - Salida antes de la hora estipulada: "Justificada" si cubrió la jornada completa; si no, "Anticipada".
export function evaluarJornada(entrada: string | null, salida: string | null, h: Horario): { retardo: boolean; estado_salida: EstadoSalida | null } {
  if (!entrada) return { retardo: false, estado_salida: null };
  const horaEnt = entrada.slice(11, 16);
  const retardo = esRetardo(horaEnt, { ...ASISTENCIA_CONFIG_DEFAULT, hora_entrada: h.hora_entrada, tolerancia_min: h.tolerancia_min });
  if (!salida) return { retardo, estado_salida: null };
  const cruza = (minutos(h.hora_salida) ?? 0) <= (minutos(h.hora_entrada) ?? 0);
  const fechaSalidaEsperada = cruza ? sumarDiasIso(entrada.slice(0, 10), 1) : entrada.slice(0, 10);
  const esperada = aMs(`${fechaSalidaEsperada}T${h.hora_salida}`);
  if (aMs(salida) >= esperada) return { retardo, estado_salida: null };
  const trabajados = (aMs(salida) - aMs(entrada)) / 60000;
  return { retardo, estado_salida: trabajados >= minutosJornada(h) ? "Justificada" : "Anticipada" };
}

// Clave visual de un registro en el calendario.
export function claveVisual(r: Pick<AsistenciaRegistro, "tipo" | "retardo" | "estado_salida" | "origen">): ClaveEstilo {
  if (r.tipo === "Vacaciones") return r.origen === "Programada" ? "Vacaciones" : "Vacaciones adelanto";
  if (r.tipo !== "Asistencia") return r.tipo;
  if (r.estado_salida === "Anticipada") return "Salida anticipada";
  if (r.retardo) return "Retardo";
  if (r.estado_salida === "Justificada") return "Salida justificada";
  return "Asistencia";
}

export const ESTADOS_MX = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua", "Ciudad de México", "Coahuila",
  "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero", "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit",
  "Nuevo León", "Oaxaca", "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
];

// ---------------- Vacaciones (Ley Federal del Trabajo, reforma 2023) ----------------

export function diasVacacionesLey(anios: number): number {
  if (anios < 1) return 0;
  if (anios <= 5) return 10 + anios * 2; // 1→12, 2→14, 3→16, 4→18, 5→20
  if (anios <= 10) return 22;
  if (anios <= 15) return 24;
  if (anios <= 20) return 26;
  if (anios <= 25) return 28;
  if (anios <= 30) return 30;
  return 32;
}

// Años de servicio cumplidos a una fecha y el periodo vacacional vigente (de aniversario a aniversario).
export function antiguedad(fechaIngreso: string, hoy: string): { anios: number; desde: string; hasta: string } {
  const ing = fechaIngreso.slice(0, 10);
  let anios = Number(hoy.slice(0, 4)) - Number(ing.slice(0, 4));
  if (hoy.slice(5) < ing.slice(5)) anios -= 1;
  anios = Math.max(0, anios);
  const aniv = (n: number) => {
    const a = Number(ing.slice(0, 4)) + n;
    const md = ing.slice(5) === "02-29" ? "02-28" : ing.slice(5);
    return `${a}-${md}`;
  };
  return { anios, desde: aniv(anios), hasta: sumarDiasIso(aniv(anios + 1), -1) };
}