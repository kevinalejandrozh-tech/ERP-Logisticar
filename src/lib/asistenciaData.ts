// Módulo "Asistencia" — tipos, catálogos y utilidades de fecha compartidas (cliente y servidor).

export const TIPOS_ASISTENCIA = ["Asistencia", "Falta", "Vacaciones", "Descanso", "Permiso", "Incapacidad"] as const;
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
  origen: "QR" | "Manual";
  notas: string | null;
};

export type AsistenciaEmpleado = { id: number; nombre: string; puesto: string | null; area: string | null };

// Colores de cada estado en el calendario (paleta del sistema).
export const ESTILO_TIPO: Record<TipoAsistencia | "Retardo", { fondo: string; texto: string; borde: string }> = {
  Asistencia: { fondo: "#eef3fd", texto: "#16215c", borde: "#c9d8fa" },
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
