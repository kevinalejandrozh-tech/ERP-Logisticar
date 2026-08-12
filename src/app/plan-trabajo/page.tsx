"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Avance = { texto: string; fecha: string };
type Tarea = {
  id: number;
  tarea: string;
  responsable: string;
  fechaEntrega: string;
  estado: string;
  avances: Avance[];
  color: string;
  categoria: string;
  urgente: boolean;
  orden: number;
  ancho: "full" | "mitad";
};
const COLUMNAS: { key: string; titulo: string }[] = [
  { key: "lista", titulo: "Lista de tareas" },
  { key: "proceso", titulo: "En proceso" },
  { key: "espera", titulo: "En espera" },
  { key: "completadas", titulo: "Completadas" },
];
const COLORES_DISPONIBLES = ["#e2412c", "#f2b134", "#21a866", "#2f6fed", "#8b5cf6", "#ec4899", "#16215c", "#767b87"];

function formatearFecha(f: string) {
  if (!f) return "Sin fecha";
  const d = new Date(`${f}T00:00:00`);
  if (isNaN(d.getTime())) return f;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PlanTrabajoPage() {
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [fTarea, setFTarea] = useState("");
  const [fResponsable, setFResponsable] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [arrastrandoId, setArrastrandoId] = useState<number | null>(null);
  const [sobreInfo, setSobreInfo] = useState<{ colKey: string; targetId: number; posicion: "antes" | "despues"; ancho: "full" | "mitad" } | null>(null);

  const cargar = async () => {
    try {
      const res = await fetch("/api/tareas/list", { cache: "no-store" });
      const data = await res.json();
      setTareas(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    const id = setInterval(cargar, 15000);
    return () => clearInterval(id);
  }, []);

  const abrirForm = () => {
    setEditandoId(null);
    setFTarea("");
    setFResponsable("");
    setFFecha("");
    setFormAbierto(true);
  };

  const abrirEditarTarea = (t: Tarea) => {
    setEditandoId(t.id);
    setFTarea(t.tarea);
    setFResponsable(t.responsable);
    setFFecha(t.fechaEntrega);
    setFormAbierto(true);
  };

  const guardar = async () => {
    if (!fTarea.trim() || !fResponsable.trim()) {
      alert("Captura la tarea y el responsable.");
      return;
    }
    setGuardando(true);
    try {
      if (editandoId !== null) {
        const res = await fetch("/api/tareas/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editandoId, tarea: fTarea.trim(), responsable: fResponsable.trim(), fechaEntrega: fFecha || " " }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al guardar.");
      } else {
        const res = await fetch("/api/tareas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarea: fTarea.trim(), responsable: fResponsable.trim(), fechaEntrega: fFecha }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al guardar.");
      }
      setFormAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al guardar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarTarea = async (id: number) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setTareas((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch("/api/tareas/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargar();
    }
  };

  // ---- Avances ----
  const [avancesAbiertos, setAvancesAbiertos] = useState<Tarea | null>(null);
  const [nuevoAvance, setNuevoAvance] = useState("");
  const [guardandoAvance, setGuardandoAvance] = useState(false);

  const abrirAvances = (t: Tarea) => {
    setNuevoAvance("");
    setAvancesAbiertos(t);
  };

  const guardarAvance = async () => {
    if (!avancesAbiertos || !nuevoAvance.trim()) return;
    setGuardandoAvance(true);
    try {
      const res = await fetch("/api/tareas/avance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: avancesAbiertos.id, texto: nuevoAvance.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el avance.");
      const actualizado = { ...avancesAbiertos, avances: data.avances };
      setAvancesAbiertos(actualizado);
      setTareas((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)));
      setNuevoAvance("");
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el avance.");
    } finally {
      setGuardandoAvance(false);
    }
  };

  // ---- Color / categoria ----
  const [colorAbierto, setColorAbierto] = useState<Tarea | null>(null);
  const [cColor, setCColor] = useState(COLORES_DISPONIBLES[0]);
  const [cCategoria, setCCategoria] = useState("");
  const [guardandoColor, setGuardandoColor] = useState(false);

  const abrirColor = (t: Tarea) => {
    setCColor(t.color || COLORES_DISPONIBLES[0]);
    setCCategoria(t.categoria || "");
    setColorAbierto(t);
  };

  const guardarColor = async () => {
    if (!colorAbierto) return;
    setGuardandoColor(true);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: colorAbierto.id, color: cColor, categoria: cCategoria.trim() }),
      });
      setTareas((prev) => prev.map((t) => (t.id === colorAbierto.id ? { ...t, color: cColor, categoria: cCategoria.trim() } : t)));
      setColorAbierto(null);
    } catch {
      alert("No se pudo guardar la categoría.");
    } finally {
      setGuardandoColor(false);
    }
  };

  const quitarColor = async () => {
    if (!colorAbierto) return;
    setGuardandoColor(true);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: colorAbierto.id, color: " ", categoria: " " }),
      });
      setTareas((prev) => prev.map((t) => (t.id === colorAbierto.id ? { ...t, color: "", categoria: "" } : t)));
      setColorAbierto(null);
    } catch {
      alert("No se pudo quitar la categoría.");
    } finally {
      setGuardandoColor(false);
    }
  };

  // ---- Urgente ----
  const toggleUrgente = async (t: Tarea) => {
    const nuevo = !t.urgente;
    setTareas((prev) => prev.map((x) => (x.id === t.id ? { ...x, urgente: nuevo } : x)));
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, urgente: nuevo }),
      });
    } catch {
      await cargar();
    }
  };

  // ---- Arrastrar y soltar ----
  // 4 zonas sobre cada tarjeta: izquierda/derecha = acomodar en 2 columnas (ancho mitad); arriba/abajo = ancho completo, apilada.
  const soltarEnColumna = async (colKey: string) => {
    if (arrastrandoId === null) return;
    const id = arrastrandoId;
    const listaCol = tareas.filter((t) => t.estado === colKey && t.id !== id).sort((a, b) => a.orden - b.orden);

    let nuevoOrden: number;
    let nuevoAncho: "full" | "mitad" = "full";
    let idObjetivoPareja: number | null = null;

    if (!sobreInfo || sobreInfo.colKey !== colKey) {
      nuevoOrden = listaCol.length ? listaCol[listaCol.length - 1].orden + 1 : Date.now();
    } else {
      const idx = listaCol.findIndex((t) => t.id === sobreInfo.targetId);
      nuevoAncho = sobreInfo.ancho;
      if (sobreInfo.ancho === "mitad") idObjetivoPareja = sobreInfo.targetId;
      if (idx === -1) {
        nuevoOrden = listaCol.length ? listaCol[listaCol.length - 1].orden + 1 : Date.now();
      } else {
        const objetivo = listaCol[idx];
        if (sobreInfo.posicion === "antes") {
          const anterior = listaCol[idx - 1];
          nuevoOrden = anterior ? (anterior.orden + objetivo.orden) / 2 : objetivo.orden - 1;
        } else {
          const siguiente = listaCol[idx + 1];
          nuevoOrden = siguiente ? (objetivo.orden + siguiente.orden) / 2 : objetivo.orden + 1;
        }
      }
    }

    setTareas((prev) =>
      prev.map((t) => {
        if (t.id === id) return { ...t, estado: colKey, orden: nuevoOrden, ancho: nuevoAncho };
        if (idObjetivoPareja && t.id === idObjetivoPareja) return { ...t, ancho: "mitad" };
        return t;
      })
    );
    setArrastrandoId(null);
    setSobreInfo(null);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado: colKey, orden: nuevoOrden, ancho: nuevoAncho }),
      });
      if (idObjetivoPareja) {
        await fetch("/api/tareas/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: idObjetivoPareja, ancho: "mitad" }),
        });
      }
    } catch {
      await cargar();
    }
  };

  // ---- Filtros ----
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const responsablesUnicos = useMemo(() => Array.from(new Set(tareas.map((t) => t.responsable).filter(Boolean))).sort(), [tareas]);
  const categoriasUnicas = useMemo(() => Array.from(new Set(tareas.map((t) => t.categoria).filter(Boolean))).sort(), [tareas]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filtroResponsable && t.responsable !== filtroResponsable) return false;
      if (filtroCategoria && t.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [tareas, filtroResponsable, filtroCategoria]);

  // ---- Badges de resumen ----
  const totalPendientes = useMemo(() => tareas.filter((t) => t.estado !== "completadas").length, [tareas]);
  const responsablesPendientes = useMemo(() => {
    const mapa: Record<string, number> = {};
    tareas.forEach((t) => {
      if (t.estado === "completadas" || !t.responsable) return;
      mapa[t.responsable] = (mapa[t.responsable] || 0) + 1;
    });
    return mapa;
  }, [tareas]);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Plan de trabajo y seguimiento"
          subtitulo="Crea, asigna y da seguimiento a los planes de trabajo."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
          <button type="button" onClick={abrirForm} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Nueva tarea
          </button>
        </div>

        {/* Badges de resumen */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] px-6 py-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1">Tareas pendientes</p>
            <p className="text-[26px] font-bold text-[var(--navy)] m-0">{totalPendientes}</p>
          </div>
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] px-6 py-4 flex-1 min-w-[240px]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-2">Responsables con tareas pendientes</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(responsablesPendientes).length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin pendientes.</span>}
              {Object.entries(responsablesPendientes).map(([r, n]) => (
                <span key={r} className="bg-[var(--blue-light)] text-[var(--navy)] text-[11px] font-bold px-2.5 py-1 rounded-full">
                  {r} ({n})
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-2.5 mb-5">
          <div>
            <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Responsable</label>
            <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px] bg-white">
              <option value="">Todos</option>
              {responsablesUnicos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Color / Categoría</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px] bg-white">
              <option value="">Todas</option>
              {categoriasUnicas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {(filtroResponsable || filtroCategoria) && (
            <button
              type="button"
              onClick={() => {
                setFiltroResponsable("");
                setFiltroCategoria("");
              }}
              className="text-[11.5px] text-[var(--red)] font-semibold px-2 py-1.5"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {cargando ? (
          <p className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando tablero...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {COLUMNAS.map((col) => {
              const tareasCol = tareasFiltradas.filter((t) => t.estado === col.key).sort((a, b) => a.orden - b.orden);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => soltarEnColumna(col.key)}
                  className="bg-[#767b87] rounded-2xl p-3.5 md:p-4 min-h-[320px]"
                >
                  <div className="bg-white rounded-full px-4 py-2 mb-4 text-center">
                    <span className="text-[13px] font-bold text-[var(--navy)]">{col.titulo}</span>
                    <span className="text-[11px] text-[var(--gray-400)] ml-1.5">({tareasCol.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-start">
                    {tareasCol.map((t) => {
                      const estiloFondo = t.urgente ? { backgroundColor: "rgba(226,65,44,0.95)" } : t.color ? { backgroundColor: `${t.color}f2` } : undefined;
                      const zona = sobreInfo && sobreInfo.targetId === t.id ? sobreInfo : null;
                      const estiloZona: CSSProperties = {};
                      if (zona) {
                        const grosor = "3px solid var(--blue)";
                        if (zona.posicion === "antes" && zona.ancho === "mitad") estiloZona.borderLeft = grosor;
                        else if (zona.posicion === "despues" && zona.ancho === "mitad") estiloZona.borderRight = grosor;
                        else if (zona.posicion === "antes" && zona.ancho === "full") estiloZona.borderTop = grosor;
                        else estiloZona.borderBottom = grosor;
                      }
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setArrastrandoId(t.id)}
                          onDragEnd={() => {
                            setArrastrandoId(null);
                            setSobreInfo(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = (e.clientX - rect.left) / rect.width;
                            const relY = e.clientY - rect.top;
                            let posicion: "antes" | "despues";
                            let ancho: "full" | "mitad";
                            if (relX < 0.3) {
                              posicion = "antes";
                              ancho = "mitad";
                            } else if (relX > 0.7) {
                              posicion = "despues";
                              ancho = "mitad";
                            } else if (relY < rect.height / 2) {
                              posicion = "antes";
                              ancho = "full";
                            } else {
                              posicion = "despues";
                              ancho = "full";
                            }
                            setSobreInfo({ colKey: col.key, targetId: t.id, posicion, ancho });
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            soltarEnColumna(col.key);
                          }}
                          style={{ ...estiloFondo, ...estiloZona, gridColumn: t.ancho === "mitad" ? "span 1" : "span 2" }}
                          className={`bg-white border-2 ${t.urgente ? "border-[var(--red)]" : "border-[var(--navy)]"} rounded-2xl p-3 cursor-grab active:cursor-grabbing`}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <span onClick={() => abrirEditarTarea(t)} className="text-[var(--gray-400)] cursor-pointer shrink-0" title="Editar tarea">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                            </span>
                            <div className="flex-1">
                              {t.urgente && <span className="inline-block bg-[var(--red)] text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-1">Urgente</span>}
                              {!t.urgente && t.categoria && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-1" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                                  {t.categoria}
                                </span>
                              )}
                              <p className="text-[13px] font-normal text-[var(--navy)] m-0 leading-snug">{t.tarea}</p>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span onClick={() => eliminarTarea(t.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar tarea">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </span>
                              <span onClick={() => toggleUrgente(t)} className={t.urgente ? "text-[var(--red)]" : "text-[var(--gray-400)]"} title="Marcar como urgente">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={t.urgente ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                              </span>
                              <span onClick={() => abrirColor(t)} className="cursor-pointer" title="Color / categoría">
                                <span className="block w-3.5 h-3.5 rounded-full border border-[var(--gray-200)]" style={{ backgroundColor: t.color || "#e5e8ee" }} />
                              </span>
                            </div>
                          </div>
                          <div className="bg-[var(--navy)] rounded-full px-3 py-1.5 flex items-center justify-between gap-2 mb-2">
                            <span className="text-white text-[11px] font-normal truncate">{t.responsable || "—"}</span>
                            <span className="bg-[var(--gray-400)] text-white text-[9.5px] rounded-full px-2 py-0.5 whitespace-nowrap">{formatearFecha(t.fechaEntrega)}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => abrirAvances(t)}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--blue)] border border-[var(--blue-light)] bg-[var(--blue-light)] rounded-full py-1.5"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
                            Avances{t.avances?.length > 0 ? ` (${t.avances.length})` : ""}
                          </button>
                        </div>
                      );
                    })}
                    {tareasCol.length === 0 && <p className="text-center text-white/70 text-[12px] py-6 col-span-2">Sin tareas.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PageFooter />
      </div>

      {formAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">{editandoId !== null ? "Editar tarea" : "Nueva tarea"}</h3>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Tarea</label>
              <textarea value={fTarea} onChange={(e) => setFTarea(e.target.value)} rows={2} placeholder="Describe la tarea" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Responsable</label>
              <input value={fResponsable} onChange={(e) => setFResponsable(e.target.value)} placeholder="Nombre del responsable" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fecha de entrega</label>
              <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setFormAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {colorAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[400px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Color / Categoría</h3>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORES_DISPONIBLES.map((c) => (
                  <span
                    key={c}
                    onClick={() => setCColor(c)}
                    className={`w-7 h-7 rounded-full cursor-pointer ${cColor === c ? "ring-2 ring-offset-2 ring-[var(--navy)]" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Descripción de la categoría</label>
              <input value={cCategoria} onChange={(e) => setCCategoria(e.target.value)} placeholder="Ej. Administrativo, Urgente cliente..." className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setColorAbierto(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              {colorAbierto.categoria && (
                <button type="button" onClick={quitarColor} disabled={guardandoColor} className="bg-white text-[var(--red)] border border-[var(--red)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Quitar
                </button>
              )}
              <button type="button" onClick={guardarColor} disabled={guardandoColor} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoColor ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {avancesAbiertos && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[480px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-1">Avances</h3>
            <p className="text-[13px] text-[var(--gray-400)] mb-4">{avancesAbiertos.tarea}</p>

            <div className="flex flex-col gap-2.5 mb-5 max-h-[280px] overflow-y-auto">
              {(avancesAbiertos.avances || []).length === 0 && <p className="text-[12.5px] text-[var(--gray-400)]">Aún no hay avances registrados.</p>}
              {[...(avancesAbiertos.avances || [])].reverse().map((a, i) => (
                <div key={i} className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5">
                  <p className="text-[12.5px] text-[var(--text)] m-0 mb-1 whitespace-pre-wrap">{a.texto}</p>
                  <p className="text-[10.5px] text-[var(--gray-400)] m-0">{new Date(a.fecha).toLocaleString("es-MX")}</p>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Agregar avance</label>
              <textarea value={nuevoAvance} onChange={(e) => setNuevoAvance(e.target.value)} rows={2} placeholder="Describe el avance" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>

            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setAvancesAbiertos(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarAvance} disabled={guardandoAvance || !nuevoAvance.trim()} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoAvance ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
