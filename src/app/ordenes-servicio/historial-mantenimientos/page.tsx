"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";
import { compressImage } from "@/lib/imageUtils";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const OPCIONES_TIPO = ["Preventivo", "Correctivo"];
const OPCIONES_ESTADO = ["Revisión Pendiente", "En proceso", "En espera de material", "Completo"];

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
  evidenciasCount: number;
  reportadoPor: string;
  detalleServicio: string;
  evidenciaReparacionCount: number;
  terminoServicio: string;
  facturaUrl: string;
};
type ItemSolicitud = { noEtiqueta: string; descripcion: string; cantidad: string; folioServicio: string; paraUnidad: string; entregadoA: string };
type Solicitud = { id: number; historialId: number; items: ItemSolicitud[]; estado: string };

function filaSolicitudVacia(folio: string, ecoUnidad: string): ItemSolicitud {
  return { noEtiqueta: "", descripcion: "", cantidad: "", folioServicio: folio, paraUnidad: ecoUnidad, entregadoA: "" };
}

export default function HistorialMantenimientosPage() {
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cargando, setCargando] = useState(true);
  const [bloqueado, setBloqueado] = useState(true);
  const [evidenciasAbiertas, setEvidenciasAbiertas] = useState<Fila | null>(null);
  const [fotosEvidenciasVer, setFotosEvidenciasVer] = useState<Evidencia[]>([]);
  const abrirVerEvidencias = async (f: Fila) => {
    setFotosEvidenciasVer([]);
    setEvidenciasAbiertas(f);
    try {
      const res = await fetch(`/api/historial-mantenimientos/evidencias?id=${f.id}`, { cache: "no-store" });
      const data = await res.json();
      setFotosEvidenciasVer(data.evidencias || []);
    } catch {
      // si falla, el visor queda sin evidencias
    }
  };
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");
  const [unidadesMaestras, setUnidadesMaestras] = useState<Record<string, string>[]>([]);

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
    fetch("/api/unidades/list", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUnidadesMaestras(d.registros || []))
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

  // ---- Solicitudes de material ----
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const cargarSolicitudes = async () => {
    try {
      const res = await fetch("/api/historial-mantenimientos/solicitudes/list", { cache: "no-store" });
      const data = await res.json();
      setSolicitudes(data.registros || []);
    } catch {
      // se reintenta con la siguiente accion
    }
  };

  useEffect(() => {
    cargar();
    cargarSolicitudes();
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
      const hoy = new Date().toISOString().slice(0, 10);
      setFilas((prev) => [
        ...prev,
        {
          id: data.id,
          estado: "",
          folio: data.folio || "",
          ecoUnidad: "",
          unidad: "",
          tipoMantenimiento: "Preventivo",
          reporteFalla: "",
          fechaIngresoTaller: hoy,
          costo: "",
          evidenciasCount: 0,
          reportadoPor: "",
          detalleServicio: "",
          evidenciaReparacionCount: 0,
          terminoServicio: "",
          facturaUrl: "",
        },
      ]);
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
          "Fecha de reporte": f.fechaIngresoTaller,
          Folio: f.folio,
          "ECO. Unidad": f.ecoUnidad,
          Unidad: f.unidad,
          "Tipo de mantenimiento": f.tipoMantenimiento,
          "Reporte de falla": f.reporteFalla,
          "Detalle de servicio": f.detalleServicio,
          "Término del servicio": f.terminoServicio,
          Costo: f.costo,
        })),
      },
    ]);
  };

  const filasFiltradas = filtroEstado === "todos" ? filas : filas.filter((f) => f.estado === filtroEstado);

  // ---- Solicitar material ----
  const [solicitudAbierta, setSolicitudAbierta] = useState<Fila | null>(null);
  const [itemsSolicitud, setItemsSolicitud] = useState<ItemSolicitud[]>([]);
  const [guardandoSolicitud, setGuardandoSolicitud] = useState(false);

  const abrirSolicitud = (f: Fila) => {
    const existente = solicitudes.find((s) => s.historialId === f.id);
    setItemsSolicitud(existente && existente.items.length > 0 ? existente.items : [filaSolicitudVacia(f.folio, f.ecoUnidad)]);
    setSolicitudAbierta(f);
  };
  const agregarFilaSolicitud = () => {
    if (!solicitudAbierta) return;
    setItemsSolicitud((prev) => [...prev, filaSolicitudVacia(solicitudAbierta.folio, solicitudAbierta.ecoUnidad)]);
  };
  const actualizarItemSolicitud = (idx: number, campo: keyof ItemSolicitud, valor: string) => {
    setItemsSolicitud((prev) => prev.map((it, i) => (i === idx ? { ...it, [campo]: valor } : it)));
  };
  const quitarFilaSolicitud = (idx: number) => {
    setItemsSolicitud((prev) => prev.filter((_, i) => i !== idx));
  };
  const guardarSolicitud = async () => {
    if (!solicitudAbierta) return;
    setGuardandoSolicitud(true);
    try {
      const res = await fetch("/api/historial-mantenimientos/solicitudes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          historialId: solicitudAbierta.id,
          folioServicio: solicitudAbierta.folio,
          ecoUnidad: solicitudAbierta.ecoUnidad,
          items: itemsSolicitud.filter((it) => it.noEtiqueta.trim() || it.descripcion.trim()),
        }),
      });
      if (!res.ok) throw new Error();
      await cargarSolicitudes();
      setSolicitudAbierta(null);
    } catch {
      alert("No se pudo guardar la solicitud de material.");
    } finally {
      setGuardandoSolicitud(false);
    }
  };

  // ---- Evidencia de reparación (agregar fotos con descripción) ----
  const [modalEvidenciaRep, setModalEvidenciaRep] = useState<Fila | null>(null);
  const [fotosEvidenciaRep, setFotosEvidenciaRep] = useState<Evidencia[]>([]);
  const [guardandoEvidenciaRep, setGuardandoEvidenciaRep] = useState(false);

  const abrirEvidenciaRep = async (f: Fila) => {
    setFotosEvidenciaRep([]);
    setModalEvidenciaRep(f);
    if (f.evidenciaReparacionCount > 0) {
      try {
        const res = await fetch(`/api/historial-mantenimientos/evidencias?id=${f.id}&campo=reparacion`, { cache: "no-store" });
        const data = await res.json();
        setFotosEvidenciaRep(data.evidencias || []);
      } catch {
        // si falla, el modal queda sin evidencias precargadas
      }
    }
  };
  const agregarFotosEvidenciaRep = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nuevas: Evidencia[] = [];
    for (const file of files) {
      try {
        const dataUrl = await compressImage(file);
        nuevas.push({ foto: dataUrl, descripcion: "" });
      } catch {
        // se omite si falla la compresion
      }
    }
    setFotosEvidenciaRep((prev) => [...prev, ...nuevas]);
    e.target.value = "";
  };
  const actualizarDescripcionEvidenciaRep = (idx: number, descripcion: string) => {
    setFotosEvidenciaRep((prev) => prev.map((f, i) => (i === idx ? { ...f, descripcion } : f)));
  };
  const quitarFotoEvidenciaRep = (idx: number) => {
    setFotosEvidenciaRep((prev) => prev.filter((_, i) => i !== idx));
  };
  const guardarEvidenciaRep = async () => {
    if (!modalEvidenciaRep) return;
    setGuardandoEvidenciaRep(true);
    try {
      await fetch("/api/historial-mantenimientos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: modalEvidenciaRep.id, evidenciaReparacion: fotosEvidenciaRep }),
      });
      setFilas((prev) => prev.map((f) => (f.id === modalEvidenciaRep.id ? { ...f, evidenciaReparacionCount: fotosEvidenciaRep.length } : f)));
      setModalEvidenciaRep(null);
    } catch {
      alert("No se pudo guardar la evidencia de reparación.");
    } finally {
      setGuardandoEvidenciaRep(false);
    }
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
              <select
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value)}
                className="text-[12px] font-bold text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3 py-1.5 bg-white"
              >
                <option value="todos">Filtrar por estado: Todos</option>
                {OPCIONES_ESTADO.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
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
                  {[
                    "Estado",
                    "Fecha de reporte",
                    "Folio",
                    "Eco. Unidad",
                    "Unidad",
                    "Tipo de mantenimiento",
                    "Quien reporta",
                    "Reporte de falla",
                    "Evidencias",
                    "Detalle de servicio",
                    "Evidencia de reparación",
                    "Término del servicio",
                    "Costo",
                    "Factura",
                    "Acciones",
                  ].map((c) => (
                    <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.map((f) => {
                  const tieneSolicitud = solicitudes.some((s) => s.historialId === f.id);
                  return (
                  <tr key={f.id} className="border-b border-[var(--gray-200)]" style={f.estado === "Completo" ? { backgroundColor: "rgba(33,168,102,0.15)" } : undefined}>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <select
                        disabled={bloqueado}
                        value={OPCIONES_ESTADO.includes(f.estado) ? f.estado : ""}
                        onChange={(e) => {
                          actualizarLocal(f.id, "estado", e.target.value);
                          guardarCampo(f.id, "estado", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[11.5px] w-[145px]"
                      >
                        <option value="">Sin estado</option>
                        {OPCIONES_ESTADO.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
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
                        disabled={bloqueado}
                        defaultValue={f.folio}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "folio", e.target.value);
                          guardarCampo(f.id, "folio", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[90px]"
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
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[80px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <select
                        disabled={bloqueado}
                        value={f.ecoUnidad && unidadesMaestras.some((u) => u["ECO"] === f.ecoUnidad) ? f.ecoUnidad : ""}
                        onChange={(e) => {
                          const eco = e.target.value;
                          const unidadEncontrada = unidadesMaestras.find((u) => u["ECO"] === eco);
                          const modeloTipo = unidadEncontrada?.["Modelo/Tipo"] || "";
                          actualizarLocal(f.id, "ecoUnidad", eco);
                          guardarCampo(f.id, "ecoUnidad", eco);
                          actualizarLocal(f.id, "unidad", modeloTipo);
                          guardarCampo(f.id, "unidad", modeloTipo);
                        }}
                        title="Selecciona el ECO de la unidad para autocompletar"
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[95px]"
                      >
                        <option value="">{f.unidad || "Seleccionar..."}</option>
                        {unidadesMaestras.map((u) => (
                          <option key={u["ECO"]} value={u["ECO"]}>
                            {u["ECO"]} — {u["Modelo/Tipo"]}
                          </option>
                        ))}
                      </select>
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
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.reportadoPor}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "reportadoPor", e.target.value);
                          guardarCampo(f.id, "reportadoPor", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[110px]"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.reporteFalla}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "reporteFalla", e.target.value);
                          guardarCampo(f.id, "reporteFalla", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[190px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-center">
                      {f.evidenciasCount > 0 ? (
                        <span onClick={() => abrirVerEvidencias(f)} className="text-[var(--blue)] cursor-pointer inline-flex items-center gap-1" title="Ver evidencias">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
                          <span className="text-[10.5px] font-bold">{f.evidenciasCount}</span>
                        </span>
                      ) : (
                        <span className="text-[var(--gray-200)]">—</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        disabled={bloqueado}
                        defaultValue={f.detalleServicio}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "detalleServicio", e.target.value);
                          guardarCampo(f.id, "detalleServicio", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[170px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-center">
                      <span onClick={() => abrirEvidenciaRep(f)} className="text-[var(--blue)] cursor-pointer inline-flex items-center gap-1" title="Agregar / ver evidencia de reparación">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                        {f.evidenciaReparacionCount > 0 && <span className="text-[10.5px] font-bold">{f.evidenciaReparacionCount}</span>}
                      </span>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <input
                        type="date"
                        disabled={bloqueado}
                        defaultValue={f.terminoServicio}
                        onBlur={(e) => {
                          actualizarLocal(f.id, "terminoServicio", e.target.value);
                          guardarCampo(f.id, "terminoServicio", e.target.value);
                        }}
                        className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[11.5px]"
                      />
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <input
                          type="number"
                          disabled={bloqueado}
                          defaultValue={f.costo}
                          onBlur={(e) => {
                            actualizarLocal(f.id, "costo", e.target.value);
                            guardarCampo(f.id, "costo", e.target.value);
                          }}
                          className="border border-[var(--gray-200)] disabled:bg-transparent disabled:border-transparent rounded px-1.5 py-1 text-[12px] w-[80px]"
                        />
                        <span
                          onClick={() => abrirSolicitud(f)}
                          className={`text-[10px] font-bold cursor-pointer ${tieneSolicitud ? "text-[var(--green)]" : "text-[var(--blue)]"}`}
                        >
                          {tieneSolicitud ? "✓ Solicitar material" : "Solicitar material"}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-center">
                      {f.facturaUrl ? (
                        <a href={f.facturaUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--green)]" title="Ver factura escaneada">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
                        </a>
                      ) : (
                        <a href={`/scanner?historialId=${f.id}`} className="text-[var(--gray-400)]" title="Escanear factura de la compra">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="M21 15l-5-5L5 21" /></svg>
                        </a>
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
                  );
                })}
              </tbody>
            </table>
            {!cargando && filasFiltradas.length === 0 && (
              <div className="text-center text-[var(--gray-400)] text-[13px] py-8">
                {filas.length === 0 ? <>Sin registros. Desbloquea la tabla y usa &quot;+ Agregar fila&quot;.</> : "Ningún registro coincide con el filtro seleccionado."}
              </div>
            )}
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
              {fotosEvidenciasVer.map((ev, i) => (
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
              {fotosEvidenciasVer.length === 0 && <p className="text-center text-[var(--gray-400)] text-[12.5px] py-4">Sin evidencias.</p>}
            </div>
          </div>
        </div>
      )}

      {modalEvidenciaRep && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[520px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Evidencia de reparación — Folio {modalEvidenciaRep.folio}</h3>
              <span onClick={() => setModalEvidenciaRep(null)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">{modalEvidenciaRep.ecoUnidad}</p>
            <div className="flex flex-col gap-2.5 mb-4">
              {fotosEvidenciaRep.map((f, i) => (
                <div key={i} className="flex gap-2.5 items-start border border-[var(--gray-200)] rounded-lg p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.foto} alt={`Foto ${i + 1}`} className="w-16 h-16 rounded-md object-cover shrink-0" />
                  <input
                    value={f.descripcion}
                    onChange={(e) => actualizarDescripcionEvidenciaRep(i, e.target.value)}
                    placeholder="Descripción de la foto..."
                    className="flex-1 border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px]"
                  />
                  <span onClick={() => quitarFotoEvidenciaRep(i)} className="text-[var(--red)] cursor-pointer shrink-0 mt-1.5" title="Quitar foto">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--gray-200)] rounded-lg py-3 cursor-pointer text-[var(--navy)]">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                <span className="text-[12.5px] font-bold">Tomar / agregar foto</span>
                <input type="file" accept="image/*" capture="environment" multiple onChange={agregarFotosEvidenciaRep} className="hidden" />
              </label>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setModalEvidenciaRep(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarEvidenciaRep} disabled={guardandoEvidenciaRep} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoEvidenciaRep ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {solicitudAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[720px] max-w-[95%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Solicitar material — Folio {solicitudAbierta.folio}</h3>
              <span onClick={() => setSolicitudAbierta(null)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">{solicitudAbierta.ecoUnidad}</p>
            <div className="overflow-x-auto mb-3">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["No. Etiqueta", "Descripción", "Cantidad", "Folio de servicio", "Para qué unidad", "A quién se entrega", ""].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {itemsSolicitud.map((it, idx) => (
                    <tr key={idx} className="border-b border-[var(--gray-200)]">
                      <td className="px-2 py-1.5">
                        <input value={it.noEtiqueta} onChange={(e) => actualizarItemSolicitud(idx, "noEtiqueta", e.target.value)} placeholder="000123" className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[95px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={it.descripcion} onChange={(e) => actualizarItemSolicitud(idx, "descripcion", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[160px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input type="number" value={it.cantidad} onChange={(e) => actualizarItemSolicitud(idx, "cantidad", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[70px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={it.folioServicio} onChange={(e) => actualizarItemSolicitud(idx, "folioServicio", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[100px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={it.paraUnidad} onChange={(e) => actualizarItemSolicitud(idx, "paraUnidad", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[90px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <input value={it.entregadoA} onChange={(e) => actualizarItemSolicitud(idx, "entregadoA", e.target.value)} className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[110px]" />
                      </td>
                      <td className="px-2 py-1.5">
                        <span onClick={() => quitarFilaSolicitud(idx)} className="text-[var(--red)] cursor-pointer" title="Quitar fila">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={agregarFilaSolicitud} className="text-[12px] font-bold text-[var(--blue)] mb-5">
              + Agregar fila
            </button>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setSolicitudAbierta(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarSolicitud} disabled={guardandoSolicitud} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoSolicitud ? "Guardando..." : "Guardar"}
              </button>
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
