"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const OPCIONES_TIPO = ["Preventivo", "Correctivo"];

type Fila = {
  id: number;
  estado: string;
  folio: string;
  ecoUnidad: string;
  unidad: string;
  tipoMantenimiento: string;
  reporteFalla: string;
  fechaIngresoTaller: string;
  costo: string;
};

export default function HistorialMantenimientosPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [bloqueado, setBloqueado] = useState(true);

  const cargar = async () => {
    try {
      const res = await fetch("/api/historial-mantenimientos/list", { cache: "no-store" });
      const data = await res.json();
      setFilas(data.registros || []);
    } catch {
      // se reintenta con la siguiente accion
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const actualizarLocal = (id: number, campo: keyof Fila, valor: string) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)));
  };
  const guardarCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/historial-mantenimientos/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, [campo]: valor }),
    }).catch(() => cargar());
  };

  const agregarFila = async () => {
    try {
      const res = await fetch("/api/historial-mantenimientos", { method: "POST" });
      const data = await res.json();
      setFilas((prev) => [...prev, { id: data.id, estado: "", folio: "", ecoUnidad: "", unidad: "", tipoMantenimiento: "Preventivo", reporteFalla: "", fechaIngresoTaller: "", costo: "" }]);
    } catch {
      alert("No se pudo agregar la fila.");
    }
  };
  const eliminarFila = async (id: number) => {
    if (!confirm("¿Eliminar esta fila?")) return;
    setFilas((prev) => prev.filter((f) => f.id !== id));
    try {
      await fetch("/api/historial-mantenimientos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargar();
    }
  };

  const exportar = () => {
    exportarExcel(`Historial_de_mantenimientos_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Historial de mantenimientos",
        filas: filas.map((f) => ({
          Estado: f.estado,
          Folio: f.folio,
          "ECO. Unidad": f.ecoUnidad,
          Unidad: f.unidad,
          "Tipo de mantenimiento": f.tipoMantenimiento,
          "Reporte de falla": f.reporteFalla,
          "Fecha de ingreso al taller": f.fechaIngresoTaller,
          Costo: f.costo,
        })),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Historial de mantenimientos"
          subtitulo="Registro libre del historial de mantenimientos de las unidades."
          backHref="/ordenes-servicio"
          backLabel="Órdenes de servicio"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={agregarFila}
                disabled={bloqueado}
                className="flex items-center gap-1.5 bg-[var(--navy)] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                + Agregar fila
              </button>
              <span
                onClick={() => setBloqueado((p) => !p)}
                className="text-[var(--gray-400)] hover:text-[var(--navy)] cursor-pointer"
                title={bloqueado ? "Tabla bloqueada — clic para editar" : "Tabla editable — clic para bloquear"}
              >
                {bloqueado ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></svg>
                )}
              </span>
            </div>
            {!cargando && filas.length > 0 && (
              <button type="button" onClick={exportar} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Exportar Excel
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="border-collapse min-w-max w-full">
              <thead>
                <tr>
                  {["Estado", "Folio", "Eco. Unidad", "Unidad", "Tipo de mantenimiento", "Reporte de falla", "Fecha de ingreso al taller", "Costo", "Acciones"].map((c) => (
                    <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--gray-200)]">
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.estado}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "estado", e.target.value);
                          guardarCampo(f.id, "estado", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[100px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.folio}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "folio", e.target.value);
                          guardarCampo(f.id, "folio", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[100px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.ecoUnidad}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "ecoUnidad", e.target.value);
                          guardarCampo(f.id, "ecoUnidad", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[90px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.unidad}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "unidad", e.target.value);
                          guardarCampo(f.id, "unidad", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[100px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <select
                        disabled={bloqueado}
                        value={f.tipoMantenimiento}
                        onChange={(e) => {
                          actualizarLocal(f.id, "tipoMantenimiento", e.target.value);
                          guardarCampo(f.id, "tipoMantenimiento", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px]"
                      >
                        {OPCIONES_TIPO.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.reporteFalla}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "reporteFalla", e.target.value);
                          guardarCampo(f.id, "reporteFalla", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[220px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        type="date"
                        disabled={bloqueado}
                        defaultValue={f.fechaIngresoTaller}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "fechaIngresoTaller", e.target.value);
                          guardarCampo(f.id, "fechaIngresoTaller", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[11.5px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        type="number"
                        disabled={bloqueado}
                        defaultValue={f.costo}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "costo", e.target.value);
                          guardarCampo(f.id, "costo", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[85px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      {!bloqueado && (
                        <span onClick={() => eliminarFila(f.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar fila">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cargando && filas.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin registros. Desbloquea la tabla y usa &quot;+ Agregar fila&quot;.</div>}
          </div>
        </div>

        <PageFooter />
      </div>
    </div>
  );
}
