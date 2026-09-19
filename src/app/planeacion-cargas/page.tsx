"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const ANCHO_FIJO_COL = 110; // px — ancho de cada una de las 2 primeras columnas fijas al hacer scroll

type Columna = { id: number; nombre: string; orden: number };
type Fila = { id: number; datos: Record<string, string>; orden: number };

export default function PlaneacionCargasPage() {
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [editandoColumna, setEditandoColumna] = useState<number | null>(null);
  const [valorColumnaTmp, setValorColumnaTmp] = useState("");

  const cargar = async () => {
    try {
      const res = await fetch("/api/planeacion-cargas/estructura", { cache: "no-store" });
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
    const nombre = window.prompt("Nombre de la nueva columna:", "");
    if (!nombre || !nombre.trim()) return;
    try {
      const res = await fetch("/api/planeacion-cargas/columnas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim() }),
      });
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
      await fetch("/api/planeacion-cargas/columnas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, nombre }) });
    } catch {
      cargar();
    }
  };

  const eliminarColumna = async (id: number) => {
    if (!confirm("¿Eliminar esta columna? Se perderán los datos de esa columna en todas las filas.")) return;
    setColumnas((prev) => prev.filter((c) => c.id !== id));
    setFilas((prev) => prev.map((f) => ({ ...f, datos: Object.fromEntries(Object.entries(f.datos).filter(([k]) => k !== String(id))) })));
    try {
      await fetch("/api/planeacion-cargas/columnas/eliminar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      cargar();
    }
  };

  const agregarFila = async () => {
    try {
      const res = await fetch("/api/planeacion-cargas/filas", { method: "POST" });
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
      await fetch("/api/planeacion-cargas/filas/eliminar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      cargar();
    }
  };

  const actualizarCelda = (filaId: number, columnaId: number, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === filaId ? { ...f, datos: { ...f.datos, [String(columnaId)]: valor } } : f)));
  };
  const guardarCelda = async (filaId: number, columnaId: number, valor: string) => {
    try {
      await fetch("/api/planeacion-cargas/filas/celda", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filaId, columnaId, valor }),
      });
    } catch {
      cargar();
    }
  };

  const columnasFijas = useMemo(() => columnas.slice(0, 2), [columnas]);
  const columnasResto = useMemo(() => columnas.slice(2), [columnas]);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Planeación y Programa de Cargas"
          subtitulo="Tablero principal de programación de cargas: agrega columnas y filas, y edita directamente."
          backHref="/"
          backLabel="Menú principal"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M3 10h18M8 4v18M8 15h13" />
            </svg>
          }
        />

        <div className="bg-white rounded-[20px] shadow-[0_4px_18px_rgba(22,33,92,0.09)] overflow-hidden">
          <div className="h-[5px] bg-gradient-to-r from-[#16215c] via-[#2f6fed] to-[#21a866]" />

          <div className="p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-5">
                <div>
                  <p className="text-[22px] font-bold text-[var(--navy)] m-0 leading-none">{filas.length}</p>
                  <p className="text-[10.5px] uppercase tracking-wide text-[var(--gray-400)] font-bold m-0 mt-1">Registros</p>
                </div>
                <div className="w-px h-9 bg-[var(--gray-200)]" />
                <div>
                  <p className="text-[22px] font-bold text-[var(--navy)] m-0 leading-none">{columnas.length}</p>
                  <p className="text-[10.5px] uppercase tracking-wide text-[var(--gray-400)] font-bold m-0 mt-1">Columnas</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={agregarColumna} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  Columna
                </button>
                <button type="button" onClick={agregarFila} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-[12.5px] font-bold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  Fila
                </button>
              </div>
            </div>

            {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-14">Cargando...</p>}

            {!cargando && columnas.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-[var(--gray-200)]">
                <table className="border-collapse" style={{ tableLayout: "fixed" }}>
                  <thead>
                    <tr>
                      {columnasFijas.map((c, i) => (
                        <th
                          key={c.id}
                          className="sticky z-30 bg-[var(--navy)] px-2.5 py-3 border-r border-[rgba(255,255,255,0.12)] align-top"
                          style={{ left: i * ANCHO_FIJO_COL, width: ANCHO_FIJO_COL, minWidth: ANCHO_FIJO_COL }}
                        >
                          <EncabezadoColumna
                            c={c}
                            editando={editandoColumna === c.id}
                            valorTmp={valorColumnaTmp}
                            setValorTmp={setValorColumnaTmp}
                            onEditar={() => {
                              setEditandoColumna(c.id);
                              setValorColumnaTmp(c.nombre);
                            }}
                            onGuardar={() => guardarNombreColumna(c.id)}
                            onEliminar={() => eliminarColumna(c.id)}
                          />
                        </th>
                      ))}
                      {columnasResto.map((c) => (
                        <th key={c.id} className="bg-[var(--navy)] px-2.5 py-3 border-r border-[rgba(255,255,255,0.12)] align-top" style={{ width: 135, minWidth: 135 }}>
                          <EncabezadoColumna
                            c={c}
                            editando={editandoColumna === c.id}
                            valorTmp={valorColumnaTmp}
                            setValorTmp={setValorColumnaTmp}
                            onEditar={() => {
                              setEditandoColumna(c.id);
                              setValorColumnaTmp(c.nombre);
                            }}
                            onGuardar={() => guardarNombreColumna(c.id)}
                            onEliminar={() => eliminarColumna(c.id)}
                          />
                        </th>
                      ))}
                      <th className="bg-[var(--navy)] w-10 sticky right-0 z-30" />
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, fi) => {
                      const paridad = fi % 2 === 0 ? "bg-white" : "bg-[#f6f8fb]";
                      return (
                        <tr key={f.id} className="group">
                          {columnasFijas.map((c, i) => (
                            <td
                              key={c.id}
                              className={`sticky z-20 px-1 py-1 border-r border-b border-[var(--gray-200)] ${paridad} group-hover:bg-[var(--blue-light)]`}
                              style={{ left: i * ANCHO_FIJO_COL, width: ANCHO_FIJO_COL, minWidth: ANCHO_FIJO_COL }}
                            >
                              <input
                                value={f.datos[String(c.id)] || ""}
                                onChange={(e) => actualizarCelda(f.id, c.id, e.target.value)}
                                onBlur={(e) => guardarCelda(f.id, c.id, e.target.value)}
                                className="w-full bg-transparent px-2 py-1.5 text-[12.5px] font-semibold text-[var(--navy)] rounded-md focus:bg-white focus:outline focus:outline-1 focus:outline-[var(--blue)]"
                              />
                            </td>
                          ))}
                          {columnasResto.map((c) => (
                            <td key={c.id} className={`px-1 py-1 border-r border-b border-[var(--gray-200)] ${paridad} group-hover:bg-[var(--blue-light)]`} style={{ width: 135, minWidth: 135 }}>
                              <input
                                value={f.datos[String(c.id)] || ""}
                                onChange={(e) => actualizarCelda(f.id, c.id, e.target.value)}
                                onBlur={(e) => guardarCelda(f.id, c.id, e.target.value)}
                                className="w-full bg-transparent px-2 py-1.5 text-[12.5px] text-[var(--text)] rounded-md focus:bg-white focus:outline focus:outline-1 focus:outline-[var(--blue)]"
                              />
                            </td>
                          ))}
                          <td className={`sticky right-0 z-20 px-1 py-1 text-center border-b border-[var(--gray-200)] ${paridad} group-hover:bg-[var(--blue-light)]`}>
                            <span onClick={() => eliminarFila(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {filas.length === 0 && <p className="text-center text-[var(--gray-400)] text-[13px] py-10 bg-white">Aún no hay filas. Usa &quot;Fila&quot; para agregar la primera.</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EncabezadoColumna({
  c,
  editando,
  valorTmp,
  setValorTmp,
  onEditar,
  onGuardar,
  onEliminar,
}: {
  c: Columna;
  editando: boolean;
  valorTmp: string;
  setValorTmp: (v: string) => void;
  onEditar: () => void;
  onGuardar: () => void;
  onEliminar: () => void;
}) {
  if (editando) {
    return (
      <input
        autoFocus
        value={valorTmp}
        onChange={(e) => setValorTmp(e.target.value)}
        onBlur={onGuardar}
        onKeyDown={(e) => e.key === "Enter" && onGuardar()}
        className="w-full bg-white rounded px-1.5 py-1 text-[11px] text-[var(--navy)]"
      />
    );
  }
  return (
    <div className="flex items-start justify-between gap-1.5">
      <span onClick={onEditar} className="text-[10px] leading-tight uppercase tracking-wide text-white font-bold cursor-text break-words" title="Clic para editar el título">
        {c.nombre}
      </span>
      <span onClick={onEliminar} className="text-white/50 hover:text-white shrink-0 cursor-pointer mt-0.5" title="Eliminar columna">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12" /></svg>
      </span>
    </div>
  );
}
