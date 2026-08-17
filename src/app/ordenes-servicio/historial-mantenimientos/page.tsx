"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const OPCIONES_TIPO = ["Preventivo", "Correctivo"];

declare global {
  interface Window {
    QRious: any;
  }
}
function cargarQRious(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.QRious) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el generador de código QR."));
    document.body.appendChild(script);
  });
}

type Evidencia = { foto: string; descripcion: string };
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
  evidencias: Evidencia[];
  reportadoPor: string;
};

export default function HistorialMantenimientosPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [bloqueado, setBloqueado] = useState(true);
  const [evidenciasAbiertas, setEvidenciasAbiertas] = useState<Fila | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  useEffect(() => {
    cargarQRious()
      .then(async () => {
        await new Promise((r) => setTimeout(r, 50));
        const canvas = document.getElementById("qr-reportar-falla") as HTMLCanvasElement | null;
        if (canvas) {
          new window.QRious({ element: canvas, value: `${window.location.origin}/reportar-falla`, size: 150, level: "M" });
        }
      })
      .catch(() => {});
  }, []);

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
      setFilas((prev) => [...prev, { id: data.id, estado: "", folio: "", ecoUnidad: "", unidad: "", tipoMantenimiento: "Preventivo", reporteFalla: "", fechaIngresoTaller: "", costo: "", evidencias: [], reportadoPor: "" }]);
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

        <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 mb-5 flex items-center gap-4">
          <canvas id="qr-reportar-falla" className="shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-[var(--navy)] m-0 mb-1">Reportar falla desde cualquier dispositivo</p>
            <p className="text-[12px] text-[var(--gray-400)] m-0">Escanea este código QR para abrir el formulario de reporte de fallas y enviarlo directo a este historial.</p>
          </div>
        </div>

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
                  {["Estado", "Folio", "Eco. Unidad", "Unidad", "Tipo de mantenimiento", "Reporte de falla", "Fecha de ingreso al taller", "Costo", "Evidencias", "Acciones"].map((c) => (
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
                    <td className="px-2 py-1.5 whitespace-nowrap text-center">
                      {f.evidencias && f.evidencias.length > 0 ? (
                        <span onClick={() => setEvidenciasAbiertas(f)} className="text-[var(--blue)] cursor-pointer inline-flex items-center gap-1" title="Ver evidencias">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
                          <span className="text-[10.5px] font-bold">{f.evidencias.length}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--gray-200)]">—</span>
                      )}
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

      {evidenciasAbiertas && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[520px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Evidencias — Folio {evidenciasAbiertas.folio}</h3>
              <span onClick={() => setEvidenciasAbiertas(null)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">
              {evidenciasAbiertas.ecoUnidad} {evidenciasAbiertas.reportadoPor ? `· Reportado por: ${evidenciasAbiertas.reportadoPor}` : ""}
            </p>
            <div className="flex flex-col gap-3">
              {evidenciasAbiertas.evidencias.map((ev, i) => (
                <div key={i} className="flex gap-3 items-start border border-[var(--gray-200)] rounded-lg p-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ev.foto}
                    alt={`Evidencia ${i + 1}`}
                    onClick={() => setFotoAmpliada(ev.foto)}
                    className="w-20 h-20 rounded-md object-cover shrink-0 cursor-pointer"
                  />
                  <p className="text-[13px] text-[var(--navy)] m-0">{ev.descripcion || <span className="text-[var(--gray-400)]">Sin descripción.</span>}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)} className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-full rounded-lg object-contain" />
          <span onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-5 text-white text-2xl leading-none cursor-pointer">
            ✕
          </span>
        </div>
      )}
    </div>
  );
}
