"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { ahoraMx, sumarDiasIso } from "@/lib/asistenciaData";

type Fila = { id: string; eco: string; operador: string; ruta: string; estatus: string; ubicacion: string; comentarios: string };
type Persona = { id: number; nombre: string; estado: "presente" | "viaje" | "falta" | "pendiente" | "otro" | "futuro"; etiqueta: string };
type Informe = { monitoreo: Fila[]; tarjetas: string; incidencias: string; liquidacion: string };

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
// "Lunes 5 de Octubre, 2026"
const fechaLarga = (iso: string) => {
  const d = new Date(iso + "T00:00:00Z");
  return `${DIAS[d.getUTCDay()]} ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}, ${d.getUTCFullYear()}`;
};
const filaVacia = (): Fila => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, eco: "", operador: "", ruta: "", estatus: "", ubicacion: "", comentarios: "" });
const VACIO: Informe = { monitoreo: [], tarjetas: "", incidencias: "", liquidacion: "" };

// Mismos estilos que el título y la descripción de las páginas del sistema.
const tituloCls = "font-display text-[16px] sm:text-[19px] font-bold text-[var(--navy)] m-0";
const descCls = "text-[11.5px] sm:text-[12.5px] text-[var(--gray-500)] m-0";
const subtituloCls = "text-[14px] sm:text-[15.5px] font-bold text-[var(--navy)] m-0";
const celdaCls = "w-full bg-transparent border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] focus:bg-white rounded-md px-2 py-1.5 text-[12.5px]";
const areaCls = "w-full border border-[var(--gray-200)] rounded-xl bg-white p-3 text-[13px] leading-relaxed focus:outline-none focus:border-[var(--blue)] min-h-[110px]";

export default function InformeGeneralPage() {
  const hoy = ahoraMx().fecha;
  const [fecha, setFecha] = useState(hoy);
  const [informe, setInforme] = useState<Informe>(VACIO);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [resumen, setResumen] = useState({ presentes: 0, viaje: 0, sinChecada: 0, total: 0 });
  const [ecos, setEcos] = useState<string[]>([]);
  const [estado, setEstado] = useState<"" | "guardando" | "guardado" | "error">("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const sucio = useRef(false); // hay cambios locales sin guardar
  const version = useRef<string | null>(null);
  const temporizador = useRef<number | null>(null);

  const cargarInforme = useCallback(async (f: string, silencioso = false) => {
    try {
      const r = await fetch(`/api/informe-general?fecha=${f}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "No se pudo cargar el informe.");
      if (silencioso && (sucio.current || d.updated_at === version.current)) return;
      version.current = d.updated_at;
      setInforme({ monitoreo: d.monitoreo, tarjetas: d.tarjetas, incidencias: d.incidencias, liquidacion: d.liquidacion });
      sucio.current = false;
      setError("");
    } catch (e) {
      if (!silencioso) setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarAsistencia = useCallback(async (f: string) => {
    try {
      const r = await fetch(`/api/informe-general/asistencia?fecha=${f}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) {
        setPersonas(d.personas);
        setResumen(d.resumen);
      }
    } catch {
      /* se reintenta en el siguiente ciclo */
    }
  }, []);

  useEffect(() => {
    fetch("/api/unidades/list", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEcos((d.registros || []).map((u: Record<string, string>) => u.ECO).filter(Boolean)))
      .catch(() => {});
  }, []);

  // Al cambiar de día se carga su informe; la asistencia y el informe se refrescan solos cada pocos segundos.
  useEffect(() => {
    setCargando(true);
    sucio.current = false;
    version.current = null;
    cargarInforme(fecha);
    cargarAsistencia(fecha);
    const id = window.setInterval(() => {
      if (document.hidden) return;
      cargarInforme(fecha, true);
      cargarAsistencia(fecha);
    }, 10000);
    return () => window.clearInterval(id);
  }, [fecha, cargarInforme, cargarAsistencia]);

  const guardar = useCallback(
    async (datos: Informe, f: string) => {
      setEstado("guardando");
      try {
        const r = await fetch("/api/informe-general", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fecha: f, ...datos }) });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        version.current = d.updated_at;
        sucio.current = false;
        setEstado("guardado");
      } catch {
        setEstado("error");
      }
    },
    []
  );

  // Autoguardado: 1 segundo después del último cambio.
  const cambiar = (nuevo: Informe) => {
    setInforme(nuevo);
    sucio.current = true;
    setEstado("");
    if (temporizador.current) window.clearTimeout(temporizador.current);
    temporizador.current = window.setTimeout(() => guardar(nuevo, fecha), 1000);
  };
  useEffect(() => () => void (temporizador.current && window.clearTimeout(temporizador.current)), []);

  const setFila = (id: string, campo: keyof Fila, valor: string) => cambiar({ ...informe, monitoreo: informe.monitoreo.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)) });
  const colorPersona = (e: Persona["estado"]) => (e === "falta" ? "text-[var(--red)] font-bold" : e === "pendiente" ? "text-[var(--amber)]" : e === "viaje" ? "text-[var(--blue)]" : e === "presente" ? "text-[var(--green)]" : "text-[var(--gray-500)]");

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-12">
        <PageHeader titulo="Informe General" subtitulo="Informe diario de operación · un informe por día con historial." backHref="/" backLabel="Menú principal" />

        {/* Selector de fecha */}
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button type="button" onClick={() => setFecha(sumarDiasIso(fecha, -1))} className="w-9 h-9 rounded-lg border border-[var(--gray-200)] bg-white text-[var(--navy)] font-bold" aria-label="Día anterior">‹</button>
          <input type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && setFecha(e.target.value)} className="border border-[var(--gray-200)] rounded-lg bg-white px-3 py-2 text-[13px]" />
          <button type="button" onClick={() => setFecha(sumarDiasIso(fecha, 1))} disabled={fecha >= hoy} className="w-9 h-9 rounded-lg border border-[var(--gray-200)] bg-white text-[var(--navy)] font-bold disabled:opacity-40" aria-label="Día siguiente">›</button>
          {fecha !== hoy && <button type="button" onClick={() => setFecha(hoy)} className="text-[12.5px] font-bold text-[var(--blue)] ml-1">Ir a hoy</button>}
          <span className="ml-auto text-[12px] text-[var(--gray-500)]">{estado === "guardando" ? "Guardando…" : estado === "guardado" ? "✓ Guardado" : estado === "error" ? <span className="text-[var(--red)] font-bold">No se pudo guardar</span> : ""}</span>
        </div>
        {error && <p className="text-[13px] text-[var(--red)]">{error}</p>}

        {/* Asistencia */}
        <section className="bg-white border border-[var(--gray-200)] rounded-xl p-4 sm:p-5 mb-5">
          <h2 className={tituloCls}>Asistencia - {fechaLarga(fecha)}</h2>
          <p className={`${descCls} mb-3`}>Asistencia capturada automáticamente desde el nuevo biométrico.</p>
          {personas.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)] m-0">{cargando ? "Cargando…" : "No hay personal registrado."}</p>
          ) : (
            <>
              <ul className="list-none m-0 p-0 columns-[230px] gap-x-6">
                {personas.map((p) => (
                  <li key={p.id} className={`break-inside-avoid flex items-baseline justify-between gap-2 py-[3px] border-b border-[var(--gray-100)] text-[12.5px] ${colorPersona(p.estado)}`}>
                    <span className="truncate">{p.nombre}</span>
                    <span className="shrink-0 text-[12px]">{p.etiqueta}</span>
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] text-[var(--gray-500)] m-0 mt-3">
                Presentes {resumen.presentes} · En viaje {resumen.viaje} · Sin checada / falta {resumen.sinChecada} · Total {resumen.total}
              </p>
            </>
          )}
        </section>

        {/* Reporte de monitoreo */}
        <section className="bg-white border border-[var(--gray-200)] rounded-xl p-4 sm:p-5 mb-5">
          <h2 className={tituloCls}>Reporte de monitoreo</h2>
          <p className={`${descCls} mb-3`}>Reporte de actividades y bitácora de entrega de turno.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-[12.5px] border-separate border-spacing-0">
              <thead>
                <tr>
                  {["Eco unidad", "Operador", "Ruta destino", "Estatus", "Ubicación", "Comentarios", ""].map((h, i) => (
                    <th key={i} className="text-left px-2 py-2 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide border-b border-[var(--gray-200)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {informe.monitoreo.map((f) => (
                  <tr key={f.id}>
                    <td className="border-b border-[var(--gray-100)] w-[110px]"><input list="ecos-informe" value={f.eco} onChange={(e) => setFila(f.id, "eco", e.target.value)} className={celdaCls} /></td>
                    <td className="border-b border-[var(--gray-100)] w-[170px]"><input value={f.operador} onChange={(e) => setFila(f.id, "operador", e.target.value)} className={celdaCls} /></td>
                    <td className="border-b border-[var(--gray-100)] w-[190px]"><input value={f.ruta} onChange={(e) => setFila(f.id, "ruta", e.target.value)} className={celdaCls} /></td>
                    <td className="border-b border-[var(--gray-100)] w-[140px]"><input list="estatus-informe" value={f.estatus} onChange={(e) => setFila(f.id, "estatus", e.target.value)} className={celdaCls} /></td>
                    <td className="border-b border-[var(--gray-100)] w-[190px]"><input value={f.ubicacion} onChange={(e) => setFila(f.id, "ubicacion", e.target.value)} className={celdaCls} /></td>
                    <td className="border-b border-[var(--gray-100)]"><input value={f.comentarios} onChange={(e) => setFila(f.id, "comentarios", e.target.value)} className={celdaCls} /></td>
                    <td className="border-b border-[var(--gray-100)] w-[36px] text-center">
                      <button type="button" title="Eliminar fila" aria-label="Eliminar fila" onClick={() => cambiar({ ...informe, monitoreo: informe.monitoreo.filter((x) => x.id !== f.id) })} className="text-[var(--gray-400)] hover:text-[var(--red)] text-[16px] leading-none">✕</button>
                    </td>
                  </tr>
                ))}
                {informe.monitoreo.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-5 text-center text-[var(--gray-400)]">Sin filas. Agrega la primera unidad en monitoreo.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <datalist id="ecos-informe">{ecos.map((e) => <option key={e} value={e} />)}</datalist>
          <datalist id="estatus-informe">{["En ruta", "En carga", "En descarga", "En patio", "Detenido", "Con incidencia", "Regreso"].map((e) => <option key={e} value={e} />)}</datalist>
          <button type="button" onClick={() => cambiar({ ...informe, monitoreo: [...informe.monitoreo, filaVacia()] })} className="mt-3 text-[13px] font-bold text-[var(--blue)]">+ Agregar fila</button>

          <h3 className={`${subtituloCls} mt-6`}>Control de tarjetas PASE, Radios y Mochilas.</h3>
          <textarea value={informe.tarjetas} onChange={(e) => cambiar({ ...informe, tarjetas: e.target.value })} className={`${areaCls} mt-2`} placeholder="Escribe aquí…" />

          <h3 className={`${subtituloCls} mt-6`}>Incidencias y seguimiento en rutas</h3>
          <p className={`${descCls} mt-0.5`}>Anota cada incidencia, desvío de ruta, excedente de tiempo de descanso de los viajes</p>
          <textarea value={informe.incidencias} onChange={(e) => cambiar({ ...informe, incidencias: e.target.value })} className={`${areaCls} mt-2`} placeholder="Escribe aquí…" />
        </section>

        {/* Liquidación de viajes */}
        <section className="bg-white border border-[var(--gray-200)] rounded-xl p-4 sm:p-5">
          <h2 className={tituloCls}>Liquidación de Viajes</h2>
          <p className={`${descCls} mb-2`}>Análisis y control de los consumos de combustible y dispersión de recursos</p>
          <textarea value={informe.liquidacion} onChange={(e) => cambiar({ ...informe, liquidacion: e.target.value })} className={areaCls} placeholder="Escribe aquí…" />
        </section>
      </div>
    </div>
  );
}
