"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Columna = { id: number; nombre: string; orden: number };
type Fila = { id: number; datos: Record<string, string>; orden: number };

export default function GastosTotalesViajesPage() {
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editandoColumna, setEditandoColumna] = useState<number | null>(null);
  const [valorColumnaTmp, setValorColumnaTmp] = useState("");

  const cargar = async () => {
    try {
      const res = await fetch("/api/control-viajes/estructura", { cache: "no-store" });
      const data = await res.json();
      setColumnas(data.columnas || []);
      setFilas(data.filas || []);
    } catch {
      // se reintenta al volver a la pestaña
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  const agregarColumna = async () => {
    const nombre = window.prompt("Nombre de la nueva columna:", `Columna ${columnas.length + 1}`);
    if (!nombre || !nombre.trim()) return;
    try {
      const res = await fetch("/api/control-viajes/columnas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre: nombre.trim() }) });
      const data = await res.json();
      if (res.ok) setColumnas((prev) => [...prev, { id: data.id, nombre: nombre.trim(), orden: prev.length }]);
    } catch {
      alert("No se pudo agregar la columna.");
    }
  };

  const guardarNombreColumna = async (id: number) => {
    const nombre = valorColumnaTmp.trim();
    setEditandoColumna(null);
    if (!nombre) return;
    setColumnas((prev) => prev.map((c) => (c.id === id ? { ...c, nombre } : c)));
    try {
      await fetch("/api/control-viajes/columnas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, nombre }) });
    } catch {
      cargar();
    }
  };

  const eliminarColumna = async (id: number) => {
    if (!confirm("¿Eliminar esta columna? Se perderán los datos de esa columna en todas las filas.")) return;
    setColumnas((prev) => prev.filter((c) => c.id !== id));
    setFilas((prev) => prev.map((f) => ({ ...f, datos: Object.fromEntries(Object.entries(f.datos).filter(([k]) => k !== String(id))) })));
    try {
      await fetch("/api/control-viajes/columnas/eliminar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      cargar();
    }
  };

  const agregarFila = async () => {
    try {
      const res = await fetch("/api/control-viajes/filas", { method: "POST" });
      const data = await res.json();
      if (res.ok) setFilas((prev) => [...prev, { id: data.id, datos: {}, orden: prev.length }]);
    } catch {
      alert("No se pudo agregar la fila.");
    }
  };

  const eliminarFila = async (id: number) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setFilas((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/control-viajes/filas/eliminar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      cargar();
    }
  };

  const actualizarCelda = (filaId: number, columnaId: number, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === filaId ? { ...f, datos: { ...f.datos, [String(columnaId)]: valor } } : f)));
  };
  const guardarCelda = async (filaId: number, columnaId: number, valor: string) => {
    try {
      await fetch("/api/control-viajes/filas/celda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filaId, columnaId, valor }),
      });
    } catch {
      cargar();
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Gastos Totales de Viajes"
          subtitulo="Tabla libre: agrega columnas y filas, y edita directamente."
          backHref="/control-viajes"
          backLabel="Control de Viajes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap gap-2.5 mb-4">
            <button type="button" onClick={agregarColumna} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Columna
            </button>
            <button type="button" onClick={agregarFila} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Fila
            </button>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && columnas.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay columnas. Usa &quot;Columna&quot; para empezar la tabla.</p>
          )}

          {!cargando && columnas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {columnas.map((c) => (
                      <th key={c.id} className="text-left bg-[var(--navy)] px-3 py-2 min-w-[150px]">
                        {editandoColumna === c.id ? (
                          <input
                            autoFocus
                            value={valorColumnaTmp}
                            onChange={(e) => setValorColumnaTmp(e.target.value)}
                            onBlur={() => guardarNombreColumna(c.id)}
                            onKeyDown={(e) => e.key === "Enter" && guardarNombreColumna(c.id)}
                            className="w-full bg-white rounded px-2 py-1 text-[12px] text-[var(--navy)]"
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-2">
                            <span
                              onClick={() => {
                                setEditandoColumna(c.id);
                                setValorColumnaTmp(c.nombre);
                              }}
                              className="text-[11px] uppercase tracking-wide text-white font-bold cursor-text truncate"
                              title="Clic para editar el título"
                            >
                              {c.nombre}
                            </span>
                            <span onClick={() => eliminarColumna(c.id)} className="text-white/60 hover:text-white shrink-0 cursor-pointer" title="Eliminar columna">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </span>
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="bg-[var(--navy)] w-10 rounded-r-lg" />
                  </tr>
                </thead>
                <tbody>
                  {filas.map((f) => (
                    <tr key={f.id} className="border-b border-[var(--gray-200)]">
                      {columnas.map((c) => (
                        <td key={c.id} className="px-1 py-1">
                          <input
                            value={f.datos[String(c.id)] || ""}
                            onChange={(e) => actualizarCelda(f.id, c.id, e.target.value)}
                            onBlur={(e) => guardarCelda(f.id, c.id, e.target.value)}
                            className="w-full px-2.5 py-2 text-[13px] rounded-md hover:bg-[var(--gray-100)] focus:bg-white focus:outline focus:outline-1 focus:outline-[var(--blue)]"
                          />
                        </td>
                      ))}
                      <td className="px-1 py-1 text-center">
                        <span onClick={() => eliminarFila(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filas.length === 0 && <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Aún no hay filas. Usa &quot;Fila&quot; para agregar la primera.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
