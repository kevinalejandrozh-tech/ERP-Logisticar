"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Columna = { id: number; nombre: string; orden: number };
type Fila = { id: number; datos: Record<string, string>; orden: number };

export default function ReportesPage() {
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [actualizandoEstado, setActualizandoEstado] = useState(false);

  const cargar = async () => {
    try {
      const res = await fetch("/api/reportes/estructura", { cache: "no-store" });
      const data = await res.json();
      setColumnas(data.columnas || []);
      setFilas(data.filas || []);
    } catch {
      // se reintenta en la siguiente accion
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const actualizarCeldaLocal = (filaId: number, columna: string, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === filaId ? { ...f, datos: { ...f.datos, [columna]: valor } } : f)));
  };
  const guardarCelda = (filaId: number, columna: string, valor: string) => {
    fetch("/api/reportes/filas/celda", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: filaId, columna, valor }),
    }).catch(() => cargar());
  };

  const agregarColumna = async () => {
    const nombre = prompt("Nombre de la nueva columna:");
    if (!nombre || !nombre.trim()) return;
    try {
      await fetch("/api/reportes/columnas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
      await cargar();
    } catch {
      alert("No se pudo agregar la columna.");
    }
  };
  const eliminarColumna = async (col: Columna) => {
    if (!confirm(`¿Eliminar la columna "${col.nombre}"?`)) return;
    setColumnas((prev) => prev.filter((c) => c.id !== col.id));
    try {
      await fetch("/api/reportes/columnas/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: col.id }),
      });
    } catch {
      await cargar();
    }
  };

  const agregarFila = async () => {
    try {
      const res = await fetch("/api/reportes/filas", { method: "POST" });
      const data = await res.json();
      setFilas((prev) => [...prev, { id: data.id, datos: {}, orden: prev.length }]);
    } catch {
      alert("No se pudo agregar la fila.");
    }
  };
  const eliminarFila = async (id: number) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setFilas((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/reportes/filas/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargar();
    }
  };

  const actualizarEstado = async () => {
    setActualizandoEstado(true);
    try {
      await fetch("/api/reportes/actualizar-estado", { method: "POST" });
      await cargar();
    } catch {
      alert("No se pudo actualizar el estado.");
    } finally {
      setActualizandoEstado(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Reportes"
          subtitulo="Tabla libre de reporte: agrega columnas y filas, y edita directamente."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M3 3v18h18M8 17V9M13 17V5M18 17v-7" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 mb-5">
          <button type="button" onClick={agregarFila} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-3.5 py-2 text-[12.5px] font-bold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            + Agregar fila
          </button>
          <button type="button" onClick={agregarColumna} className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2 text-[12.5px] font-bold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            + Agregar columna
          </button>
          <button type="button" onClick={actualizarEstado} disabled={actualizandoEstado} className="flex items-center gap-1.5 bg-white text-[var(--blue)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2 text-[12.5px] font-bold disabled:opacity-60">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0115-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 01-15 6.7L3 16" /></svg>
            {actualizandoEstado ? "Actualizando..." : "Actualizar estado (Revisada/No revisada)"}
          </button>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          {cargando ? (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando reporte...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {columnas.map((c) => (
                      <th key={c.id} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {c.nombre}
                          <span onClick={() => eliminarColumna(c)} className="cursor-pointer text-white/70 hover:text-white" title="Eliminar columna">
                            ✕
                          </span>
                        </div>
                      </th>
                    ))}
                    <th className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                      {columnas.map((c) => {
                        const valor = f.datos?.[c.nombre] || "";
                        const esEstado = c.nombre === "Estado";
                        const colorEstado = esEstado ? (valor === "Revisada" ? "text-[var(--green)] font-bold" : valor === "No revisada" ? "text-[var(--red)] font-bold" : "") : "";
                        return (
                          <td key={c.id} className="px-2.5 py-2 whitespace-nowrap">
                            <input
                              defaultValue={valor}
                              onBlur={(e) => {
                                if (e.target.value === valor) return;
                                actualizarCeldaLocal(f.id, c.nombre, e.target.value);
                                guardarCelda(f.id, c.nombre, e.target.value);
                              }}
                              className={`border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12.5px] w-[130px] ${colorEstado}`}
                            />
                          </td>
                        );
                      })}
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span onClick={() => eliminarFila(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filas.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin filas. Usa &quot;+ Agregar fila&quot; para comenzar.</div>}
            </div>
          )}
        </div>

        <PageFooter />
      </div>
    </div>
  );
}
