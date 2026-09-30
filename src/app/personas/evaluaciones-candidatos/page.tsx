"use client";
import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import { UMBRAL_ESTRATEGICO, UMBRAL_CONOCIMIENTO } from "@/lib/evaluacionCandidatosData";

type Resumen = {
  id: number;
  puesto: string;
  nombre: string;
  edad: number | null;
  dictamen_auto: string;
  dictamen_final: string | null;
  puntaje_estrategico: number;
  max_estrategico: number;
  puntaje_conocimiento: number;
  max_conocimiento: number;
  video_partes: number;
  created_at: string;
};
type Respuesta = { id: string; seccion: "estrategica" | "conocimiento"; pregunta: string; respuesta: string; puntos: number; maximo: number; correcta?: string };
type Evaluacion = Resumen & { datos: Record<string, any>; respuestas: Respuesta[]; observaciones: string | null; video_nombre: string | null };

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const dictamenDe = (e: { dictamen_final: string | null; dictamen_auto: string }) => e.dictamen_final || e.dictamen_auto;

const ETIQUETAS_DATOS: [string, string][] = [
  ["nombre", "Nombre"],
  ["edad", "Edad"],
  ["telefono", "Teléfono"],
  ["domicilio_actual", "Domicilio actual"],
  ["tipo_vivienda", "Tipo de vivienda"],
  ["familiar", "Vive con / domicilio de"],
  ["pago_vivienda", "Renta o apoyo económico"],
  ["tiempo_domicilio_actual", "Tiempo en domicilio actual"],
  ["domicilio_anterior", "Domicilio anterior"],
  ["tiempo_domicilio_anterior", "Tiempo en domicilio anterior"],
  ["renta_anterior", "Renta anterior"],
  ["tiene_transporte", "¿Cuenta con transporte?"],
  ["tipo_transporte", "Tipo de transporte"],
];

export default function EvaluacionesCandidatosPage() {
  const [lista, setLista] = useState<Resumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [abierta, setAbierta] = useState<Evaluacion | null>(null);
  const [dictamenFinal, setDictamenFinal] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [cargandoVideo, setCargandoVideo] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const cargar = () =>
    fetch("/api/evaluacion-candidatos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLista(d.evaluaciones || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  const cerrarVideo = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
  };

  const abrir = async (id: number) => {
    cerrarVideo();
    try {
      const r = await fetch(`/api/evaluacion-candidatos/get?id=${id}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAbierta(d.evaluacion);
      setDictamenFinal(d.evaluacion.dictamen_final || "");
      setObservaciones(d.evaluacion.observaciones || "");
    } catch (err: any) {
      alert(err.message || "No se pudo abrir la evaluación.");
    }
  };
  const cerrar = () => {
    cerrarVideo();
    setAbierta(null);
  };

  const verVideo = async () => {
    if (!abierta) return;
    setCargandoVideo(true);
    try {
      let b64 = "";
      for (let i = 0; i < abierta.video_partes; i++) {
        const r = await fetch(`/api/evaluacion-candidatos/video?id=${abierta.id}&parte=${i}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        b64 += d.contenido;
      }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      setVideoUrl(URL.createObjectURL(new Blob([bytes], { type: "video/mp4" })));
    } catch (err: any) {
      alert(err.message || "No se pudo cargar el video.");
    } finally {
      setCargandoVideo(false);
    }
  };

  const guardarDictamen = async () => {
    if (!abierta) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/evaluacion-candidatos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: abierta.id, dictamen_final: dictamenFinal, observaciones }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAbierta({ ...abierta, dictamen_final: dictamenFinal || null, observaciones });
      cargar();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!abierta || !confirm(`¿Eliminar la evaluación de ${abierta.nombre}? Esta acción no se puede deshacer.`)) return;
    const r = await fetch("/api/evaluacion-candidatos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: abierta.id }) });
    if (!r.ok) return alert("No se pudo eliminar.");
    cerrar();
    cargar();
  };

  // ---- PDF de resultado (mismo estilo que la Responsiva de uniformes) ----
  const generarPdf = async () => {
    if (!abierta) return;
    const ev: Evaluacion = { ...abierta, dictamen_final: dictamenFinal || null, observaciones };
    setGenerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = 612;
      const mX = 48;
      const ancho = W - mX * 2;
      let y = 50;
      const saltoSi = (alto: number) => {
        if (y + alto > 750) {
          doc.addPage();
          y = 60;
        }
      };

      const logo = await fetch("/logo-transportes.png")
        .then((r) => r.blob())
        .then((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(logo, "PNG", mX, y - 14, 32, 32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text("TRANSPORTES LOGISTICAR", mX + 42, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(47, 111, 237);
      doc.text(new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }), W - mX, y + 6, { align: "right" });
      y += 44;
      doc.setDrawColor(229, 232, 238);
      doc.line(mX, y, W - mX, y);
      y += 26;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(22, 33, 92);
      doc.text("Resultado de evaluación de candidato", mX, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(`Puesto: ${ev.puesto}     ·     Fecha de evaluación: ${fecha(ev.created_at)}     ·     Folio: EVC-${String(ev.id).padStart(4, "0")}`, mX, y);
      y += 20;

      // Encabezado de tabla estilo responsiva
      const encabezado = (a: string, b: string, xB: number) => {
        doc.setFillColor(22, 33, 92);
        doc.rect(mX, y, ancho, 20, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(a, mX + 10, y + 14);
        doc.text(b, mX + xB, y + 14);
        y += 20;
      };

      // Datos del candidato
      encabezado("DATO", "INFORMACIÓN DEL CANDIDATO", 190);
      ETIQUETAS_DATOS.forEach(([k, et], idx) => {
        const v = String(ev.datos?.[k] ?? "").trim();
        if (!v) return;
        const lineas = doc.splitTextToSize(v, ancho - 200);
        const alto = Math.max(20, lineas.length * 12 + 8);
        saltoSi(alto);
        if (idx % 2 === 1) {
          doc.setFillColor(244, 245, 248);
          doc.rect(mX, y, ancho, alto, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(90, 90, 90);
        doc.text(et, mX + 10, y + 13);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 30, 30);
        doc.text(lineas, mX + 190, y + 13);
        y += alto;
      });
      y += 18;

      // Puntajes
      saltoSi(110);
      const pE = pct(ev.puntaje_estrategico, ev.max_estrategico);
      const pC = pct(ev.puntaje_conocimiento, ev.max_conocimiento);
      encabezado("SECCIÓN", "PUNTAJE", 300);
      [
        [`Perfil estratégico (mínimo ${UMBRAL_ESTRATEGICO}%)`, `${ev.puntaje_estrategico} / ${ev.max_estrategico}  (${pE}%)`],
        [`Rutas, casetas y manejo defensivo (mínimo ${UMBRAL_CONOCIMIENTO}%)`, `${ev.puntaje_conocimiento} / ${ev.max_conocimiento}  (${pC}%)`],
      ].forEach(([a, b], idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(244, 245, 248);
          doc.rect(mX, y, ancho, 22, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text(a, mX + 10, y + 15);
        doc.setFont("helvetica", "bold");
        doc.text(b, mX + 300, y + 15);
        y += 22;
      });
      y += 16;

      // Dictamen
      const dict = dictamenDe(ev);
      const apto = dict === "Apto";
      doc.setFillColor(apto ? 227 : 253, apto ? 246 : 234, apto ? 236 : 231);
      doc.setDrawColor(apto ? 33 : 226, apto ? 168 : 65, apto ? 102 : 44);
      doc.roundedRect(mX, y, ancho, 44, 6, 6, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(apto ? 33 : 226, apto ? 168 : 65, apto ? 102 : 44);
      doc.text(`DICTAMEN: ${dict.toUpperCase()}`, mX + 16, y + 27);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text(ev.dictamen_final ? `Dictamen del evaluador (automático: ${ev.dictamen_auto})` : "Dictamen automático según puntaje", W - mX - 14, y + 27, { align: "right" });
      y += 62;

      if (ev.observaciones?.trim()) {
        const lo = doc.splitTextToSize(ev.observaciones.trim(), ancho);
        saltoSi(lo.length * 13 + 24);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(22, 33, 92);
        doc.text("Observaciones del evaluador:", mX, y);
        y += 15;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text(lo, mX, y);
        y += lo.length * 13 + 14;
      }

      // Detalle de respuestas
      const bloque = (titulo: string, seccion: Respuesta["seccion"]) => {
        const items = (ev.respuestas || []).filter((r) => r.seccion === seccion);
        saltoSi(60);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(22, 33, 92);
        doc.text(titulo, mX, y);
        y += 10;
        encabezado("PREGUNTA / RESPUESTA", "PTS", ancho - 34);
        items.forEach((r, idx) => {
          const lp = doc.splitTextToSize(`${idx + 1}. ${r.pregunta}`, ancho - 60);
          const lr = doc.splitTextToSize(`R: ${r.respuesta}`, ancho - 60);
          const lc = seccion === "conocimiento" && r.puntos === 0 && r.correcta ? doc.splitTextToSize(`Correcta: ${r.correcta}`, ancho - 60) : [];
          const alto = (lp.length + lr.length + lc.length) * 11.5 + 10;
          saltoSi(alto);
          if (idx % 2 === 1) {
            doc.setFillColor(244, 245, 248);
            doc.rect(mX, y, ancho, alto, "F");
          }
          let yy = y + 13;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          doc.text(lp, mX + 10, yy);
          yy += lp.length * 11.5;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(60, 60, 60);
          doc.text(lr, mX + 10, yy);
          yy += lr.length * 11.5;
          if (lc.length) {
            doc.setTextColor(33, 168, 102);
            doc.text(lc, mX + 10, yy);
          }
          const bien = r.puntos === r.maximo;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(bien ? 33 : r.puntos === 0 ? 226 : 180, bien ? 168 : r.puntos === 0 ? 65 : 130, bien ? 102 : r.puntos === 0 ? 44 : 20);
          doc.text(`${r.puntos}/${r.maximo}`, W - mX - 12, y + 13, { align: "right" });
          y += alto;
        });
        y += 18;
      };
      bloque("Perfil estratégico", "estrategica");
      bloque("Rutas, casetas y manejo defensivo", "conocimiento");

      // Firmas
      saltoSi(70);
      y += 30;
      doc.setDrawColor(60, 60, 60);
      doc.line(mX, y, mX + 190, y);
      doc.line(340, y, 340 + 190, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text("Evaluó (Recursos Humanos)", mX + 95, y + 16, { align: "center" });
      doc.text("Vo. Bo. Jefe directo", 340 + 95, y + 16, { align: "center" });

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(doc.output("blob")));
    } catch (err: any) {
      alert(err.message || "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };

  const imprimirPdf = () => {
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.focus();
      w.print();
    }
  };
  const descargarPdf = () => {
    if (!pdfUrl || !abierta) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `Evaluacion_${abierta.nombre.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const visibles = lista.filter((e) => `${e.nombre} ${e.puesto}`.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Evaluaciones de candidatos"
          subtitulo="Consulta las evaluaciones enviadas y genera el resultado."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-[13px] text-[var(--gray-400)] m-0">
              {lista.length} evaluación(es) · <span className="text-[var(--green)] font-bold">{lista.filter((e) => dictamenDe(e) === "Apto").length} aptos</span>
            </p>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre o puesto…" className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] w-full sm:w-[280px]" />
          </div>

          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>
          ) : visibles.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)]">Aún no hay evaluaciones enviadas.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {visibles.map((e) => {
                const apto = dictamenDe(e) === "Apto";
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => abrir(e.id)}
                    className={`text-left rounded-xl border px-3.5 py-2.5 bg-white hover:shadow-md transition-shadow ${apto ? "border-[#bfe8d2]" : "border-[#f6c9c1]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${apto ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} />
                      <span className="text-[13px] font-bold text-[var(--navy)]">{e.nombre}</span>
                      {e.video_partes > 0 && <span title="Incluye video" className="text-[11px]">🎥</span>}
                    </div>
                    <p className="text-[11.5px] text-[var(--gray-400)] m-0 mt-0.5">
                      {e.puesto} · {fecha(e.created_at)} · <b className={apto ? "text-[var(--green)]" : "text-[var(--red)]"}>{dictamenDe(e)}</b>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {abierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-40">
          <div className="bg-white rounded-2xl w-[860px] max-w-[94%] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">{abierta.nombre}</h3>
                <p className="text-[12.5px] text-[var(--gray-400)] m-0">
                  {abierta.puesto} · {fecha(abierta.created_at)} · Folio EVC-{String(abierta.id).padStart(4, "0")}
                </p>
              </div>
              <div className="flex gap-2 text-[12px]">
                <span className="bg-[var(--blue-light)] text-[var(--navy)] rounded-lg px-3 py-1.5 font-bold">
                  Estratégico {pct(abierta.puntaje_estrategico, abierta.max_estrategico)}%
                </span>
                <span className="bg-[var(--blue-light)] text-[var(--navy)] rounded-lg px-3 py-1.5 font-bold">
                  Conocimiento {pct(abierta.puntaje_conocimiento, abierta.max_conocimiento)}%
                </span>
              </div>
            </div>

            <h4 className="text-[13.5px] font-bold text-[var(--navy)] mb-2">Información básica</h4>
            <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px] mb-5">
              {ETIQUETAS_DATOS.filter(([k]) => String(abierta.datos?.[k] ?? "").trim()).map(([k, et]) => (
                <div key={k}>
                  <span className="text-[var(--gray-400)]">{et}: </span>
                  <b>{String(abierta.datos[k])}</b>
                </div>
              ))}
            </div>

            {abierta.video_partes > 0 && (
              <div className="mb-5">
                {videoUrl ? (
                  <video src={videoUrl} controls className="w-full max-h-[360px] rounded-lg bg-black" />
                ) : (
                  <button type="button" onClick={verVideo} disabled={cargandoVideo} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[13px] font-bold">
                    {cargandoVideo ? "Cargando video…" : `🎥 Ver video (${abierta.video_nombre || "video.mp4"})`}
                  </button>
                )}
              </div>
            )}

            {(["estrategica", "conocimiento"] as const).map((sec) => (
              <div key={sec} className="mb-5">
                <h4 className="text-[13.5px] font-bold text-[var(--navy)] mb-2">{sec === "estrategica" ? "Perfil estratégico" : "Rutas, casetas y manejo defensivo"}</h4>
                <div className="grid gap-1.5">
                  {abierta.respuestas
                    .filter((r) => r.seccion === sec)
                    .map((r, i) => {
                      const color = r.puntos === r.maximo ? "text-[var(--green)]" : r.puntos === 0 ? "text-[var(--red)]" : "text-[var(--amber)]";
                      return (
                        <div key={r.id} className="flex gap-3 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]">
                          <div className="flex-1">
                            <p className="m-0 font-semibold">{i + 1}. {r.pregunta}</p>
                            <p className="m-0 text-[var(--gray-400)]">R: {r.respuesta}</p>
                            {sec === "conocimiento" && r.puntos === 0 && r.correcta && <p className="m-0 text-[var(--green)]">Correcta: {r.correcta}</p>}
                          </div>
                          <b className={`${color} shrink-0`}>{r.puntos}/{r.maximo}</b>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            <div className="border-t border-[var(--gray-200)] pt-4 grid sm:grid-cols-[220px_1fr] gap-4">
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Dictamen</label>
                <select value={dictamenFinal} onChange={(e) => setDictamenFinal(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px]">
                  <option value="">Automático ({abierta.dictamen_auto})</option>
                  <option value="Apto">Apto</option>
                  <option value="No apto">No apto</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Observaciones del evaluador</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} maxLength={2000} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 justify-between mt-5">
              <button type="button" onClick={eliminar} className="text-[var(--red)] border border-[#f6c9c1] rounded-lg px-4 py-2.5 text-[13px] font-bold">
                Eliminar
              </button>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={cerrar} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Cerrar
                </button>
                <button type="button" onClick={guardarDictamen} disabled={guardando} className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  {guardando ? "Guardando…" : "Guardar dictamen"}
                </button>
                <button type="button" onClick={generarPdf} disabled={generando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  {generando ? "Generando…" : "Previsualizar resultado"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pdfUrl && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
          <div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Previsualización — Resultado de evaluación</h3>
            <iframe ref={iframeRef} src={pdfUrl} className="w-full h-[560px] border border-[var(--gray-200)] rounded-lg" />
            <div className="flex gap-2.5 justify-end mt-4 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pdfUrl);
                  setPdfUrl(null);
                }}
                className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold"
              >
                Cerrar
              </button>
              <button type="button" onClick={descargarPdf} className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Descargar PDF
              </button>
              <button type="button" onClick={imprimirPdf} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
