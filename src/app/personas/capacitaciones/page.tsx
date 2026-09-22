"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import CapacitacionFormModal, { CapacitacionData } from "@/components/CapacitacionFormModal";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

declare global {
  interface Window {
    QRious: any;
  }
}
function cargarQRiousLib(): Promise<void> {
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
function escaparHtml(texto: string) {
  return String(texto || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type RespuestaDetalle = {
  numero: number;
  seccion: string;
  pregunta: string;
  opciones: Record<string, string>;
  seleccionada: string | null;
  correcta: string;
  esCorrecta: boolean;
};

type Evaluacion = {
  id: number;
  capacitacion: string;
  nombre: string;
  totalPreguntas: number;
  correctas: number;
  aciertos: number;
  tiempoEvaluacion: number | null;
  respuestas: RespuestaDetalle[];
  creadoEn: string;
};

function formatoTiempo(segundos: number | null): string {
  if (segundos === null || segundos === undefined || isNaN(segundos)) return "—";
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")} min`;
}

function formatoFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function formatoFechaLarga(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return iso;
  }
}

function colorAciertos(aciertos: number): string {
  if (aciertos >= 80) return "text-[var(--green)]";
  if (aciertos >= 60) return "text-[var(--amber)]";
  return "text-[var(--red)]";
}

function imprimirCertificado(ev: Evaluacion) {
  const ventana = window.open("", "_blank", "width=950,height=700");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const aprobado = ev.aciertos >= 80;
  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Certificado — ${escaparHtml(ev.nombre)}</title>
<style>
  body { font-family: Georgia, 'Times New Roman', serif; margin: 0; padding: 0; background: #eef1f6; }
  .lienzo { padding: 24px 16px; display: flex; justify-content: center; }
  .certificado { width: 900px; max-width: 100%; background: #fff; border: 10px solid #16215c; padding: 50px 60px; box-sizing: border-box; position: relative; }
  .certificado::before { content: ""; position: absolute; inset: 14px; border: 2px solid #2f6fed; pointer-events: none; }
  .marca { text-align: center; color: #9aa1b0; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; margin: 0 0 6px; }
  .empresa { text-align: center; color: #16215c; font-family: Arial, sans-serif; font-weight: 800; font-size: 15px; letter-spacing: 1px; margin: 0 0 28px; }
  .titulo { text-align: center; color: #16215c; font-size: 34px; font-weight: bold; margin: 0 0 6px; letter-spacing: 1px; }
  .subtitulo { text-align: center; color: #2f6fed; font-family: Arial, sans-serif; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 36px; }
  .otorga { text-align: center; font-family: Arial, sans-serif; color: #5a5a5a; font-size: 13px; margin: 0 0 8px; }
  .nombre { text-align: center; color: #16215c; font-size: 30px; font-weight: bold; margin: 0 0 8px; border-bottom: 2px solid #e5e8ee; display: inline-block; padding: 0 20px 10px; }
  .nombreWrap { text-align: center; margin-bottom: 22px; }
  .cuerpo { text-align: center; font-family: Arial, sans-serif; color: #333; font-size: 13.5px; line-height: 1.7; max-width: 620px; margin: 0 auto 30px; }
  .cuerpo b { color: #16215c; }
  .datos { display: flex; justify-content: center; gap: 60px; margin-bottom: 38px; }
  .dato { text-align: center; font-family: Arial, sans-serif; }
  .dato .valor { font-size: 24px; font-weight: 800; color: #16215c; }
  .dato .valor.aprobado { color: #21a866; }
  .dato .valor.noaprobado { color: #e2412c; }
  .dato .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #9aa1b0; margin-top: 2px; }
  .pie { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; font-family: Arial, sans-serif; }
  .firma { text-align: center; width: 220px; }
  .firma .linea { border-top: 1px solid #333; padding-top: 6px; font-size: 11px; color: #5a5a5a; }
  .sello { text-align: center; width: 220px; font-size: 10.5px; color: #9aa1b0; }
  .barra { padding: 14px 0; text-align: center; }
  button { padding: 10px 26px; font-size: 13px; font-weight: bold; background: #16215c; color: #fff; border: none; border-radius: 8px; cursor: pointer; font-family: Arial, sans-serif; }
  @media print { body { background: #fff; } .lienzo { padding: 0; } .certificado { border: 10px solid #16215c; } .barra { display: none; } @page { size: landscape; } }
</style>
</head>
<body>
<div class="lienzo">
  <div class="certificado">
    <p class="marca">Sistema interno de capacitación</p>
    <p class="empresa">TRANSPORTES LOGISTICAR</p>
    <p class="titulo">Certificado de Capacitación</p>
    <p class="subtitulo">${aprobado ? "Evaluación aprobada" : "Constancia de participación"}</p>
    <p class="otorga">Se otorga el presente reconocimiento a:</p>
    <div class="nombreWrap"><span class="nombre">${escaparHtml(ev.nombre)}</span></div>
    <p class="cuerpo">Por haber concluido satisfactoriamente la evaluación de conocimientos correspondiente a la capacitación <b>${escaparHtml(ev.capacitacion)}</b>, demostrando el nivel de comprensión que se detalla a continuación.</p>
    <div class="datos">
      <div class="dato"><div class="valor ${aprobado ? "aprobado" : "noaprobado"}">${Math.round(ev.aciertos)}%</div><div class="label">Aciertos</div></div>
      <div class="dato"><div class="valor">${ev.correctas}/${ev.totalPreguntas}</div><div class="label">Respuestas correctas</div></div>
      <div class="dato"><div class="valor">${formatoTiempo(ev.tiempoEvaluacion)}</div><div class="label">Tiempo de evaluación</div></div>
    </div>
    <div class="pie">
      <div class="firma"><div class="linea">Firma de quien evaluó</div></div>
      <div class="sello">Emitido el ${formatoFechaLarga(ev.creadoEn)}</div>
      <div class="firma"><div class="linea">${escaparHtml(ev.nombre)}</div></div>
    </div>
  </div>
</div>
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>
  document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });
</script>
</body>
</html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

type CapacitacionResumen = { id: number; titulo: string; descripcion: string | null; total_preguntas: number };

export default function CapacitacionesPage() {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<Evaluacion | null>(null);
  const [catalogo, setCatalogo] = useState<CapacitacionResumen[]>([]);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState<CapacitacionData | undefined>(undefined);
  const [editandoNombreId, setEditandoNombreId] = useState<number | null>(null);
  const [nombreTmp, setNombreTmp] = useState("");
  const [filtroCapacitacion, setFiltroCapacitacion] = useState("");
  const [nombresExpedientes, setNombresExpedientes] = useState<string[]>([]);

  const cargar = () => {
    fetch("/api/capacitaciones/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setEvaluaciones(data.registros || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  };
  const cargarCatalogo = () => {
    fetch("/api/capacitaciones/catalogo/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCatalogo(data.registros || []))
      .catch(() => {});
  };

  useEffect(() => {
    cargar();
    cargarCatalogo();
    fetch("/api/expedientes/list", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setNombresExpedientes((d.registros || []).map((e: { nombre: string }) => e.nombre).sort()))
      .catch(() => {});
  }, []);
  useRefrescarAlEnfocar(() => {
    cargar();
    cargarCatalogo();
  });

  useEffect(() => {
    if (catalogo.length === 0) return;
    cargarQRiousLib()
      .then(() => {
        const origen = window.location.origin;
        catalogo.forEach((c) => {
          const canvas = document.getElementById(`qr-cap-${c.id}`) as HTMLCanvasElement | null;
          if (canvas) {
            new window.QRious({ element: canvas, value: `${origen}/personas/capacitaciones/tomar?id=${c.id}`, size: 60, level: "M" });
          }
        });
      })
      .catch(() => {});
  }, [catalogo]);

  const abrirEditar = async (id: number) => {
    try {
      const res = await fetch(`/api/capacitaciones/catalogo/get?id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "No se pudo cargar la capacitación.");
      setEditando({ id: data.registro.id, titulo: data.registro.titulo, descripcion: data.registro.descripcion || "", preguntas: data.registro.preguntas || [] });
      setModalAbierto(true);
    } catch (err: any) {
      alert(err.message || "No se pudo cargar la capacitación.");
    }
  };
  const eliminarCapacitacion = async (id: number, titulo: string) => {
    if (!confirm(`¿Eliminar la capacitación "${titulo}"? Esta acción no se puede deshacer.`)) return;
    try {
      await fetch("/api/capacitaciones/catalogo/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      cargarCatalogo();
    } catch {
      alert("No se pudo eliminar la capacitación.");
    }
  };

  const guardarNombreEvaluacion = async (id: number, nombreNuevo?: string) => {
    const nombre = (nombreNuevo ?? nombreTmp).trim();
    setEditandoNombreId(null);
    if (!nombre) return;
    setEvaluaciones((prev) => prev.map((e) => (e.id === id ? { ...e, nombre } : e)));
    try {
      const res = await fetch("/api/capacitaciones/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, nombre }) });
      if (!res.ok) throw new Error();
    } catch {
      alert("No se pudo actualizar el nombre.");
      cargar();
    }
  };

  const eliminarEvaluacion = async (id: number, nombre: string) => {
    if (!confirm(`¿Eliminar por completo el registro de "${nombre}"? Esta acción no se puede deshacer.`)) return;
    setEvaluaciones((prev) => prev.filter((e) => e.id !== id));
    try {
      const res = await fetch("/api/capacitaciones/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      if (!res.ok) throw new Error();
    } catch {
      alert("No se pudo eliminar el registro.");
      cargar();
    }
  };

  const capacitacionesDisponibles = Array.from(new Set(evaluaciones.map((e) => e.capacitacion))).sort();
  const evaluacionesFiltradas = filtroCapacitacion ? evaluaciones.filter((e) => e.capacitacion === filtroCapacitacion) : evaluaciones;
  const mejoresDesempenos = [...evaluacionesFiltradas].sort((a, b) => b.aciertos - a.aciertos).slice(0, 10);
  const maximoAciertos = mejoresDesempenos.length > 0 ? Math.max(...mejoresDesempenos.map((e) => e.aciertos), 1) : 1;

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Capacitaciones"
          subtitulo="Catálogo de capacitaciones y evaluaciones del personal."
          backHref="/personas"
          backLabel="Personas"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
              <path d="M2 8l10-4 10 4-10 4-10-4z" />
              <path d="M6 10v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
              <path d="M22 8v6" />
            </svg>
          }
        />

        {/* Catálogo */}
        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-[var(--navy)] m-0">Catálogo de capacitaciones</h3>
            <button
              type="button"
              onClick={() => {
                setEditando(undefined);
                setModalAbierto(true);
              }}
              className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar capacitación
            </button>
          </div>

          {catalogo.length === 0 && <p className="text-[13px] text-[var(--gray-400)]">Aún no hay capacitaciones. Usa &quot;Agregar capacitación&quot; para crear la primera.</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-5">
            {catalogo.map((c) => (
              <div key={c.id} className="bg-white border border-[var(--gray-200)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_2px_rgba(22,33,92,0.04)] relative hover:border-[var(--blue)] transition-colors">
                <div className="absolute top-3 right-3 flex items-center gap-1.5">
                  <span onClick={() => abrirEditar(c.id)} className="w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center cursor-pointer" title="Editar capacitación">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                  </span>
                  <span onClick={() => eliminarCapacitacion(c.id, c.titulo)} className="w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center cursor-pointer" title="Eliminar capacitación">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e2412c" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                  </span>
                </div>
                <Link href={`/personas/capacitaciones/tomar?id=${c.id}`} className="block no-underline">
                  <div className="w-[76px] h-[76px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-3 md:mb-4 p-1.5">
                    <canvas id={`qr-cap-${c.id}`} />
                  </div>
                  <h3 className="text-[13.5px] md:text-[14.5px] font-bold text-[var(--navy)] m-0 mb-2 leading-tight pr-6">{c.titulo}</h3>
                  <div className="w-[26px] h-[3px] bg-[var(--blue)] rounded-sm mx-auto mb-2.5" />
                  <p className="text-[12px] md:text-[12.5px] text-[var(--gray-400)] m-0 leading-relaxed mb-1">
                    {c.descripcion || `Evaluación de ${c.total_preguntas} preguntas.`}
                  </p>
                  <p className="text-[10.5px] font-bold text-[var(--blue)] m-0">{c.total_preguntas} preguntas · Escanea para iniciar</p>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Filtro por curso */}
        {!cargando && evaluaciones.length > 0 && (
          <div className="flex items-center gap-2.5 mb-5">
            <label className="text-[12.5px] font-bold text-[var(--navy)]">Filtrar por curso:</label>
            <select
              value={filtroCapacitacion}
              onChange={(e) => setFiltroCapacitacion(e.target.value)}
              className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] bg-white"
            >
              <option value="">Todos los cursos</option>
              {capacitacionesDisponibles.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Gráfica de mejores desempeños */}
        {!cargando && evaluacionesFiltradas.length > 0 && (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-6">
            <h3 className="text-[15px] font-bold text-[var(--navy)] mb-1">Mejores desempeños</h3>
            <p className="text-[12px] text-[var(--gray-400)] mb-5">Los aciertos más altos registrados{filtroCapacitacion ? ` en ${filtroCapacitacion}` : " en todas las evaluaciones"}.</p>
            <div className="flex flex-col gap-2.5">
              {mejoresDesempenos.map((ev, i) => (
                <div key={ev.id} className="flex items-center gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[12px] font-bold text-white" style={{ backgroundColor: "#0f4c4c" }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px] font-semibold text-[var(--navy)] m-0 mb-1 truncate">
                      {ev.nombre} <span className="text-[var(--gray-400)] font-normal">· {ev.capacitacion}</span>
                    </p>
                    <div className="h-7 rounded-sm overflow-hidden" style={{ backgroundColor: "#e4eef0" }}>
                      <div
                        className="h-full flex items-center justify-end px-2.5"
                        style={{ width: `${Math.max(10, (ev.aciertos / maximoAciertos) * 100)}%`, backgroundColor: "#159a9c" }}
                      >
                        <span className="text-[11.5px] font-bold text-white whitespace-nowrap">{Math.round(ev.aciertos)}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabla de registros */}
        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <h3 className="text-[15px] font-bold text-[var(--navy)] mb-4">Registro de evaluaciones</h3>

          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)]">Cargando registros…</p>
          ) : evaluaciones.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)]">Aún no hay evaluaciones registradas.</p>
          ) : evaluacionesFiltradas.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)]">No hay evaluaciones registradas para &quot;{filtroCapacitacion}&quot;.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[640px]">
                <thead>
                  <tr>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-l-lg">Capacitación</th>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3">Nombre</th>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3">Aciertos</th>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3">Tiempo de evaluación</th>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 w-[90px]">Detalle</th>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 w-[100px]">Certificado</th>
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-r-lg w-[70px]">Eliminar</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluacionesFiltradas.map((ev) => (
                    <tr key={ev.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                      <td className="px-3.5 py-3 text-[13.5px] font-semibold text-[var(--navy)]">{ev.capacitacion}</td>
                      <td className="px-3.5 py-3 text-[13.5px]">
                        {editandoNombreId === ev.id ? (
                          <select
                            autoFocus
                            value={nombreTmp}
                            onChange={(e) => {
                              setNombreTmp(e.target.value);
                              guardarNombreEvaluacion(ev.id, e.target.value);
                            }}
                            onBlur={() => setEditandoNombreId(null)}
                            className="border border-[var(--blue)] rounded-md px-2 py-1 text-[13.5px] w-full bg-white"
                          >
                            {!nombresExpedientes.includes(ev.nombre) && <option value={ev.nombre}>{ev.nombre}</option>}
                            {nombresExpedientes.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            onClick={() => {
                              setEditandoNombreId(ev.id);
                              setNombreTmp(ev.nombre);
                            }}
                            className="cursor-pointer hover:underline decoration-dotted"
                            title="Clic para cambiar el nombre (lista de Expedientes)"
                          >
                            {ev.nombre}
                          </span>
                        )}
                      </td>
                      <td className={`px-3.5 py-3 text-[13.5px] font-bold ${colorAciertos(ev.aciertos)}`}>
                        {Math.round(ev.aciertos)}% <span className="text-[var(--gray-400)] font-normal text-[12px]">({ev.correctas}/{ev.totalPreguntas})</span>
                      </td>
                      <td className="px-3.5 py-3 text-[13.5px]">{formatoTiempo(ev.tiempoEvaluacion)}</td>
                      <td className="px-3.5 py-3">
                        <button
                          type="button"
                          onClick={() => setDetalle(ev)}
                          title="Ver detalle de respuestas"
                          className="w-8 h-8 rounded-lg bg-[var(--blue-light)] flex items-center justify-center"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3.5 py-3">
                        <button
                          type="button"
                          onClick={() => imprimirCertificado(ev)}
                          title="Ver / imprimir certificado"
                          className="w-8 h-8 rounded-lg bg-[var(--gray-100)] flex items-center justify-center"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2">
                            <circle cx="12" cy="8" r="5" />
                            <path d="M8.5 12.5L7 22l5-3 5 3-1.5-9.5" />
                          </svg>
                        </button>
                      </td>
                      <td className="px-3.5 py-3">
                        <span onClick={() => eliminarEvaluacion(ev.id, ev.nombre)} className="text-[var(--red)] cursor-pointer" title="Eliminar registro por completo">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          </svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {detalle && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 px-3 overflow-y-auto z-50" onClick={() => setDetalle(null)}>
          <div
            className="bg-white rounded-2xl w-[720px] max-w-full p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-1">
              <div>
                <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">{detalle.nombre}</h3>
                <p className="text-[12.5px] text-[var(--gray-400)] mt-1 mb-0">
                  {detalle.capacitacion} · {formatoFecha(detalle.creadoEn)}
                </p>
              </div>
              <button type="button" onClick={() => setDetalle(null)} className="text-[var(--gray-400)] text-[20px] leading-none px-1">
                ×
              </button>
            </div>

            <div className="flex items-center gap-4 my-4">
              <span className={`text-[22px] font-bold ${colorAciertos(detalle.aciertos)}`}>{Math.round(detalle.aciertos)}%</span>
              <span className="text-[13px] text-[var(--gray-400)]">
                {detalle.correctas} de {detalle.totalPreguntas} respuestas correctas · {formatoTiempo(detalle.tiempoEvaluacion)}
              </span>
            </div>

            <div className="max-h-[55vh] overflow-y-auto pr-1 -mr-1">
              {detalle.respuestas.map((r) => (
                <div key={r.numero} className="border-b border-[var(--gray-200)] py-3">
                  <div className="flex items-start gap-2.5">
                    <span
                      className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[12px] font-bold ${
                        r.esCorrecta ? "bg-[var(--green)]" : "bg-[var(--red)]"
                      }`}
                    >
                      {r.esCorrecta ? "✓" : "✕"}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--navy)] m-0">
                        {r.numero}. {r.pregunta}
                      </p>
                      <p className="text-[12.5px] mt-1 mb-0">
                        <span className="text-[var(--gray-400)]">Respuesta seleccionada: </span>
                        <span className={r.esCorrecta ? "text-[var(--green)] font-semibold" : "text-[var(--red)] font-semibold"}>
                          {r.seleccionada ? `${r.seleccionada}) ${r.opciones[r.seleccionada]}` : "Sin responder"}
                        </span>
                      </p>
                      {!r.esCorrecta && (
                        <p className="text-[12.5px] mt-0.5 mb-0">
                          <span className="text-[var(--gray-400)]">Respuesta correcta: </span>
                          <span className="text-[var(--green)] font-semibold">
                            {r.correcta}) {r.opciones[r.correcta]}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setDetalle(null)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalAbierto && (
        <CapacitacionFormModal
          inicial={editando}
          onCancelar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargarCatalogo();
          }}
        />
      )}
    </div>
  );
}
