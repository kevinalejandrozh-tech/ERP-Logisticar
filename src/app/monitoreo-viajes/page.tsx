"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import { UNIDADES } from "@/lib/unidadesData";
import { construirCampos, DIAS_SEMANA, CampoViaje } from "@/lib/monitoreoData";
import { mapearFilasExcel } from "@/lib/importarViajesExcel";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
type Viaje = { id: number } & Record<string, string>;

function mostrarFechaHora(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatearDuracion(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (dias > 0 || horas > 0) partes.push(`${horas}h`);
  partes.push(`${min}m`);
  return partes.join(" ");
}

function calcularIndicador(real?: string, planeado?: string): { texto: string; clase: string } {
  if (!real || !planeado) return { texto: "—", clase: "bg-[var(--gray-100)] text-[var(--gray-400)]" };
  const dReal = new Date(real).getTime();
  const dPlan = new Date(planeado).getTime();
  if (isNaN(dReal) || isNaN(dPlan)) return { texto: "—", clase: "bg-[var(--gray-100)] text-[var(--gray-400)]" };
  if (dReal <= dPlan) return { texto: "ON TIME", clase: "bg-[var(--green)] text-white" };
  return { texto: `TARDE ${formatearDuracion(dReal - dPlan)}`, clase: "bg-[var(--red)] text-white" };
}

function calcularTiempoRuta(inicio?: string, fin?: string, ahora?: number): string {
  if (!inicio) return "—";
  const dI = new Date(inicio).getTime();
  if (isNaN(dI)) return "—";
  if (fin) {
    const dF = new Date(fin).getTime();
    if (isNaN(dF) || dF < dI) return "—";
    return formatearDuracion(dF - dI);
  }
  if (ahora) return `${formatearDuracion(Math.max(0, ahora - dI))} (en curso)`;
  return "—";
}

function semanaISO(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
}

export default function MonitoreoViajesPage() {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [operadores, setOperadores] = useState<string[]>([]);
  const [tick, setTick] = useState(Date.now());
  const [importando, setImportando] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const inputExcelRef = useRef<HTMLInputElement>(null);

  const ecosUnidad = useMemo(() => UNIDADES.map((u) => u.eco), []);
  const campos: CampoViaje[] = useMemo(() => construirCampos(operadores, ecosUnidad), [operadores, ecosUnidad]);

  // ---- Seleccion y orden de columnas de "Viajes registrados" ----
  const [ordenColumnas, setOrdenColumnas] = useState<string[]>([]);
  const [columnasOcultas, setColumnasOcultas] = useState<Set<string>>(new Set());
  const [panelColumnasAbierto, setPanelColumnasAbierto] = useState(false);
  const [colArrastrada, setColArrastrada] = useState<string | null>(null);

  useEffect(() => {
    setOrdenColumnas((prev) => {
      const claves = campos.map((c) => c.key);
      const conservadas = prev.filter((k) => claves.includes(k));
      const nuevas = claves.filter((k) => !prev.includes(k));
      return [...conservadas, ...nuevas];
    });
  }, [campos]);

  const columnasMostrar = useMemo(
    () => ordenColumnas.filter((k) => !columnasOcultas.has(k)).map((k) => campos.find((c) => c.key === k)).filter((c): c is CampoViaje => !!c),
    [ordenColumnas, columnasOcultas, campos]
  );
  const toggleColumnaVisible = (key: string) => {
    setColumnasOcultas((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };
  const moverColumna = (origen: string, destino: string) => {
    if (origen === destino) return;
    setOrdenColumnas((prev) => {
      const arr = [...prev];
      const iOrigen = arr.indexOf(origen);
      const iDestino = arr.indexOf(destino);
      if (iOrigen === -1 || iDestino === -1) return prev;
      arr.splice(iOrigen, 1);
      arr.splice(iDestino, 0, origen);
      return arr;
    });
  };

  const cargar = async () => {
    try {
      const res = await fetch("/api/viajes/list", { cache: "no-store" });
      const data = await res.json();
      setViajes(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    } finally {
      setCargando(false);
    }
  };
  const cargarOperadores = async () => {
    try {
      const res = await fetch("/api/operadores/list", { cache: "no-store" });
      const data = await res.json();
      setOperadores((data.registros || []).map((o: { nombre: string }) => o.nombre));
    } catch {
      // el campo sigue funcionando con lista vacia
    }
  };

  useEffect(() => {
    cargar();
    cargarOperadores();
    const idTick = setInterval(() => setTick(Date.now()), 60000);
    return () => {
      clearInterval(idTick);
    };
  }, []);
  useRefrescarAlEnfocar(cargar);

  // ---- Edicion en linea ----
  const actualizarLocal = (id: number, key: string, valor: string) => {
    setViajes((prev) => prev.map((v) => (v.id === id ? { ...v, [key]: valor } : v)));
  };
  const guardarCampo = (id: number, key: string, valor: string) => {
    fetch("/api/viajes/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, campos: { [key]: valor } }),
    }).catch(() => cargar());
  };
  const cambiarCampo = (v: Viaje, c: CampoViaje, valor: string) => {
    actualizarLocal(v.id, c.key, valor);
    guardarCampo(v.id, c.key, valor);
  };

  const agregarViaje = async () => {
    try {
      const res = await fetch("/api/viajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el viaje.");
      setViajes((prev) => [{ id: data.id }, ...prev]);
    } catch (err: any) {
      alert(err.message || "No se pudo agregar el viaje.");
    }
  };

  const eliminarViaje = async (id: number) => {
    if (!confirm("¿Eliminar este viaje? Esta acción no se puede deshacer.")) return;
    setViajes((prev) => prev.filter((v) => v.id !== id));
    try {
      await fetch("/api/viajes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargar();
    }
  };

  // ---- Importar Excel ----
  const procesarArchivoExcel = async (file: File) => {
    setImportando(true);
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true });
      const hoja = wb.Sheets[wb.SheetNames[0]];
      const filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: null }) as unknown[][];
      const { viajes: nuevos, celdasNoInterpretadas } = mapearFilasExcel(filas);
      if (nuevos.length === 0) {
        alert("No se encontraron filas de datos para importar.");
        return;
      }
      let creados = 0;
      for (const viaje of nuevos) {
        const res = await fetch("/api/viajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(viaje),
        });
        if (res.ok) creados++;
      }
      await cargar();
      alert(`Se importaron ${creados} de ${nuevos.length} viajes.${celdasNoInterpretadas > 0 ? ` ${celdasNoInterpretadas} celda(s) de fecha no se pudieron interpretar y quedaron en blanco.` : ""}`);
    } catch (err: any) {
      alert(err.message || "No se pudo leer el archivo Excel.");
    } finally {
      setImportando(false);
    }
  };

  const onDropExcel = (e: React.DragEvent) => {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files?.[0];
    if (file) procesarArchivoExcel(file);
  };

  const exportar = () => {
    exportarExcel(`Viajes_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Viajes",
        filas: viajes.map((v) => {
          const fila: Record<string, string> = { ID: String(v.id) };
          campos.forEach((c) => (fila[c.label] = v[c.key] || ""));
          return fila;
        }),
      },
    ]);
  };

  // ---- Datos del dashboard ----
  const semanaActual = useMemo(() => semanaISO(new Date()), []);
  const unidadesEnRuta = useMemo(() => viajes.filter((v) => !v.terminoServicio).length, [viajes]);
  const porCuenta = useMemo(() => {
    const mapa: Record<string, number> = {};
    viajes.forEach((v) => {
      const c = v.nombreCuenta?.trim();
      if (c) mapa[c] = (mapa[c] || 0) + 1;
    });
    return mapa;
  }, [viajes]);
  const porDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    viajes.forEach((v) => {
      if (v.dia) mapa[v.dia] = (mapa[v.dia] || 0) + 1;
    });
    return mapa;
  }, [viajes]);
  const conteoAsistencia = useMemo(() => {
    let onTime = 0;
    let tarde = 0;
    viajes.forEach((v) => {
      const r = calcularIndicador(v.horaArriboPatio, v.citaCargaPatio);
      if (r.texto === "ON TIME") onTime++;
      else if (r.texto.startsWith("TARDE")) tarde++;
    });
    return { onTime, tarde };
  }, [viajes]);
  const conteoCarga = useMemo(() => {
    let onTime = 0;
    let tarde = 0;
    viajes.forEach((v) => {
      const r = calcularIndicador(v.arriboAlmacenCarga, v.cargaPlaneadaCliente);
      if (r.texto === "ON TIME") onTime++;
      else if (r.texto.startsWith("TARDE")) tarde++;
    });
    return { onTime, tarde };
  }, [viajes]);
  const porOperador = useMemo(() => {
    const mapa: Record<
      string,
      { total: number; foraneos: number; locales: number; asistenciaOnTime: number; asistenciaTarde: number; cargaOnTime: number; cargaTarde: number }
    > = {};
    viajes.forEach((v) => {
      const op = v.operador?.trim();
      if (!op) return;
      if (!mapa[op]) mapa[op] = { total: 0, foraneos: 0, locales: 0, asistenciaOnTime: 0, asistenciaTarde: 0, cargaOnTime: 0, cargaTarde: 0 };
      mapa[op].total++;
      const serv = (v.tipoServicio || "").trim().toUpperCase();
      if (serv === "FORANEO") mapa[op].foraneos++;
      if (serv === "LOCAL") mapa[op].locales++;
      const ra = calcularIndicador(v.horaArriboPatio, v.citaCargaPatio);
      if (ra.texto === "ON TIME") mapa[op].asistenciaOnTime++;
      else if (ra.texto.startsWith("TARDE")) mapa[op].asistenciaTarde++;
      const rc = calcularIndicador(v.arriboAlmacenCarga, v.cargaPlaneadaCliente);
      if (rc.texto === "ON TIME") mapa[op].cargaOnTime++;
      else if (rc.texto.startsWith("TARDE")) mapa[op].cargaTarde++;
    });
    return mapa;
  }, [viajes]);

  const [filtroOperadorTiene, setFiltroOperadorTiene] = useState<"todos" | "con" | "sin">("todos");
  const [ordenOperador, setOrdenOperador] = useState<{ campo: "total" | "foraneos" | "locales"; dir: "asc" | "desc" } | null>(null);
  const filasOperador = useMemo(() => {
    const vacio = { total: 0, foraneos: 0, locales: 0, asistenciaOnTime: 0, asistenciaTarde: 0, cargaOnTime: 0, cargaTarde: 0 };
    let base: { op: string; total: number; foraneos: number; locales: number; asistenciaOnTime: number; asistenciaTarde: number; cargaOnTime: number; cargaTarde: number }[];
    if (filtroOperadorTiene === "con") {
      base = Object.entries(porOperador).map(([op, d]) => ({ op, ...d }));
    } else if (filtroOperadorTiene === "sin") {
      base = operadores.filter((o) => !porOperador[o]).map((op) => ({ op, ...vacio }));
    } else {
      const nombres = Array.from(new Set([...Object.keys(porOperador), ...operadores]));
      base = nombres.map((op) => ({ op, ...(porOperador[op] || vacio) }));
    }
    if (ordenOperador) {
      const { campo, dir } = ordenOperador;
      base = [...base].sort((a, b) => (dir === "desc" ? b[campo] - a[campo] : a[campo] - b[campo]));
    }
    return base;
  }, [porOperador, operadores, filtroOperadorTiene, ordenOperador]);
  const alternarOrdenOperador = (campo: "total" | "foraneos" | "locales") => {
    setOrdenOperador((prev) => {
      if (!prev || prev.campo !== campo) return { campo, dir: "desc" };
      return { campo, dir: prev.dir === "desc" ? "asc" : "desc" };
    });
  };

  const [seccionActiva, setSeccionActiva] = useState<"resumen" | "registrados" | null>(null);

  const [filtroEstadoResumen, setFiltroEstadoResumen] = useState<"todos" | "curso" | "terminado">("todos");
  const viajesResumenFiltrados = useMemo(() => {
    if (filtroEstadoResumen === "curso") return viajes.filter((v) => !v.terminoServicio);
    if (filtroEstadoResumen === "terminado") return viajes.filter((v) => !!v.terminoServicio);
    return viajes;
  }, [viajes, filtroEstadoResumen]);

  const maxDia = Math.max(1, ...DIAS_SEMANA.map((d) => porDia[d] || 0));

  // ---- Seguimiento a Rutas / Detalle por ruta ----
  const destinosUnicos = useMemo(() => Array.from(new Set(viajes.map((v) => v.rutaDestino).filter(Boolean))).sort(), [viajes]);
  const [busquedaRuta, setBusquedaRuta] = useState("");
  const [rutaSeleccionada, setRutaSeleccionada] = useState<string | null>(null);
  const sugerenciasRuta = useMemo(() => {
    const q = busquedaRuta.trim().toLowerCase();
    if (!q) return [];
    return destinosUnicos.filter((d) => d.toLowerCase().includes(q)).slice(0, 8);
  }, [busquedaRuta, destinosUnicos]);
  const viajesDeRutaSeleccionada = useMemo(() => (rutaSeleccionada ? viajes.filter((v) => v.rutaDestino === rutaSeleccionada) : []), [viajes, rutaSeleccionada]);

  const renderCelda = (v: Viaje, c: CampoViaje) => {
    const valor = v[c.key] || "";
    if (c.tipo === "dia") {
      return (
        <select value={valor} onChange={(e) => cambiarCampo(v, c, e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11.5px] w-[95px]">
          <option value=""></option>
          {DIAS_SEMANA.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      );
    }
    if (c.tipo === "datetime") {
      return <input type="datetime-local" value={valor} onChange={(e) => cambiarCampo(v, c, e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[10.5px] w-[152px]" />;
    }
    if (c.tipo === "number") {
      return (
        <input
          type="number"
          value={valor}
          onChange={(e) => actualizarLocal(v.id, c.key, e.target.value)}
          onBlur={(e) => guardarCampo(v.id, c.key, e.target.value)}
          className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11.5px] w-[65px]"
        />
      );
    }
    if (c.tipo === "select") {
      return (
        <select value={valor} onChange={(e) => cambiarCampo(v, c, e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11.5px] w-[140px]">
          <option value=""></option>
          {c.opciones?.map((op) => (
            <option key={op} value={op}>
              {op}
            </option>
          ))}
        </select>
      );
    }
    if (c.tipo === "datalist") {
      return (
        <>
          <datalist id={`dl-${c.key}-${v.id}`}>
            {c.opciones?.map((op) => (
              <option key={op} value={op} />
            ))}
          </datalist>
          <input
            value={valor}
            onChange={(e) => actualizarLocal(v.id, c.key, e.target.value)}
            onBlur={(e) => guardarCampo(v.id, c.key, e.target.value)}
            list={`dl-${c.key}-${v.id}`}
            className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11.5px] w-[140px]"
          />
        </>
      );
    }
    return (
      <input
        value={valor}
        onChange={(e) => actualizarLocal(v.id, c.key, e.target.value)}
        onBlur={(e) => guardarCampo(v.id, c.key, e.target.value)}
        className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11.5px] w-[120px]"
      />
    );
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Monitoreo de viajes y rutas"
          subtitulo="Consulta el monitoreo en tiempo real de viajes y rutas."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>}
        />

        {/* Dashboard */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-5">
          <div className="bg-gradient-to-br from-[var(--navy)] to-[#2a3a8f] rounded-2xl p-5 flex flex-col justify-center items-center text-center lg:col-span-1">
            <p className="text-[11px] font-bold uppercase tracking-widest text-[#a9c2ee] m-0 mb-1">Semana</p>
            <p className="text-[46px] font-bold text-white m-0 leading-none">{semanaActual}</p>
            <p className="text-[11px] text-[#a9c2ee] m-0 mt-1">{new Date().getFullYear()}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-5 flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1.5">Unidades en ruta</p>
            <p className="text-[32px] font-bold text-[var(--blue)] m-0 leading-none">{unidadesEnRuta}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-5 flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1.5">Total de viajes</p>
            <p className="text-[32px] font-bold text-[var(--navy)] m-0 leading-none">{viajes.length}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-5 flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Asistencia a patio</p>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-[28px] font-bold text-[var(--green)] m-0 leading-none">{conteoAsistencia.onTime}</p>
                <p className="text-[9.5px] font-bold text-[var(--gray-400)] uppercase m-0">On time</p>
              </div>
              <div>
                <p className="text-[28px] font-bold text-[var(--red)] m-0 leading-none">{conteoAsistencia.tarde}</p>
                <p className="text-[9.5px] font-bold text-[var(--gray-400)] uppercase m-0">Tarde</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-5 flex flex-col justify-center">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Carga con cliente</p>
            <div className="flex items-end gap-4">
              <div>
                <p className="text-[28px] font-bold text-[var(--green)] m-0 leading-none">{conteoCarga.onTime}</p>
                <p className="text-[9.5px] font-bold text-[var(--gray-400)] uppercase m-0">On time</p>
              </div>
              <div>
                <p className="text-[28px] font-bold text-[var(--red)] m-0 leading-none">{conteoCarga.tarde}</p>
                <p className="text-[9.5px] font-bold text-[var(--gray-400)] uppercase m-0">Tarde</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 mb-5">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Viajes por cuenta</p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(porCuenta).length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin datos.</span>}
            {Object.entries(porCuenta).map(([cuenta, n]) => (
              <span key={cuenta} className="bg-[var(--blue-light)] text-[var(--navy)] text-[11px] font-bold px-2.5 py-1 rounded-full">
                {cuenta} ({n})
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-3.5">
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Seguimiento a Rutas</p>
            <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["ECO. Unidad", "Operador", "Destino", "Estatus", "Ubicación", "Indicador monitoreo", "Avance"].map((c) => (
                      <th key={c} className="text-left text-[8.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap sticky top-0">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {viajes.map((v) => (
                    <tr key={v.id} className="border-b border-[var(--gray-200)]">
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{v.ecoUnidad || "—"}</td>
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{v.operador || "—"}</td>
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{v.rutaDestino || "—"}</td>
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{v.terminoServicio ? "Terminado" : "En curso"}</td>
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-[var(--gray-400)]">—</td>
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-[var(--gray-400)]">—</td>
                      <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-[var(--gray-400)]">—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {viajes.length === 0 && <p className="text-center text-[var(--gray-400)] text-[12.5px] py-6">Sin datos.</p>}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Detalle por ruta</p>
            <div className="relative mb-3">
              <div className="flex items-center gap-2 bg-white border border-[var(--gray-200)] rounded-lg px-3 py-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <input
                  value={busquedaRuta}
                  onChange={(e) => {
                    setBusquedaRuta(e.target.value);
                    setRutaSeleccionada(null);
                  }}
                  placeholder="Busca un destino o viaje en curso..."
                  className="flex-1 outline-none text-[12.5px]"
                />
              </div>
              {sugerenciasRuta.length > 0 && !rutaSeleccionada && (
                <div className="absolute z-10 top-full left-0 right-0 bg-white border border-[var(--gray-200)] rounded-lg shadow-md mt-1 max-h-[180px] overflow-y-auto">
                  {sugerenciasRuta.map((d) => (
                    <div
                      key={d}
                      onClick={() => {
                        setRutaSeleccionada(d);
                        setBusquedaRuta(d);
                      }}
                      className="px-3 py-2 text-[12.5px] text-[var(--navy)] cursor-pointer hover:bg-[var(--gray-100)]"
                    >
                      {d}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {!rutaSeleccionada ? (
              <p className="text-center text-[var(--gray-400)] text-[12.5px] py-8">Selecciona un destino para ver su detalle.</p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-[150px] overflow-y-auto">
                <p className="text-[12px] text-[var(--navy)] font-bold m-0">
                  {viajesDeRutaSeleccionada.length} viaje(s) a {rutaSeleccionada}
                </p>
                {viajesDeRutaSeleccionada.map((v) => (
                  <div key={v.id} className="flex items-center justify-between text-[11.5px] border-b border-[var(--gray-200)] pb-1">
                    <span className="text-[var(--navy)]">
                      {v.operador || "—"} · {v.ecoUnidad || "—"}
                    </span>
                    <span className={v.terminoServicio ? "text-[var(--green)] font-semibold" : "text-[var(--blue)] font-semibold"}>{v.terminoServicio ? "Terminado" : "En curso"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-5">
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Viajes por día</p>
            <svg viewBox="0 0 500 150" className="w-full h-auto">
              <line x1={30} y1={110} x2={470} y2={110} stroke="#e5e8ee" strokeWidth={1} />
              <polyline
                points={DIAS_SEMANA.map((dia, i) => {
                  const x = 30 + i * ((470 - 30) / (DIAS_SEMANA.length - 1));
                  const n = porDia[dia] || 0;
                  const y = 110 - (n / maxDia) * 80;
                  return `${x},${y}`;
                }).join(" ")}
                fill="none"
                stroke="#2f6fed"
                strokeWidth={2}
              />
              {DIAS_SEMANA.map((dia, i) => {
                const x = 30 + i * ((470 - 30) / (DIAS_SEMANA.length - 1));
                const n = porDia[dia] || 0;
                const y = 110 - (n / maxDia) * 80;
                return (
                  <g key={dia}>
                    <circle cx={x} cy={y} r={5} fill="#2f6fed" />
                    <text x={x} y={y - 10} fontSize={10} textAnchor="middle" fill="#16215c" fontWeight="bold">
                      {n}
                    </text>
                    <text x={x} y={128} fontSize={9} textAnchor="middle" fill="#9aa1b0">
                      {dia.slice(0, 3)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Desempeño por operador</p>
              <div className="flex gap-1">
                {([
                  ["todos", "Todos"],
                  ["con", "Con viajes"],
                  ["sin", "Sin viajes"],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFiltroOperadorTiene(key)}
                    className={`text-[9.5px] font-bold px-2 py-1 rounded-full ${filtroOperadorTiene === key ? "bg-[var(--navy)] text-white" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    <th className="text-left text-[8.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap sticky top-0">Operador</th>
                    {([
                      ["total", "Total"],
                      ["foraneos", "Foráneos"],
                      ["locales", "Locales"],
                    ] as const).map(([campo, label]) => (
                      <th key={campo} className="text-left text-[8.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap sticky top-0">
                        <button type="button" onClick={() => alternarOrdenOperador(campo)} className="flex items-center gap-1 text-white">
                          {label}
                          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3">
                            {ordenOperador?.campo === campo && ordenOperador.dir === "asc" ? <path d="M18 15l-6-6-6 6" /> : <path d="M6 9l6 6 6-6" />}
                          </svg>
                        </button>
                      </th>
                    ))}
                    {["LLEGADA A PATIO", "CARGA CON CLIENTE", "Eficiencia de operador"].map((c) => (
                      <th key={c} className="text-left text-[8.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap sticky top-0">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filasOperador.map((d) => {
                    const eficiencia = d.total > 0 ? (((d.asistenciaTarde + d.cargaTarde) / d.total) * 100).toFixed(1) : "—";
                    return (
                      <tr key={d.op} className="border-b border-[var(--gray-200)]">
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{d.op}</td>
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-center">{d.total}</td>
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-center">{d.foraneos}</td>
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-center">{d.locales}</td>
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-center">
                          <span className="text-[var(--green)] font-semibold">{d.asistenciaOnTime}</span> / <span className="text-[var(--red)] font-semibold">{d.asistenciaTarde}</span>
                        </td>
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-center">
                          <span className="text-[var(--green)] font-semibold">{d.cargaOnTime}</span> / <span className="text-[var(--red)] font-semibold">{d.cargaTarde}</span>
                        </td>
                        <td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap text-center font-semibold text-[var(--navy)]">{eficiencia === "—" ? "—" : `${eficiencia}%`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filasOperador.length === 0 && <p className="text-center text-[var(--gray-400)] text-[12.5px] py-6">Sin datos.</p>}
            </div>
          </div>
        </div>

        {/* Botones para mostrar/ocultar tablas */}
        <div className="flex flex-wrap gap-2.5 mb-5">
          <button
            type="button"
            onClick={() => setSeccionActiva("resumen")}
            className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "resumen" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
          >
            Resumen de monitoreo
          </button>
          <button
            type="button"
            onClick={() => setSeccionActiva("registrados")}
            className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "registrados" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
          >
            Viajes registrados
          </button>
          <button type="button" onClick={() => setSeccionActiva(null)} className="text-[13px] font-bold px-5 py-2.5 rounded-lg bg-white border border-[var(--gray-200)] text-[var(--gray-400)]">
            Ocultar
          </button>
        </div>

        {/* Resumen de monitoreo */}
        {seccionActiva === "resumen" && (
        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-5">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
            <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Resumen de monitoreo</h3>
            <div className="flex gap-1.5">
              {([
                ["todos", "Todos"],
                ["curso", "En curso"],
                ["terminado", "Terminados"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFiltroEstadoResumen(key)}
                  className={`text-[11.5px] font-bold px-3 py-1.5 rounded-full ${filtroEstadoResumen === key ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse min-w-max w-full">
              <thead>
                <tr>
                  {["Detalles", "Cuenta", "ECO. Unidad", "Operador", "Estado/Destino", "Tiros", "Indicador asistencia", "Indicador carga c/cliente", "Indicador Monitoreo", "Termino de servicio", "Tiempo en ruta"].map((c) => (
                    <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viajesResumenFiltrados.map((v) => {
                  const indAsistencia = calcularIndicador(v.horaArriboPatio, v.citaCargaPatio);
                  const indCarga = calcularIndicador(v.arriboAlmacenCarga, v.cargaPlaneadaCliente);
                  const tiempoRuta = calcularTiempoRuta(v.inicioRuta, v.terminoServicio, tick);
                  return (
                    <tr key={v.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <Link href={`/monitoreo-viajes/detalle?id=${v.id}`} className="inline-flex items-center gap-1 text-[11.5px] text-[var(--blue)] font-semibold no-underline" title="Detalles de viaje">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                          Detalles
                        </Link>
                      </td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.nombreCuenta || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.ecoUnidad || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.operador || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.rutaDestino || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.tiros || "—"}</td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-block text-center text-[9.5px] font-bold uppercase px-2 py-1 rounded-full ${indAsistencia.clase}`}>{indAsistencia.texto}</span>
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className={`inline-block text-center text-[9.5px] font-bold uppercase px-2 py-1 rounded-full ${indCarga.clase}`}>{indCarga.texto}</span>
                      </td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap text-[var(--gray-400)]">—</td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <input
                          type="datetime-local"
                          value={v.terminoServicio || ""}
                          onChange={(e) => cambiarCampo(v, { key: "terminoServicio", label: "", tipo: "datetime" }, e.target.value)}
                          className="border border-[var(--gray-200)] rounded-md px-1.5 py-1 text-[11px]"
                        />
                      </td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{tiempoRuta}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!cargando && viajes.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin viajes registrados.</div>}
          </div>
        </div>
        )}

        {/* Viajes registrados: tabla editable en linea */}
        {seccionActiva === "registrados" && (
        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Viajes registrados</h3>
              <button type="button" onClick={agregarViaje} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                + Viaje
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setPanelColumnasAbierto((p) => !p)}
                  className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="3" y="3" width="7" height="18" /><rect x="14" y="3" width="7" height="18" /></svg>
                  Columnas
                </button>
                {panelColumnasAbierto && (
                  <div className="absolute z-20 top-full left-0 mt-1 bg-white border border-[var(--gray-200)] rounded-lg shadow-lg w-[260px] max-h-[340px] overflow-y-auto p-2">
                    <p className="text-[10.5px] text-[var(--gray-400)] px-2 pt-1 pb-2 m-0">Marca para mostrar/ocultar. Arrastra para reordenar.</p>
                    {ordenColumnas.map((key) => {
                      const c = campos.find((x) => x.key === key);
                      if (!c) return null;
                      return (
                        <div
                          key={key}
                          draggable
                          onDragStart={() => setColArrastrada(key)}
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={() => {
                            if (colArrastrada) moverColumna(colArrastrada, key);
                            setColArrastrada(null);
                          }}
                          className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--gray-100)] cursor-grab"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><circle cx="8" cy="6" r="1" /><circle cx="8" cy="12" r="1" /><circle cx="8" cy="18" r="1" /><circle cx="16" cy="6" r="1" /><circle cx="16" cy="12" r="1" /><circle cx="16" cy="18" r="1" /></svg>
                          <input type="checkbox" checked={!columnasOcultas.has(key)} onChange={() => toggleColumnaVisible(key)} className="accent-[var(--blue)]" />
                          <span className="text-[12px] text-[var(--navy)]">{c.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={onDropExcel}
                onClick={() => inputExcelRef.current?.click()}
                className={`text-[11px] text-[var(--gray-400)] border border-dashed rounded-lg px-3 py-1.5 cursor-pointer ${arrastrando ? "border-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)]"}`}
              >
                {importando ? "Importando..." : "Arrastra o haz clic para importar Excel"}
              </div>
              <input
                ref={inputExcelRef}
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) procesarArchivoExcel(file);
                  e.target.value = "";
                }}
              />
              {!cargando && viajes.length > 0 && (
                <button type="button" onClick={exportar} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                  Exportar Excel
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse min-w-max w-full">
              <thead>
                <tr>
                  {columnasMostrar.map((c) => (
                    <th
                      key={c.key}
                      draggable
                      onDragStart={() => setColArrastrada(c.key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        if (colArrastrada) moverColumna(colArrastrada, c.key);
                        setColArrastrada(null);
                      }}
                      className="text-left text-[9.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-2 whitespace-nowrap cursor-grab"
                      title="Arrastra para reordenar"
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="text-left text-[9.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-2 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {viajes.map((v) => (
                  <tr key={v.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                    {columnasMostrar.map((c) => (
                      <td key={c.key} className="px-1.5 py-1.5 whitespace-nowrap">
                        {renderCelda(v, c)}
                      </td>
                    ))}
                    <td className="px-1.5 py-1.5 whitespace-nowrap">
                      <span onClick={() => eliminarViaje(v.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar viaje">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cargando && viajes.length === 0 && (
              <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin viajes registrados. Usa &quot;+ Viaje&quot; o importa tu Excel para comenzar.</div>
            )}
          </div>
        </div>
        )}

        <PageFooter />
      </div>
    </div>
  );
}
