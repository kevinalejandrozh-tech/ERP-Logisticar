"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import CampoMoneda from "@/components/CampoMoneda";
import { exportarExcel } from "@/lib/exportExcel";
import { ESTADOS_MX, ahoraMx, sumarDiasIso } from "@/lib/asistenciaData";
import { moneda } from "@/lib/nominaCalculo";
import { TIPOS_UNIDAD_CASETA } from "@/lib/catalogosRutaData";
import { CAMPOS_VIAJE, GASTOS_VIAJE, NA_PREFIJO, GRUPOS_ESTATUS, GRUPOS_VIAJE, GrupoEstatus, OPCIONES_TIPO_SERVICIO, Viaje, calcularEstatusViaje, duracionViaje, esViajeLocal, estadoViaje, etiquetaViaje, grupoEstatus } from "@/lib/viajesData";

type Unidad = { eco: string; unidad: string | null; placas: string | null; capacidad: string | null; disponible: boolean };
type Conciliacion = {
  totalImportados: number;
  ecosFaltantes: { eco: string; viajes: number; sugerencias: string[] }[];
  operadoresFaltantes: { nombre: string; viajes: number; sugerencias: { id: number; nombre: string; puntaje: number }[] }[];
  ecos: string[];
  personas: { id: number; nombre: string }[];
};
type Persona = { id: number; nombre: string; puesto: string | null };
type Ruta = { nombre: string; estado_destino: string | null; bono: number; bonos_unidad: Record<string, number>; horas_ida?: number; horas_regreso_vacio?: number };
type Edicion = { id: number | null; eco: string; fecha: string; datos: Record<string, string>; operador_id: number | null; ayudante_id: number | null };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const etiquetaDia = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const nombreDia = (iso: string) => DIAS[new Date(iso + "T00:00:00Z").getUTCDay()];
const diasEntre = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
const MAX_DIAS = 62;
// Semana configurable SOLO para esta página (0 = domingo … 6 = sábado).
const diaSemana = (iso: string) => new Date(iso + "T00:00:00Z").getUTCDay();
const largoSemana = (ini: number, fin: number) => ((fin - ini + 7) % 7) + 1;
const inicioSemana = (iso: string, ini: number) => sumarDiasIso(iso, -((diaSemana(iso) - ini + 7) % 7));
// Número de semana: referencia fija — la semana (según la configuración) que contiene el 3 de octubre de 2026 es la 40.
const FECHA_REF = "2026-10-03";
const SEMANA_REF = 40;
const numeroSemana = (iso: string, ini: number) => {
  const k = Math.floor(diasEntre(inicioSemana(FECHA_REF, ini), inicioSemana(iso, ini)) / 7);
  return ((((SEMANA_REF - 1 + k) % 52) + 52) % 52) + 1;
};
// Término estimado del viaje ("AAAA-MM-DDTHH:mm"): el capturado (real o estimado) y, si no hay, inicio de ruta + horas de ida y regreso de la ruta.
const TERMINO_EST = "TERMINO ESTIMADO DE TERMINO DEL SERVICIO";
function finEstimadoFH(d: Record<string, string>, rutas: Ruta[]): string {
  const capturado = [d["TERMINO DE SERVICIO"], d[TERMINO_EST], d["ARRIBO A PATIOO"]].map((x) => (x || "").trim()).filter((x) => /^\d{4}-\d{2}-\d{2}/.test(x)).sort().pop();
  if (capturado) return capturado.length >= 16 ? capturado.slice(0, 16) : `${capturado.slice(0, 10)}T23:59`;
  if (esViajeLocal(d)) return "";
  const r = rutas.find((x) => x.nombre === d["RUTA O DESTINO"]);
  const horas = (r?.horas_ida || 0) + (r?.horas_regreso_vacio || 0);
  const base = (d["INICIO DE RUTA"] || d["INICIO DE RUTA PROGRAMADO"] || "").trim();
  const m = base.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  if (!m || horas <= 0) return "";
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) + horas * 3600000).toISOString().slice(0, 16);
}
const ahoraLocal = () => {
  const a = ahoraMx();
  return `${a.fecha}T${String(a.hora).slice(0, 5)}`;
};
const VERDE = "border-[var(--green)]! bg-[#eefaf3]!"; // campo ya llenado

const ANCHO_DIA = 150; // ancho fijo de cada columna de día (las etiquetas no lo modifican)
const ANCHO_UNIDAD = 190;
const MESES_MIN = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// "2026-09-27T07:00" -> "27 sep 07:00"
const fmtFH = (v?: string) => {
  const m = (v || "").match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return v || "—";
  return `${Number(m[3])} ${MESES_MIN[Number(m[2]) - 1]}${m[4] ? ` ${m[4]}:${m[5]}` : ""}`;
};
type Resumen = { v: Viaje; left: number; top: number; w: number; maxH: number };
const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const barraCls = "border border-[var(--gray-300)] rounded-md px-3 py-1.5 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

export default function CalendarioViajesPage() {
  const hoy = ahoraMx().fecha;
  const [semanaCfg, setSemanaCfg] = useState({ dia_inicio: 1, dia_fin: 0 });
  const [modo, setModo] = useState<"semana" | "rango">("semana");
  const [desde, setDesde] = useState(inicioSemana(hoy, 1));
  const [hasta, setHasta] = useState(sumarDiasIso(inicioSemana(hoy, 1), 6));
  const [configAbierta, setConfigAbierta] = useState(false);
  const [cfgTmp, setCfgTmp] = useState({ dia_inicio: 1, dia_fin: 0 });
  const [guardandoCfg, setGuardandoCfg] = useState(false);

  // Coloca el rango en la semana (según la configuración) que contiene la fecha dada.
  const aplicarSemana = useCallback((fecha: string, cfg: { dia_inicio: number; dia_fin: number }) => {
    const ini = inicioSemana(fecha, cfg.dia_inicio);
    setDesde(ini);
    setHasta(sumarDiasIso(ini, largoSemana(cfg.dia_inicio, cfg.dia_fin) - 1));
  }, []);

  useEffect(() => {
    pedir<{ dia_inicio: number; dia_fin: number }>("/api/viajes-calendario/config")
      .then((c) => {
        const cfg = { dia_inicio: c.dia_inicio, dia_fin: c.dia_fin };
        setSemanaCfg(cfg);
        aplicarSemana(hoy, cfg);
      })
      .catch(() => {});
  }, [hoy, aplicarSemana]);

  const cambiarModo = (m: "semana" | "rango") => {
    setModo(m);
    if (m === "semana") aplicarSemana(desde, semanaCfg);
  };

  const guardarConfig = async () => {
    setGuardandoCfg(true);
    try {
      await pedir("/api/viajes-calendario/config", { method: "PUT", body: JSON.stringify(cfgTmp) });
      setSemanaCfg(cfgTmp);
      if (modo === "semana") aplicarSemana(desde, cfgTmp);
      setConfigAbierta(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardandoCfg(false);
    }
  };
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtroAsignacion, setFiltroAsignacion] = useState<"todas" | "con" | "sin">("todas");
  const [ecosElegidos, setEcosElegidos] = useState<string[]>([]);
  const [selectorEcosAbierto, setSelectorEcosAbierto] = useState(false);
  const [conciliacion, setConciliacion] = useState<Conciliacion | null>(null);
  const [conciliarAbierto, setConciliarAbierto] = useState(false);
  const [mapaEcos, setMapaEcos] = useState<Record<string, string>>({});
  const [mapaOperadores, setMapaOperadores] = useState<Record<string, string>>({});
  const [aplicando, setAplicando] = useState(false);
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [gastoAbierto, setGastoAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [clientes, setClientes] = useState<string[]>([]);
  const [manualHora, setManualHora] = useState<Record<string, boolean>>({});
  const [vista, setVista] = useState<"calendario" | "tabla">("calendario");
  const [filtroEstatus, setFiltroEstatus] = useState<"todos" | GrupoEstatus>("todos");
  const [filtroCuenta, setFiltroCuenta] = useState("");
  const [resumen, setResumen] = useState<Resumen | null>(null);

  // Recuadro de resumen: junto al viaje, a su derecha y a la altura de su texto (a la izquierda si no cabe).
  const abrirResumen = (v: Viaje, el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(640, vw - 24);
    const top = Math.max(12, Math.min((r.top + r.bottom) / 2 - 40, vh - 240));
    let left: number;
    if (r.right + 10 + w <= vw - 12) left = r.right + 10;
    else if (r.left - 10 - w >= 12) left = r.left - 10 - w;
    else left = Math.max(12, vw - w - 12);
    setResumen({ v, left, top, w, maxH: vh - top - 12 });
  };

  useEffect(() => {
    fetch("/api/viajes-calendario/clientes", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d?.ok && setClientes(d.clientes || []))
      .catch(() => {});
  }, []);

  const dias = useMemo(() => {
    const n = Math.max(1, Math.min(MAX_DIAS, diasEntre(desde, hasta) + 1));
    return Array.from({ length: n }, (_, i) => sumarDiasIso(desde, i));
  }, [desde, hasta]);
  const ultimo = dias[dias.length - 1];

  const cargar = useCallback(async (d: string, h: string) => {
    try {
      const r = await pedir<{ unidades: Unidad[]; viajes: Viaje[]; personas: Persona[]; rutas: Ruta[] }>(`/api/viajes-calendario?desde=${d}&hasta=${h}`);
      setError("");
      setUnidades(r.unidades);
      setViajes(r.viajes);
      setPersonas(r.personas);
      setRutas(r.rutas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(desde, ultimo);
  }, [desde, ultimo, cargar]);

  // Cambia el rango respetando el máximo de días.
  const cambiarDesde = (v: string) => {
    if (!v) return;
    setDesde(v);
    if (hasta < v) setHasta(sumarDiasIso(v, 6));
    else if (diasEntre(v, hasta) >= MAX_DIAS) setHasta(sumarDiasIso(v, MAX_DIAS - 1));
  };
  const cambiarHasta = (v: string) => {
    if (!v) return;
    if (v < desde) setDesde(v);
    else if (diasEntre(desde, v) >= MAX_DIAS) setDesde(sumarDiasIso(v, -(MAX_DIAS - 1)));
    setHasta(v);
  };
  const mover = (sentido: 1 | -1) => {
    if (modo === "semana") {
      aplicarSemana(sumarDiasIso(desde, sentido * 7), semanaCfg);
      return;
    }
    const n = dias.length;
    setDesde(sumarDiasIso(desde, sentido * n));
    setHasta(sumarDiasIso(ultimo, sentido * n));
  };
  const irHoy = () => {
    if (modo === "semana") {
      aplicarSemana(hoy, semanaCfg);
      return;
    }
    const n = dias.length;
    const ini = hoy;
    setDesde(ini);
    setHasta(sumarDiasIso(ini, n - 1));
  };

  // Días visibles: semana configurada o un rango fijo desde el día inicial.
  const verDias = (n: number) => {
    if (!n) {
      cambiarModo("semana");
      return;
    }
    setModo("rango");
    setHasta(sumarDiasIso(desde, Math.min(MAX_DIAS, n) - 1));
  };
  // Desplazamiento lateral: al llegar al borde derecho se agregan 7 días más (hasta el máximo).
  const extendiendo = useRef(false);
  useEffect(() => {
    extendiendo.current = false;
  }, [dias.length]);
  const alDesplazar = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (extendiendo.current || dias.length >= MAX_DIAS) return;
    if (el.scrollWidth > el.clientWidth && el.scrollLeft + el.clientWidth >= el.scrollWidth - 40) {
      extendiendo.current = true;
      setModo("rango");
      setHasta(sumarDiasIso(ultimo, 7));
    }
  };

  const porCelda = useMemo(() => {
    const m = new Map<string, Viaje[]>();
    for (const v of viajes) {
      const k = `${v.eco}|${v.fecha}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    }
    return m;
  }, [viajes]);

  // Cronograma: días ocupados por cada viaje desde el día siguiente al inicio hasta su término estimado.
  const ocupadas = useMemo(() => {
    const m = new Map<string, { v: Viaje; fin: string; primero: boolean }[]>();
    for (const v of viajes) {
      const fin = finEstimadoFH(v.datos, rutas).slice(0, 10);
      if (!fin || fin <= v.fecha) continue;
      const ini = sumarDiasIso(v.fecha, 1);
      let d = ini < desde ? desde : ini;
      for (let i = 0; i < 90 && d <= fin && d <= ultimo; i++, d = sumarDiasIso(d, 1)) {
        const k = `${v.eco}|${d}`;
        if (!m.has(k)) m.set(k, []);
        m.get(k)!.push({ v, fin, primero: d === (ini < desde ? desde : ini) });
      }
    }
    return m;
  }, [viajes, rutas, desde, ultimo]);

  const conViajes = useMemo(() => new Set(viajes.map((v) => v.eco)), [viajes]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return unidades.filter((u) => {
      if (q && !`${u.eco} ${u.unidad || ""} ${u.placas || ""} ${u.capacidad || ""}`.toLowerCase().includes(q)) return false;
      if (filtroAsignacion === "con" && !conViajes.has(u.eco)) return false;
      if (filtroAsignacion === "sin" && conViajes.has(u.eco)) return false;
      if (ecosElegidos.length && !ecosElegidos.includes(u.eco)) return false;
      return true;
    });
  }, [unidades, busqueda, filtroAsignacion, conViajes, ecosElegidos]);

  const cuentas = useMemo(() => [...new Set(viajes.map((v) => (v.datos["NOMBRE CUENTA"] || "").trim()).filter(Boolean))].sort(), [viajes]);
  const filasTabla = useMemo(() => {
    const ecos = new Set(visibles.map((u) => u.eco));
    return viajes
      .filter((v) => ecos.has(v.eco) && (filtroEstatus === "todos" || estadoViaje(v.datos) === filtroEstatus) && (!filtroCuenta || (v.datos["NOMBRE CUENTA"] || "").trim() === filtroCuenta))
      .sort((a, b) => (a.fecha + (a.datos["INICIO DE RUTA PROGRAMADO"] || "")).localeCompare(b.fecha + (b.datos["INICIO DE RUTA PROGRAMADO"] || "")) || a.eco.localeCompare(b.eco));
  }, [viajes, visibles, filtroEstatus, filtroCuenta]);
  const nombrePersona = (id: number | null) => personas.find((p) => p.id === id)?.nombre || "Sin asignar";

  // Conciliación de la importación de la Semana 40 (ECO y operadores que no coincidieron).
  const cargarConciliacion = useCallback(async () => {
    try {
      const r = await pedir<Conciliacion>("/api/viajes-calendario/importacion");
      setConciliacion(r);
      setMapaEcos(Object.fromEntries(r.ecosFaltantes.map((x) => [x.eco, x.sugerencias[0] || ""])));
      setMapaOperadores(Object.fromEntries(r.operadoresFaltantes.map((x) => [x.nombre, x.sugerencias[0] ? String(x.sugerencias[0].id) : ""])));
    } catch {
      setConciliacion(null);
    }
  }, []);
  useEffect(() => {
    cargarConciliacion();
  }, [cargarConciliacion]);
  const pendientesImportacion = conciliacion ? conciliacion.ecosFaltantes.length + conciliacion.operadoresFaltantes.length : 0;
  const aplicarConciliacion = async () => {
    setAplicando(true);
    try {
      const r = await pedir<{ actualizados: number }>("/api/viajes-calendario/importacion", {
        method: "POST",
        body: JSON.stringify({
          ecos: Object.fromEntries(Object.entries(mapaEcos).filter(([, v]) => v)),
          operadores: Object.fromEntries(Object.entries(mapaOperadores).filter(([, v]) => v).map(([k, v]) => [k, Number(v)])),
        }),
      });
      alert(`Listo: ${r.actualizados} viaje(s) actualizados.`);
      setConciliarAbierto(false);
      await cargarConciliacion();
      await cargar(desde, ultimo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo aplicar.");
    } finally {
      setAplicando(false);
    }
  };

  const nuevo = (eco: string, fecha: string) => {
    setGastoAbierto(null);
    setManualHora({});
    setEdicion({ id: null, eco, fecha, datos: { ECO: eco, "TIPO DE SERVICIO": "FORANEO", "INICIO DE RUTA PROGRAMADO": `${fecha}T08:00`, [`${NA_PREFIJO}HORARIO DE CITA DE ENTREGA`]: "1" }, operador_id: null, ayudante_id: null });
  };
  const abrir = (v: Viaje) => {
    setGastoAbierto(null);
    setManualHora({});
    setEdicion({ id: v.id, eco: v.eco, fecha: v.fecha, datos: { ...v.datos }, operador_id: v.operador_id, ayudante_id: v.ayudante_id });
  };
  const setDato = (k: string, v: string) => setEdicion((e) => (e ? { ...e, datos: { ...e.datos, [k]: v } } : e));

  const guardar = async () => {
    if (!edicion) return;
    setGuardando(true);
    try {
      const url = edicion.id ? `/api/viajes-calendario?id=${edicion.id}` : "/api/viajes-calendario";
      // Si no se capturó el término estimado, se calcula con las horas de la ruta para sombrear los días ocupados.
      const datos = { ...edicion.datos };
      if (!datos[TERMINO_EST] && datos[`${NA_PREFIJO}${TERMINO_EST}`] !== "1") {
        const est = finEstimadoFH(datos, rutas);
        if (est) datos[TERMINO_EST] = est;
      }
      await pedir(url, { method: edicion.id ? "PUT" : "POST", body: JSON.stringify({ ...edicion, datos }) });
      setEdicion(null);
      await cargar(desde, ultimo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!edicion?.id || !confirm("¿Eliminar este viaje? También se quitan los días de “Viaje foráneo” que generó en Asistencia.")) return;
    try {
      await pedir(`/api/viajes-calendario?id=${edicion.id}`, { method: "DELETE" });
      setEdicion(null);
      await cargar(desde, ultimo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const exportar = () =>
    exportarExcel(`Viajes_${desde}_a_${ultimo}.xlsx`, [
      { nombre: "Viajes", filas: viajes.map((v) => ({ FECHA: v.fecha, ...Object.fromEntries(CAMPOS_VIAJE.map((c) => [c.clave, v.datos[c.clave] || ""])) })) },
    ]);

  const estatus = edicion ? calcularEstatusViaje(edicion.datos) : { patio: "", almacen: "" };
  const rutaSel = edicion ? rutas.find((r) => r.nombre === edicion.datos["RUTA O DESTINO"]) : undefined;
  const bonoUnidad = rutaSel && edicion ? (rutaSel.bonos_unidad[edicion.eco] ?? rutaSel.bono) : null;

  const campo = (c: (typeof CAMPOS_VIAJE)[number]) => {
    if (!edicion) return null;
    const valor = edicion.datos[c.clave] || "";
    const naClave = NA_PREFIJO + c.clave;
    const esNA = edicion.datos[naClave] === "1";
    const permiteNA = c.tipo !== "eco" && c.tipo !== "calculado";
    const kPersona = c.clave === "OPERADOR" ? "operador_id" : "ayudante_id";
    const lleno = !esNA && (c.tipo === "persona" ? edicion[kPersona] != null : c.tipo === "eco" ? !!edicion.eco : c.tipo === "calculado" ? false : valor.trim() !== "");
    const inp = `${inputCls} ${lleno ? VERDE : ""}`;
    const alternarNA = () =>
      setEdicion((e) => {
        if (!e) return e;
        const datos = { ...e.datos };
        if (esNA) delete datos[naClave];
        else {
          datos[naClave] = "1";
          delete datos[c.clave];
        }
        return { ...e, datos, ...(c.tipo === "persona" && !esNA ? { [kPersona]: null } : {}) };
      });
    let control: React.ReactNode;
    if (c.tipo === "eco") {
      control = (
        <select value={edicion.eco} onChange={(e) => setEdicion({ ...edicion, eco: e.target.value, datos: { ...edicion.datos, ECO: e.target.value } })} className={inp}>
          {unidades.map((u) => <option key={u.eco} value={u.eco}>{u.eco}{u.unidad ? ` · ${u.unidad}` : ""}</option>)}
        </select>
      );
    } else if (c.tipo === "persona") {
      control = (
        <select value={edicion[kPersona] ?? ""} onChange={(e) => setEdicion({ ...edicion, [kPersona]: e.target.value ? Number(e.target.value) : null })} className={inp}>
          <option value="">Sin asignar</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      );
    } else if (c.tipo === "estado") {
      control = (
        <select value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inp}>
          <option value="">Selecciona</option>
          {ESTADOS_MX.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      );
    } else if (c.tipo === "tipo_unidad") {
      // Mismos tipos de unidad que se usan en el catálogo de casetas.
      control = (
        <select value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inp}>
          <option value="">Selecciona</option>
          {valor && !(TIPOS_UNIDAD_CASETA as readonly string[]).includes(valor) && <option value={valor}>{valor}</option>}
          {TIPOS_UNIDAD_CASETA.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      );
    } else if (c.tipo === "cuenta") {
      const nueva = valor.trim() !== "" && !clientes.some((x) => x.toLowerCase() === valor.trim().toLowerCase());
      control = (
        <>
          <input list="clientes-viaje" value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inp} placeholder="Elige del catálogo o escribe uno nuevo" />
          <datalist id="clientes-viaje">{clientes.map((x) => <option key={x} value={x} />)}</datalist>
          {nueva && <p className="text-[11.5px] text-[var(--amber)] m-0 mt-1">Cliente nuevo: se agregará al catálogo al guardar.</p>}
        </>
      );
    } else if (c.tipo === "ruta") {
      control = (
        <>
          <input list="rutas-viaje" value={valor} onChange={(e) => {
            const r = rutas.find((x) => x.nombre === e.target.value);
            setEdicion({ ...edicion, datos: { ...edicion.datos, [c.clave]: e.target.value, ...(r?.estado_destino && !edicion.datos["ESTADO DESTINO"] ? { "ESTADO DESTINO": r.estado_destino } : {}) } });
          }} className={inp} placeholder="Elige o escribe" />
          <datalist id="rutas-viaje">{rutas.map((r) => <option key={r.nombre} value={r.nombre} />)}</datalist>
          {bonoUnidad !== null && (
            <p className="text-[11.5px] text-[var(--gray-500)] m-0 mt-1">
              {esViajeLocal(edicion.datos) ? "Viaje local: no genera bono por ruta." : <>Bono para {edicion.eco}: <b className="text-[var(--navy)] font-medium">{moneda(bonoUnidad)}</b></>}
            </p>
          )}
        </>
      );
    } else if (c.tipo === "calculado") {
      const v = c.clave === "ESTATUS PATIO" ? estatus.patio : estatus.almacen;
      control = (
        <div className={`${inputCls} bg-[var(--gray-100)] font-medium ${v === "Tarde" ? "text-[var(--red)]" : v ? "text-[var(--green)]" : "text-[var(--gray-400)]"}`}>
          {v || "Se calcula automáticamente"}
        </div>
      );
    } else if (c.grupo === "Seguimiento" && c.tipo === "fecha_hora") {
      // Seguimiento: "Marcar hora" registra la hora real en curso; se muestra para confirmarla y editarla (captura atrasada).
      control =
        valor || manualHora[c.clave] ? (
          <div>
            <input type="datetime-local" value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inp} />
            <p className="m-0 mt-1 flex items-center justify-between gap-2 text-[11.5px] text-[var(--gray-500)]">
              <span>{valor ? <>Hora registrada: <b className="text-[var(--green)]">{fmtFH(valor)}</b> · puedes editarla</> : "Captura la hora"}</span>
              <button type="button" className="font-bold text-[var(--blue)] shrink-0" onClick={() => setDato(c.clave, ahoraLocal())}>Marcar hora</button>
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setDato(c.clave, ahoraLocal())} className="rounded-md border border-[var(--blue)] text-[var(--blue)] px-3 py-2 text-[12.5px] font-bold hover:bg-[var(--blue-light)]">
              🕒 Marcar hora
            </button>
            <button type="button" onClick={() => setManualHora((m) => ({ ...m, [c.clave]: true }))} className="text-[12px] text-[var(--gray-500)] underline">Capturar manual</button>
          </div>
        );
    } else {
      const estimado = c.clave === TERMINO_EST && !valor ? finEstimadoFH(edicion.datos, rutas) : "";
      control = (
        <>
          <input type={c.tipo === "fecha_hora" ? "datetime-local" : c.tipo === "numero" ? "number" : "text"} min={c.tipo === "numero" ? 0 : undefined} value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inp} />
          {estimado && <p className="text-[11.5px] text-[var(--gray-500)] m-0 mt-1">Si lo dejas vacío se estima con la ruta: <b className="text-[var(--navy)] font-medium">{fmtFH(estimado)}</b></p>}
        </>
      );
    }
    return (
      <div key={c.clave}>
        <div className="flex items-center justify-between mb-1">
          <label className={`${labelCls} mb-0!`}>{c.etiqueta}</label>
          {permiteNA && (
            <button type="button" onClick={alternarNA} aria-pressed={esNA} title={esNA ? "Marcado como no aplica — clic para habilitar" : "Marcar como no aplica"} className={`text-[9.5px] font-bold leading-none rounded px-1.5 py-1 border ${esNA ? "bg-[var(--gray-500)] border-[var(--gray-500)] text-white" : "border-[var(--gray-200)] text-[var(--gray-400)] hover:text-[var(--navy)]"}`}>
              N/A
            </button>
          )}
        </div>
        <fieldset disabled={esNA} className={`m-0 p-0 border-0 min-w-0 transition-opacity ${esNA ? "opacity-30" : ""}`}>{control}</fieldset>
      </div>
    );
  };

  const anchoTabla = ANCHO_UNIDAD + dias.length * ANCHO_DIA;
  const gastoSel = GASTOS_VIAJE.find((g) => g.clave === gastoAbierto);

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Calendario de viajes"
          subtitulo="Programa y da seguimiento a los viajes por unidad. Los viajes foráneos quedan en Asistencia como “Viaje foráneo”."
          backHref="/control-viajes"
          backLabel="Control de Viajes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>}
        />
        {conciliarAbierto && conciliacion && (
          <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-50" onClick={() => setConciliarAbierto(false)}>
            <div className="bg-white rounded-xl w-full max-w-[640px] max-h-[85vh] overflow-y-auto shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">Relacionar importación Semana 40</h3>
              <p className="text-[12px] text-[var(--gray-500)] m-0 mb-4">Se propone la relación más parecida. Cámbiala si no es correcta o déjala en blanco para no aplicarla.</p>
              {conciliacion.ecosFaltantes.length > 0 && (
                <>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-500)] m-0 mb-2">ECO del PDF → Unidad registrada</p>
                  <div className="grid gap-2 mb-5">
                    {conciliacion.ecosFaltantes.map((x) => (
                      <div key={x.eco} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
                        <span className="text-[13px] text-[var(--navy)] font-medium">{x.eco} <span className="text-[var(--gray-500)] font-normal">· {x.viajes} viaje(s)</span></span>
                        <select value={mapaEcos[x.eco] || ""} onChange={(e) => setMapaEcos({ ...mapaEcos, [x.eco]: e.target.value })} className={inputCls}>
                          <option value="">Sin relacionar</option>
                          {conciliacion.ecos.map((e) => <option key={e} value={e}>{e}{x.sugerencias.includes(e) ? " (sugerida)" : ""}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {conciliacion.operadoresFaltantes.length > 0 && (
                <>
                  <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-500)] m-0 mb-2">Operador del PDF → Expediente</p>
                  <div className="grid gap-2 mb-5">
                    {conciliacion.operadoresFaltantes.map((x) => (
                      <div key={x.nombre} className="grid grid-cols-[1fr_1.4fr] items-center gap-3">
                        <span className="text-[13px] text-[var(--navy)] font-medium">{x.nombre} <span className="text-[var(--gray-500)] font-normal">· {x.viajes}</span></span>
                        <select value={mapaOperadores[x.nombre] || ""} onChange={(e) => setMapaOperadores({ ...mapaOperadores, [x.nombre]: e.target.value })} className={inputCls}>
                          <option value="">Sin relacionar</option>
                          {x.sugerencias.map((p) => <option key={`s${p.id}`} value={p.id}>★ {p.nombre}</option>)}
                          {conciliacion.personas.filter((p) => !x.sugerencias.some((q) => q.id === p.id)).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secundario py-1.5" onClick={() => setConciliarAbierto(false)}>Cancelar</button>
                <button type="button" className="btn btn-primario py-1.5" disabled={aplicando} onClick={aplicarConciliacion}>{aplicando ? "Aplicando…" : "Aplicar relaciones"}</button>
              </div>
            </div>
          </div>
        )}
        {configAbierta && (
          <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-50" onClick={() => setConfigAbierta(false)}>
            <div className="bg-white rounded-xl w-full max-w-[380px] shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-[15px] font-bold text-[var(--navy)] m-0 mb-1">Configurar semana</h3>
              <p className="text-[12px] text-[var(--gray-500)] m-0 mb-4">Aplica solo al Calendario de viajes.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <label className="block">
                  <span className={labelCls}>Inicia el</span>
                  <select value={cfgTmp.dia_inicio} onChange={(e) => setCfgTmp({ ...cfgTmp, dia_inicio: Number(e.target.value) })} className={inputCls}>
                    {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Termina el</span>
                  <select value={cfgTmp.dia_fin} onChange={(e) => setCfgTmp({ ...cfgTmp, dia_fin: Number(e.target.value) })} className={inputCls}>
                    {DIAS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
              </div>
              <p className="text-[12px] text-[var(--gray-500)] m-0 mb-4">La semana mostrará {largoSemana(cfgTmp.dia_inicio, cfgTmp.dia_fin)} día(s).</p>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn btn-secundario py-1.5" onClick={() => setConfigAbierta(false)}>Cancelar</button>
                <button type="button" className="btn btn-primario py-1.5" disabled={guardandoCfg} onClick={guardarConfig}>{guardandoCfg ? "Guardando…" : "Guardar"}</button>
              </div>
            </div>
          </div>
        )}
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8">
          <div className="flex flex-wrap items-center gap-2.5 p-3 border-b border-[var(--gray-200)]">
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Rango anterior" className="btn btn-secundario px-2.5 py-1.5" onClick={() => mover(-1)}>‹</button>
              <button type="button" className="btn btn-secundario py-1.5" onClick={irHoy}>Hoy</button>
              <button type="button" aria-label="Rango siguiente" className="btn btn-secundario px-2.5 py-1.5" onClick={() => mover(1)}>›</button>
            </div>
            <div className="flex items-center rounded-md border border-[var(--gray-300)] overflow-hidden text-[12.5px]">
              {(["semana", "rango"] as const).map((m) => (
                <button key={m} type="button" onClick={() => cambiarModo(m)} className={`px-3 py-1.5 font-medium ${modo === m ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)]"}`}>
                  {m === "semana" ? "Semana" : "Rango"}
                </button>
              ))}
            </div>
            <select
              value={modo === "semana" ? 0 : [14, 21, 31, MAX_DIAS].includes(dias.length) ? dias.length : -1}
              onChange={(e) => verDias(Number(e.target.value))}
              className={barraCls}
              title="Días visibles en el calendario"
              aria-label="Días visibles"
            >
              <option value={0}>Ver: 1 semana</option>
              <option value={14}>Ver: 2 semanas</option>
              <option value={21}>Ver: 3 semanas</option>
              <option value={31}>Ver: 1 mes</option>
              <option value={MAX_DIAS}>Ver: 2 meses</option>
              {modo === "rango" && ![14, 21, 31, MAX_DIAS].includes(dias.length) && <option value={-1} disabled>Ver: {dias.length} días</option>}
            </select>
            <button type="button" title="Configurar semana" aria-label="Configurar semana" onClick={() => { setCfgTmp(semanaCfg); setConfigAbierta(true); }} className="btn btn-secundario px-2.5 py-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><circle cx="12" cy="16" r="2" /></svg>
            </button>
            {modo === "rango" && (<>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gray-500)]">
              Desde
              <input type="date" value={desde} onChange={(e) => cambiarDesde(e.target.value)} className={barraCls} />
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gray-500)]">
              Hasta
              <input type="date" value={ultimo} min={desde} max={sumarDiasIso(desde, MAX_DIAS - 1)} onChange={(e) => cambiarHasta(e.target.value)} className={barraCls} />
            </label>
            </>)}
            <span className="rounded-md bg-[var(--navy)] text-white text-[12.5px] font-bold px-2.5 py-1">
              {(() => {
                const a = numeroSemana(desde, semanaCfg.dia_inicio);
                const b = numeroSemana(ultimo, semanaCfg.dia_inicio);
                return a === b ? `Semana ${a}` : `Semanas ${a}–${b}`;
              })()}
            </span>
            <p className="m-0 text-[13px] font-medium text-[var(--navy)]">
              {modo === "semana" && <span className="text-[var(--gray-500)] font-normal">{nombreDia(desde)} a {nombreDia(ultimo)} · </span>}
              {etiquetaDia(desde)} – {etiquetaDia(ultimo)} {ultimo.slice(0, 4)} · {dias.length} día(s)
            </p>
            <div className="flex-1" />
            <select value={filtroAsignacion} onChange={(e) => setFiltroAsignacion(e.target.value as "todas" | "con" | "sin")} className={barraCls} title="Filtrar por viajes en el periodo visible">
              <option value="todas">Todas las unidades</option>
              <option value="con">Con viajes asignados</option>
              <option value="sin">Sin viajes asignados</option>
            </select>
            <div className="relative">
              <button type="button" className={`btn btn-secundario py-1.5 ${ecosElegidos.length ? "border-[var(--blue)]! text-[var(--blue)]!" : ""}`} onClick={() => setSelectorEcosAbierto((v) => !v)}>
                {ecosElegidos.length ? `ECO (${ecosElegidos.length})` : "Elegir ECO"}
              </button>
              {selectorEcosAbierto && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setSelectorEcosAbierto(false)} />
                  <div className="absolute right-0 top-10 z-50 w-[220px] bg-white border border-[var(--gray-200)] rounded-lg shadow-lg p-2">
                    <div className="flex justify-between px-1 pb-2 mb-1 border-b border-[var(--gray-200)] text-[12px]">
                      <button type="button" className="text-[var(--blue)] font-medium" onClick={() => setEcosElegidos(unidades.map((u) => u.eco))}>Todas</button>
                      <button type="button" className="text-[var(--gray-500)] font-medium" onClick={() => setEcosElegidos([])}>Limpiar</button>
                    </div>
                    <div className="max-h-[280px] overflow-y-auto">
                      {unidades.map((u) => (
                        <label key={u.eco} className="flex items-center gap-2 px-1 py-1 text-[12.5px] cursor-pointer hover:bg-[var(--gray-100)] rounded">
                          <input type="checkbox" checked={ecosElegidos.includes(u.eco)} onChange={(e) => setEcosElegidos((prev) => (e.target.checked ? [...prev, u.eco] : prev.filter((x) => x !== u.eco)))} />
                          <span className="font-medium text-[var(--navy)]">{u.eco}</span>
                          {u.capacidad && <span className="text-[var(--gray-500)] truncate">{u.capacidad}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            <input type="search" placeholder="Buscar ECO, unidad o placas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${barraCls} w-[200px]`} />
            <div className="flex items-center rounded-md border border-[var(--gray-300)] overflow-hidden text-[12.5px]" role="group" aria-label="Vista">
              {(["calendario", "tabla"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={vista === m} onClick={() => setVista(m)} className={`px-3 py-1.5 font-medium ${vista === m ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)]"}`}>
                  {m === "calendario" ? "Calendario" : "Tabla"}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-secundario py-1.5" onClick={exportar} disabled={!viajes.length}>Exportar Excel</button>
          </div>
          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {pendientesImportacion > 0 && (
            <div className="flex flex-wrap items-center gap-3 mx-3 mt-3 rounded-md border border-[#f4d08a] bg-[#fdf6e3] px-3 py-2 text-[12.5px] text-[#7a5200]">
              <span>
                Importación Semana 40: {conciliacion!.ecosFaltantes.length} ECO no existen en Unidades y {conciliacion!.operadoresFaltantes.length} operador(es) sin expediente. Esos viajes no se ven hasta relacionarlos.
              </span>
              <button type="button" className="btn btn-secundario py-1 text-[12.5px]!" onClick={() => setConciliarAbierto(true)}>Revisar y relacionar</button>
            </div>
          )}
          {vista === "tabla" && (
            <div className="flex flex-wrap items-center gap-2 p-3 border-b border-[var(--gray-200)]">
              <span className="text-[12.5px] font-medium text-[var(--gray-500)]">Estatus</span>
              {([{ clave: "todos", etiqueta: "Todos" }, ...GRUPOS_ESTATUS] as { clave: "todos" | GrupoEstatus; etiqueta: string }[]).map((g) => (
                <button key={g.clave} type="button" aria-pressed={filtroEstatus === g.clave} onClick={() => setFiltroEstatus(g.clave)} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${filtroEstatus === g.clave ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white text-[var(--navy)] border-[var(--gray-300)]"}`}>
                  {g.etiqueta}
                </button>
              ))}
              <span className="ml-3 text-[12.5px] font-medium text-[var(--gray-500)]">Cuenta</span>
              <select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value)} className={barraCls}>
                <option value="">Todas</option>
                {cuentas.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-[12.5px] text-[var(--gray-500)]">{filasTabla.length} viaje(s) en el periodo visible</span>
            </div>
          )}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : vista === "tabla" ? (
            <div className="overflow-auto max-h-[calc(100vh-240px)] min-h-[200px]">
              <table className="w-full min-w-[980px] text-[13px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    {["ECO", "Cuenta", "Embarque", "Ruta o destino", "Operador", "Inicio programado", "Término estimado", "Estatus"].map((h) => (
                      <th key={h} className="sticky top-0 z-10 bg-white text-left px-3 py-2.5 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide border-b border-[var(--gray-200)]">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasTabla.map((v) => {
                    const g = grupoEstatus(estadoViaje(v.datos));
                    return (
                      <tr key={v.id} className="cursor-pointer hover:bg-[var(--gray-50)]" onClick={(e) => abrirResumen(v, e.currentTarget)}>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)] font-medium text-[var(--navy)]">{v.eco}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)]">{v.datos["NOMBRE CUENTA"] || "—"}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)]">{v.datos["No EMBARQUE"] || "—"}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)]">{[v.datos["ESTADO DESTINO"], v.datos["RUTA O DESTINO"]].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)]">{nombrePersona(v.operador_id)}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)] whitespace-nowrap">{fmtFH(v.datos["INICIO DE RUTA PROGRAMADO"] || v.fecha)}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)] whitespace-nowrap">{fmtFH(v.datos["TERMINO ESTIMADO DE TERMINO DEL SERVICIO"])}</td>
                        <td className="px-3 py-2 border-b border-[var(--gray-200)]">
                          <span className="inline-block rounded-full px-2.5 py-0.5 text-[12px] font-medium" style={{ background: g.solido, color: g.texto, border: `1px solid ${g.borde}` }}>{g.etiqueta}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filasTabla.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay viajes con estos filtros en el periodo visible.</td></tr>}
                </tbody>
              </table>
            </div>
          ) : (
            // Desplazamiento en ambos sentidos: encabezados de días fijos arriba y columna "Unidad" fija a la izquierda.
            <div className="overflow-auto max-h-[calc(100vh-240px)] min-h-[320px]" onScroll={alDesplazar}>
              <table className="text-[13px] border-separate border-spacing-0 table-fixed" style={{ width: anchoTabla }}>
                <colgroup>
                  <col style={{ width: ANCHO_UNIDAD }} />
                  {dias.map((d) => <col key={d} style={{ width: ANCHO_DIA }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 bg-white text-left px-4 py-3 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide border-b border-r border-[var(--gray-200)]">Unidad</th>
                    {dias.map((d) => (
                      <th key={d} className={`sticky top-0 z-20 px-1.5 py-2.5 text-center font-medium border-b border-[var(--gray-200)] ${d === hoy ? "bg-[#f2f6ff] text-[var(--blue)]" : "bg-white text-[var(--navy)]"}`}>
                        <span className="block text-[12.5px]">{nombreDia(d)}</span>
                        <span className="block text-[11px] text-[var(--gray-500)] font-normal">{etiquetaDia(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((u) => (
                    <tr key={u.eco} className={`group ${u.disponible === false ? "opacity-60" : ""}`} title={u.disponible === false ? "Unidad no disponible" : undefined}>
                      <td className={`sticky left-0 z-10 px-4 py-2 border-b border-r border-[var(--gray-200)] align-top ${u.disponible === false ? "bg-[#fbeceb]" : "bg-white group-hover:bg-[var(--gray-50)]"}`}>
                        <Link href={`/unidades?eco=${encodeURIComponent(u.eco)}&desde=calendario`} className="block no-underline hover:underline" title="Ver unidad">
                          <span className={`block font-medium ${u.disponible === false ? "text-[#b4443c]" : "text-[var(--navy)]"}`}>{u.eco}</span>
                          <span className="block text-[11.5px] text-[var(--gray-500)] truncate">{u.capacidad || "—"}</span>
                        </Link>
                      </td>
                      {dias.map((d) => (
                        <td key={d} className={`px-1.5 py-1.5 border-b border-[var(--gray-200)] align-top overflow-hidden ${u.disponible === false ? "bg-[#fdf3f2]" : d === hoy ? "bg-[#f7f9ff]" : "bg-white group-hover:bg-[var(--gray-50)]"}`}>
                          <div className="grid gap-1 min-w-0">
                            {(ocupadas.get(`${u.eco}|${d}`) || []).map(({ v, fin, primero }) => {
                              const g = grupoEstatus(estadoViaje(v.datos));
                              const ultimoDia = d === fin;
                              return (
                                <button
                                  key={`o${v.id}`}
                                  type="button"
                                  onClick={(e) => abrirResumen(v, e.currentTarget)}
                                  title={`Unidad ocupada hasta el término estimado (${etiquetaDia(fin)}) · ${etiquetaViaje(v.datos).linea1}`}
                                  className={`h-[26px] -ml-1.5 ${ultimoDia ? "mr-0 rounded-r-md" : "-mr-1.5"} px-2 text-left text-[11px] font-medium truncate border-y`}
                                  style={{ background: g.fondo, color: g.texto, borderColor: g.borde }}
                                >
                                  {primero ? `↳ ${etiquetaViaje(v.datos).linea1}` : ""}
                                </button>
                              );
                            })}
                            {(porCelda.get(`${u.eco}|${d}`) || []).map((v) => {
                              const et = etiquetaViaje(v.datos);
                              const g = grupoEstatus(estadoViaje(v.datos));
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={(e) => abrirResumen(v, e.currentTarget)}
                                  title={[et.linea1, et.linea2].filter(Boolean).join(" · ")}
                                  className="w-full min-w-0 overflow-hidden text-right rounded-md border px-1.5 py-1 text-[11.5px] leading-tight hover:shadow-sm"
                                  style={{ background: g.fondo, color: g.texto, borderColor: g.borde, borderLeftWidth: 4 }}
                                >
                                  <span className="block font-medium truncate">{et.linea1}</span>
                                  {et.linea2 && <span className="block opacity-80 truncate">{et.linea2}</span>}
                                </button>
                              );
                            })}
                            <button type="button" onClick={() => nuevo(u.eco, d)} className="w-full h-[26px] rounded-md border border-dashed border-[var(--gray-200)] text-[var(--gray-400)] text-[12px] hover:border-[var(--blue)] hover:text-[var(--blue)]" aria-label={`Agregar viaje ${u.eco} ${d}`}>+</button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {visibles.length === 0 && <tr><td colSpan={dias.length + 1} className="px-4 py-8 text-center text-[var(--gray-500)]">{unidades.length ? "Ninguna unidad coincide con los filtros." : "No hay unidades. Agrégalas en la sección Unidades."}</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 -mt-5 mb-8 text-[12.5px] text-[var(--gray-500)]">
          <span className="font-medium">Estatus</span>
          {GRUPOS_ESTATUS.map((g) => (
            <span key={g.clave} className="rounded-full px-2.5 py-0.5 font-medium" style={{ background: g.solido, color: g.texto, border: `1px solid ${g.borde}` }}>{g.etiqueta}</span>
          ))}
          <span className="text-[12px]">· Las barras sombreadas son los días que la unidad sigue ocupada hasta el término estimado del viaje.</span>
        </div>
      </div>

      {resumen && (() => {
        const v = resumen.v;
        const d = v.datos;
        const g = grupoEstatus(estadoViaje(d));
        const u = unidades.find((x) => x.eco === v.eco);
        const ruta = rutas.find((r) => r.nombre === d["RUTA O DESTINO"]);
        const bono = ruta && !esViajeLocal(d) ? (ruta.bonos_unidad[v.eco] ?? ruta.bono) : null;
        const est = calcularEstatusViaje(d);
        const dato = (t: string, x: React.ReactNode) => (
          <div><div className="text-[11.5px] text-[var(--gray-500)]">{t}</div><div className="text-[13.5px] font-medium text-[var(--navy)]">{x || "—"}</div></div>
        );
        return (
          <div className="fixed inset-0 z-50 bg-[rgba(22,33,92,0.15)]" onClick={() => setResumen(null)}>
            <div role="dialog" aria-label="Resumen del viaje" onClick={(e) => e.stopPropagation()} className="fixed bg-white rounded-lg shadow-2xl border border-[var(--gray-300)] overflow-y-auto" style={{ left: resumen.left, top: resumen.top, width: resumen.w, maxHeight: resumen.maxH }}>
              <div className="px-5 py-4" style={{ background: g.solido, color: g.texto }}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11.5px] opacity-80 uppercase tracking-wide">ECO-Unidad</div>
                    <div className="text-[28px] font-bold leading-tight">{v.eco}</div>
                    <div className="text-[13px]">{[u?.capacidad, d["NOMBRE CUENTA"], d["No EMBARQUE"] ? `Emb. ${d["No EMBARQUE"]}` : ""].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-[13px] font-bold border border-black/15">{g.etiqueta}</span>
                </div>
              </div>
              <div className="p-5 grid gap-4">
                <div className="grid grid-cols-2 gap-3">
                  {dato("Operador", nombrePersona(v.operador_id))}
                  {dato("Ayudante", nombrePersona(v.ayudante_id))}
                  {dato("Estado · ruta", [d["ESTADO DESTINO"], d["RUTA O DESTINO"]].filter(Boolean).join(" · "))}
                  {dato("Tipo de servicio", esViajeLocal(d) ? "Local" : "Foráneo")}
                  {dato("Inicio programado", fmtFH(d["INICIO DE RUTA PROGRAMADO"]))}
                  {dato("Inicio de ruta", d["INICIO DE RUTA"] ? fmtFH(d["INICIO DE RUTA"]) : "")}
                  {dato("Término de servicio", d["TERMINO DE SERVICIO"] ? fmtFH(d["TERMINO DE SERVICIO"]) : "")}
                  {dato("Arribo a patio (regreso)", d["ARRIBO A PATIOO"] ? fmtFH(d["ARRIBO A PATIOO"]) : "")}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-[var(--gray-50)] border border-[var(--gray-200)] p-3">
                  {dato("Horas de ida", duracionViaje(d["INICIO DE RUTA"], d["TERMINO DE SERVICIO"]))}
                  {dato("Horas de regreso", duracionViaje(d["TERMINO DE SERVICIO"], d["ARRIBO A PATIOO"]))}
                  {dato("Estatus patio", est.patio)}
                  {dato("Estatus almacén", est.almacen)}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg bg-[var(--gray-50)] border border-[var(--gray-200)] p-3">
                  {dato("Casetas", Number(d["GASTOS CASETAS"]) ? moneda(Number(d["GASTOS CASETAS"])) : "")}
                  {dato("Viáticos efectivo", Number(d["VIATICOS EFECTIVO"]) ? moneda(Number(d["VIATICOS EFECTIVO"])) : "")}
                  {dato("Viáticos transferencia", Number(d["VIATICOS TRANSFERENCIA"]) ? moneda(Number(d["VIATICOS TRANSFERENCIA"])) : "")}
                  {dato("Bono de ruta", bono !== null ? moneda(bono) : "")}
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" className="btn btn-secundario" onClick={() => setResumen(null)}>Cerrar</button>
                  <button type="button" className="btn btn-primario" onClick={() => { setResumen(null); abrir(v); }}>Editar viaje</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {edicion && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[900px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)] grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{edicion.id ? "Viaje" : "Nuevo viaje"} · {edicion.eco}</h3>
                  <p className="text-[12.5px] text-[var(--gray-500)] m-0">Se muestra en el calendario como Cuenta + Estado destino / Ruta + Embarque.</p>
                </div>
              </div>
              {/* Datos principales arriba: número de embarque, foráneo/local y fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr] gap-3 items-end">
                <div>
                  <label className={labelCls}>No. embarque</label>
                  <input type="text" value={edicion.datos["No EMBARQUE"] || ""} onChange={(e) => setDato("No EMBARQUE", e.target.value)} className={`${inputCls} font-medium`} autoFocus={!edicion.id} />
                </div>
                <div>
                  <label className={labelCls}>Tipo de servicio</label>
                  <div className="grid grid-cols-2 rounded-md border border-[var(--gray-300)] overflow-hidden">
                    {OPCIONES_TIPO_SERVICIO.map((o) => {
                      const activo = (edicion.datos["TIPO DE SERVICIO"] || "FORANEO").toUpperCase() === o.valor;
                      return (
                        <button key={o.valor} type="button" onClick={() => setDato("TIPO DE SERVICIO", o.valor)} className={`py-2 text-[13px] font-medium ${activo ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)] hover:bg-[var(--gray-50)]"}`}>
                          {o.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fecha del viaje</label>
                  <input type="date" value={edicion.fecha} onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {GASTOS_VIAJE.map((g) => {
                  const monto = Number(edicion.datos[g.clave]) || 0;
                  return (
                    <button key={g.clave} type="button" onClick={() => setGastoAbierto(gastoAbierto === g.clave ? null : g.clave)} className={`btn py-1.5 ${gastoAbierto === g.clave ? "btn-primario" : "btn-secundario"}`}>
                      {g.boton}
                      {monto > 0 && <span className={`text-[11.5px] rounded px-1.5 py-0.5 ${gastoAbierto === g.clave ? "bg-white/20" : "bg-[var(--blue-light)] text-[var(--blue)]"}`}>{moneda(monto)}</span>}
                    </button>
                  );
                })}
              </div>
              {gastoSel && (
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg p-3">
                  <div>
                    <label className={labelCls}>{gastoSel.boton} · monto</label>
                    <CampoMoneda valor={Number(edicion.datos[gastoSel.clave]) || 0} onCambio={(n) => setDato(gastoSel.clave, n ? String(n) : "")} />
                  </div>
                  <div>
                    <label className={labelCls}>Detalle / comentario</label>
                    <input type="text" value={edicion.datos[`${gastoSel.clave} DETALLE`] || ""} onChange={(e) => setDato(`${gastoSel.clave} DETALLE`, e.target.value)} className={inputCls} placeholder="Ej. casetas México–Querétaro, folio de transferencia…" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 grid gap-5">
              {GRUPOS_VIAJE.map((g) => (
                <section key={g}>
                  <h4 className="text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-2">{g}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{CAMPOS_VIAJE.filter((c) => c.grupo === g).map(campo)}</div>
                </section>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              {edicion.id && <button type="button" className="mr-auto text-[12.5px] text-[var(--red)] hover:underline" onClick={eliminar}>Eliminar viaje</button>}
              <button type="button" className="btn btn-secundario" onClick={() => setEdicion(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
