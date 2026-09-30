// Utilidades de análisis del perfil del candidato (sin clave de puntajes; se pueden usar en el navegador).
// ---- Utilidades para el análisis del perfil ----
export type Empleo = { empresa?: string; direccion?: string; puesto?: string; inicio?: string; fin?: string; actual?: boolean; sueldo?: string; motivo?: string; ref_nombre?: string; ref_telefono?: string };
export type Credito = { tipo?: string; pago_mensual?: string; saldo?: string };
export type ConfigEvaluacion = { zonas_rojas: string[]; edad_min: number; edad_max: number };

export const aNumero = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
export const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const aMes = (ym?: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym || "");
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};
const hoyMes = () => {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
};
export const dinero = (n: number) => `$${Math.round(n).toLocaleString("es-MX")}`;

// Resumen numérico de la trayectoria laboral (también lo usa el reporte en el navegador).
export function analizarEmpleos(empleos: Empleo[]) {
  const hoy = hoyMes();
  const lista = (empleos || [])
    .map((e) => {
      const ini = aMes(e.inicio);
      const fin = e.actual ? hoy : aMes(e.fin);
      return { ...e, ini, finM: fin, meses: ini !== null && fin !== null ? Math.max(0, fin - ini + 1) : null, sueldoN: aNumero(e.sueldo) };
    })
    .sort((a, b) => (a.ini ?? 0) - (b.ini ?? 0));
  const conMeses = lista.filter((e) => e.meses !== null) as (typeof lista[number] & { meses: number })[];
  const promedio = conMeses.length ? Math.round(conMeses.reduce((a, e) => a + e.meses, 0) / conMeses.length) : 0;
  const huecos: number[] = [];
  for (let i = 1; i < lista.length; i++) {
    const a = lista[i - 1].finM;
    const b = lista[i].ini;
    if (a !== null && b !== null && b - a > 1) huecos.push(b - a - 1);
  }
  const ultimos3 = lista.filter((e) => e.finM !== null && e.finM >= hoy - 36).length;
  const sueldos = lista.map((e) => e.sueldoN).filter((n) => n > 0);
  const inicioCarrera = lista.find((e) => e.ini !== null)?.ini ?? null;
  return {
    lista,
    total: lista.length,
    promedioMeses: promedio,
    masLargo: conMeses.reduce((m, e) => Math.max(m, e.meses), 0),
    huecos,
    ultimos3,
    sueldoMax: sueldos.length ? Math.max(...sueldos) : 0,
    sueldoUltimo: [...lista].reverse().find((e) => e.sueldoN > 0)?.sueldoN || 0,
    aniosTrayectoria: inicioCarrera !== null ? Math.round(((hoy - inicioCarrera) / 12) * 10) / 10 : 0,
    conReferencia: lista.filter((e) => (e.ref_nombre || "").trim() && (e.ref_telefono || "").trim()).length,
  };
}

