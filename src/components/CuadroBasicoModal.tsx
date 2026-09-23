"use client";
import { useEffect, useState } from "react";

const OPCIONES_CATEGORIA = ["Administrativo", "Operación"];

type Fila = {
  id: number;
  categoria: string | null;
  puesto: string | null;
  area: string | null;
  jefe_directo: string | null;
  subordinacion: string | null;
  descripcion_puesto: string | null;
  actividades_diarias: string | null;
};

export default function CuadroBasicoModal({ onCerrar }: { onCerrar: () => void }) {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [areas, setAreas] = useState<string[]>([]);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);

  const cargar = () => {
    fetch("/api/cuadro-basico", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setFilas(d.filas || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  };
  useEffect(() => {
    cargar();
    fetch("/api/areas-personal", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAreas(d.areas || []))
      .catch(() => {});
  }, []);

  const resumen = filas.reduce((acc: Record<string, number>, f) => {
    const clave = f.puesto?.trim() || "Sin puesto";
    acc[clave] = (acc[clave] || 0) + 1;
    return acc;
  }, {});

  const guardarFila = async (fila: Fila) => {
    setGuardandoId(fila.id);
    try {
      await fetch("/api/cuadro-basico/fila", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fila) });
    } catch {
      // se reintenta al cerrar/reabrir
    } finally {
      setGuardandoId(null);
    }
  };
  const actualizarCampo = (id: number, campo: keyof Fila, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const guardarConDebounce = (fila: Fila) => {
    guardarFila(fila);
  };

  const agregarFila = async () => {
    const res = await fetch("/api/cuadro-basico/fila", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoria: "Operación", puesto: "", area: "", jefe_directo: "", subordinacion: "", descripcion_puesto: "", actividades_diarias: "" }) });
    const data = await res.json();
    setFilas((prev) => [...prev, { id: data.id, categoria: "Operación", puesto: "", area: "", jefe_directo: "", subordinacion: "", descripcion_puesto: "", actividades_diarias: "" }]);
  };

  const eliminarFila = async (id: number) => {
    if (!confirm("¿Eliminar esta fila del cuadro básico?")) return;
    setFilas((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/cuadro-basico/eliminar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      cargar();
    }
  };

  const columnas: { key: keyof Fila; label: string; ancho: string }[] = [
    { key: "categoria", label: "Categoría", ancho: "w-[130px]" },
    { key: "puesto", label: "Puesto", ancho: "w-[140px]" },
    { key: "area", label: "Área", ancho: "w-[160px]" },
    { key: "jefe_directo", label: "Jefe directo", ancho: "w-[140px]" },
    { key: "subordinacion", label: "Subordinación", ancho: "w-[140px]" },
    { key: "descripcion_puesto", label: "Descripción del puesto", ancho: "w-[220px]" },
    { key: "actividades_diarias", label: "Actividades diarias", ancho: "w-[220px]" },
  ];

  return (
    <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-4 z-50" onClick={onCerrar}>
      <div className="bg-white rounded-2xl w-full max-w-[1200px] h-[88vh] flex flex-col shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--gray-200)]">
          <h2 className="text-[16px] font-bold text-[var(--navy)] m-0">Cuadro Básico</h2>
          <span onClick={onCerrar} className="text-[var(--gray-400)] cursor-pointer text-xl leading-none">✕</span>
        </div>

        <div className="px-6 py-4 border-b border-[var(--gray-200)]">
          {cargando ? (
            <p className="text-[12.5px] text-[var(--gray-400)] m-0">Cargando resumen...</p>
          ) : (
            <div className="flex flex-wrap gap-x-6 gap-y-1.5">
              {Object.entries(resumen).map(([puesto, cantidad]) => (
                <span key={puesto} className="text-[12.5px] text-[var(--text)]">
                  <b className="text-[var(--navy)]">{puesto}</b> {cantidad}
                </span>
              ))}
              <span className="text-[12.5px] font-bold text-[var(--blue)]">Total: {filas.length}</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {!cargando && (
            <table className="w-full border-collapse min-w-[1300px]">
              <thead>
                <tr>
                  {columnas.map((c) => (
                    <th key={c.key} className={`sticky top-0 bg-[var(--navy)] text-white text-left text-[10px] uppercase tracking-wide px-2.5 py-2.5 ${c.ancho}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="sticky top-0 bg-[var(--navy)] w-[40px]" />
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--gray-200)]">
                    {columnas.map((c) => (
                      <td key={c.key} className="p-1 align-top">
                        {c.key === "categoria" ? (
                          <select
                            value={f.categoria || ""}
                            onChange={(e) => {
                              actualizarCampo(f.id, "categoria", e.target.value);
                              guardarConDebounce({ ...f, categoria: e.target.value });
                            }}
                            className="w-full border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] rounded-md px-2 py-1.5 text-[12px] bg-transparent"
                          >
                            {OPCIONES_CATEGORIA.map((op) => (
                              <option key={op} value={op}>
                                {op}
                              </option>
                            ))}
                          </select>
                        ) : c.key === "area" ? (
                          <select
                            value={f.area || ""}
                            onChange={(e) => {
                              actualizarCampo(f.id, "area", e.target.value);
                              guardarConDebounce({ ...f, area: e.target.value });
                            }}
                            className="w-full border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] rounded-md px-2 py-1.5 text-[12px] bg-transparent"
                          >
                            <option value="">—</option>
                            {areas.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={f[c.key] || ""}
                            onChange={(e) => actualizarCampo(f.id, c.key, e.target.value)}
                            onBlur={() => guardarConDebounce(filas.find((x) => x.id === f.id)!)}
                            className="w-full border border-transparent hover:border-[var(--gray-200)] focus:border-[var(--blue)] rounded-md px-2 py-1.5 text-[12px]"
                          />
                        )}
                      </td>
                    ))}
                    <td className="p-1 align-top text-center">
                      <span onClick={() => eliminarFila(f.id)} className="text-[var(--red)] cursor-pointer inline-block pt-1.5" title="Eliminar fila">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-[var(--gray-200)] flex items-center justify-between">
          <button type="button" onClick={agregarFila} className="flex items-center gap-1.5 bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Agregar fila
          </button>
          {guardandoId !== null && <span className="text-[11px] text-[var(--gray-400)]">Guardando...</span>}
          <button type="button" onClick={onCerrar} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
