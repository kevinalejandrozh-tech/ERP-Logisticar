"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Tarea = { id: number; tarea: string; responsable: string; fechaEntrega: string; estado: string };
const COLUMNAS: { key: string; titulo: string }[] = [
  { key: "lista", titulo: "Lista de tareas" },
  { key: "proceso", titulo: "En proceso" },
  { key: "completadas", titulo: "Completadas" },
];

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
  const [fTarea, setFTarea] = useState("");
  const [fResponsable, setFResponsable] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [arrastrandoId, setArrastrandoId] = useState<number | null>(null);

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
    setFTarea("");
    setFResponsable("");
    setFFecha("");
    setFormAbierto(true);
  };

  const guardar = async () => {
    if (!fTarea.trim() || !fResponsable.trim()) {
      alert("Captura la tarea y el responsable.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tarea: fTarea.trim(), responsable: fResponsable.trim(), fechaEntrega: fFecha }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar.");
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

  const soltarEnColumna = async (estado: string) => {
    if (arrastrandoId === null) return;
    const id = arrastrandoId;
    setArrastrandoId(null);
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, estado } : t)));
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado }),
      });
    } catch {
      await cargar();
    }
  };

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

        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-6">
          <button type="button" onClick={abrirForm} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Nueva tarea
          </button>
        </div>

        {cargando ? (
          <p className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando tablero...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
            {COLUMNAS.map((col) => {
              const tareasCol = tareas.filter((t) => t.estado === col.key);
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
                  <div className="flex flex-col gap-3">
                    {tareasCol.map((t) => (
                      <div
                        key={t.id}
                        draggable
                        onDragStart={() => setArrastrandoId(t.id)}
                        onDragEnd={() => setArrastrandoId(null)}
                        className="bg-white border-2 border-[var(--navy)] rounded-2xl p-3 cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-start justify-between gap-1.5 mb-2">
                          <p className="text-[13px] font-bold text-[var(--navy)] m-0 leading-snug">{t.tarea}</p>
                          <span onClick={() => eliminarTarea(t.id)} className="text-[var(--red)] cursor-pointer shrink-0" title="Eliminar tarea">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </span>
                        </div>
                        <div className="bg-[var(--navy)] rounded-full px-3 py-1.5 flex items-center justify-between gap-2">
                          <span className="text-white text-[11px] font-semibold truncate">{t.responsable || "—"}</span>
                          <span className="bg-[var(--gray-400)] text-white text-[9.5px] rounded-full px-2 py-0.5 whitespace-nowrap">{formatearFecha(t.fechaEntrega)}</span>
                        </div>
                      </div>
                    ))}
                    {tareasCol.length === 0 && <p className="text-center text-white/70 text-[12px] py-6">Sin tareas.</p>}
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
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Nueva tarea</h3>
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
    </div>
  );
}
