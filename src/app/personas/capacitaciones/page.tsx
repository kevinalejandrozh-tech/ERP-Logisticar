"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

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

export default function CapacitacionesPage() {
  const [evaluaciones, setEvaluaciones] = useState<Evaluacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [detalle, setDetalle] = useState<Evaluacion | null>(null);

  const cargar = () => {
    fetch("/api/capacitaciones/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setEvaluaciones(data.registros || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  useEffect(() => {
    cargarQRiousLib()
      .then(() => {
        const origen = window.location.origin;
        const tarjetas: [string, string][] = [
          ["qr-manejo-defensivo", "/personas/capacitaciones/manejo-defensivo"],
          ["qr-procedimientos-atc", "/personas/capacitaciones/procedimientos-atc"],
        ];
        tarjetas.forEach(([id, ruta]) => {
          const canvas = document.getElementById(id) as HTMLCanvasElement | null;
          if (canvas) {
            new window.QRious({ element: canvas, value: `${origen}${ruta}`, size: 150, level: "M" });
          }
        });
      })
      .catch(() => {});
  }, []);


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
          <h3 className="text-[15px] font-bold text-[var(--navy)] mb-4">Catálogo de capacitaciones</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-5">
            <Link
              href="/personas/capacitaciones/manejo-defensivo"
              className="bg-white border border-[var(--gray-200)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_2px_rgba(22,33,92,0.04)] block hover:border-[var(--blue)] transition-colors"
            >
              <div className="w-[80px] h-[80px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-3 md:mb-4 p-1.5">
                <canvas id="qr-manejo-defensivo" />
              </div>
              <h3 className="text-[13.5px] md:text-[14.5px] font-bold text-[var(--navy)] m-0 mb-2 leading-tight">Manejo defensivo</h3>
              <div className="w-[26px] h-[3px] bg-[var(--blue)] rounded-sm mx-auto mb-2.5" />
              <p className="text-[12px] md:text-[12.5px] text-[var(--gray-400)] m-0 leading-relaxed mb-1">
                Evaluación de 100 preguntas sobre conductor profesional, señalización y manejo defensivo.
              </p>
              <p className="text-[10.5px] font-bold text-[var(--blue)] m-0">Escanea para iniciar</p>
            </Link>

            <Link
              href="/personas/capacitaciones/procedimientos-atc"
              className="bg-white border border-[var(--gray-200)] rounded-2xl p-4 md:p-6 text-center shadow-[0_1px_2px_rgba(22,33,92,0.04)] block hover:border-[var(--blue)] transition-colors"
            >
              <div className="w-[80px] h-[80px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-3 md:mb-4 p-1.5">
                <canvas id="qr-procedimientos-atc" />
              </div>
              <h3 className="text-[13.5px] md:text-[14.5px] font-bold text-[var(--navy)] m-0 mb-2 leading-tight">Procedimientos ATC</h3>
              <div className="w-[26px] h-[3px] bg-[var(--blue)] rounded-sm mx-auto mb-2.5" />
              <p className="text-[12px] md:text-[12.5px] text-[var(--gray-400)] m-0 leading-relaxed mb-1">
                Evaluación de 35 preguntas sobre el procedimiento de Atención a Clientes: clientes, evidencias y empates.
              </p>
              <p className="text-[10.5px] font-bold text-[var(--blue)] m-0">Escanea para iniciar</p>
            </Link>

            <div className="bg-[var(--gray-100)] border border-dashed border-[var(--gray-200)] rounded-2xl p-4 md:p-6 text-center opacity-70">
              <div className="w-[42px] h-[42px] md:w-[50px] md:h-[50px] rounded-full bg-white flex items-center justify-center mx-auto mb-3 md:mb-4">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <h3 className="text-[13.5px] md:text-[14.5px] font-bold text-[var(--gray-400)] m-0 mb-2 leading-tight">Próximamente</h3>
              <div className="w-[26px] h-[3px] bg-[var(--gray-200)] rounded-sm mx-auto mb-2.5" />
              <p className="text-[12px] md:text-[12.5px] text-[var(--gray-400)] m-0 leading-relaxed">Nuevas capacitaciones se agregarán aquí.</p>
            </div>
          </div>
        </div>

        {/* Tabla de registros */}
        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <h3 className="text-[15px] font-bold text-[var(--navy)] mb-4">Registro de evaluaciones</h3>

          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)]">Cargando registros…</p>
          ) : evaluaciones.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)]">Aún no hay evaluaciones registradas.</p>
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
                    <th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-r-lg w-[100px]">Certificado</th>
                  </tr>
                </thead>
                <tbody>
                  {evaluaciones.map((ev) => (
                    <tr key={ev.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                      <td className="px-3.5 py-3 text-[13.5px] font-semibold text-[var(--navy)]">{ev.capacitacion}</td>
                      <td className="px-3.5 py-3 text-[13.5px]">{ev.nombre}</td>
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <PageFooter />
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
    </div>
  );
}
