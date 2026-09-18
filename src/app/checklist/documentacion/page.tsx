"use client";
import { useMemo, useState } from "react";
import Logo from "@/components/Logo";
import { UNIDADES } from "@/lib/unidadesData";
import { compressImage } from "@/lib/imageUtils";
import {
  DOCUMENTOS_CHECK,
  MAX_FOTOS_DOC,
  DocumentosCheck,
  RegistroDocumentacion,
  RespuestaDoc,
} from "@/lib/checkDocumentacionData";
import { descargarExcelDocumentacion, descargarPdfDocumentacion } from "@/lib/checkDocumentacionExport";

type Vista = "formulario" | "previsualizacion" | "guardado";

const docsVacios = (): DocumentosCheck =>
  Object.fromEntries(DOCUMENTOS_CHECK.map((d) => [d.key, { respuesta: null as RespuestaDoc, fotos: [] as string[] }]));

export default function CheckDocumentacionPage() {
  const [eco, setEco] = useState(UNIDADES[0]?.eco || "");
  const [docs, setDocs] = useState<DocumentosCheck>(docsVacios);
  const [vista, setVista] = useState<Vista>("formulario");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [registro, setRegistro] = useState<RegistroDocumentacion | null>(null);
  const [descargando, setDescargando] = useState<"pdf" | "xlsx" | null>(null);
  const [ampliada, setAmpliada] = useState<string | null>(null);

  const unidad = useMemo(() => UNIDADES.find((u) => u.eco === eco), [eco]);

  const setRespuesta = (key: string, respuesta: RespuestaDoc) => {
    setError("");
    setDocs((prev) => ({ ...prev, [key]: { ...prev[key], respuesta } }));
  };

  const agregarFotos = async (key: string, files: File[]) => {
    const actuales = docs[key].fotos;
    const cupo = MAX_FOTOS_DOC - actuales.length;
    if (cupo <= 0) return;
    if (files.length > cupo) setError(`Solo se pueden adjuntar ${MAX_FOTOS_DOC} fotos por documento; se agregaron las primeras ${cupo}.`);
    else setError("");
    const nuevas: string[] = [];
    for (const f of files.slice(0, cupo)) {
      try {
        nuevas.push(await compressImage(f, 1100, 0.6, 300000));
      } catch {
        // se omite la foto si falla la compresión
      }
    }
    setDocs((prev) => ({ ...prev, [key]: { ...prev[key], fotos: [...prev[key].fotos, ...nuevas].slice(0, MAX_FOTOS_DOC) } }));
  };

  const quitarFoto = (key: string, idx: number) =>
    setDocs((prev) => ({ ...prev, [key]: { ...prev[key], fotos: prev[key].fotos.filter((_, i) => i !== idx) } }));

  const previsualizar = () => {
    if (!eco) return setError("Selecciona la unidad.");
    const falta = DOCUMENTOS_CHECK.find((d) => !docs[d.key].respuesta);
    if (falta) return setError(`Responde Sí o No en: ${falta.label}.`);
    setError("");
    setVista("previsualizacion");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      const res = await fetch("/api/checklist-documentacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eco_unidad: eco,
          descripcion_unidad: unidad?.descripcion || "",
          placas: unidad?.placa || "",
          documentos: docs,
        }),
      });
      let data: any = null;
      try {
        data = await res.json();
      } catch {
        throw new Error(res.status === 413 ? "Las fotos son demasiado pesadas. Reduce la cantidad e intenta de nuevo." : "No se pudo guardar. Intenta de nuevo.");
      }
      if (!res.ok || !data.ok) throw new Error(data?.error || "No se pudo guardar.");
      setRegistro({
        folio: data.folio,
        fecha_hora: data.fecha_hora,
        eco_unidad: eco,
        descripcion_unidad: unidad?.descripcion || "",
        placas: unidad?.placa || "",
        documentos: docs,
      });
      setVista("guardado");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setError(e.message || "No se pudo guardar.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setGuardando(false);
    }
  };

  const descargar = async (tipo: "pdf" | "xlsx") => {
    if (!registro) return;
    setDescargando(tipo);
    try {
      if (tipo === "pdf") await descargarPdfDocumentacion(registro);
      else await descargarExcelDocumentacion(registro);
    } catch {
      setError("No se pudo generar el archivo. Intenta de nuevo.");
    } finally {
      setDescargando(null);
    }
  };

  const nuevoCheck = () => {
    setDocs(docsVacios());
    setRegistro(null);
    setError("");
    setVista("formulario");
  };

  const badge = (r: RespuestaDoc) => (
    <span className={`text-[11.5px] font-bold px-2.5 py-0.5 rounded-full ${r === "si" ? "bg-[rgba(33,168,102,0.12)] text-[var(--green)]" : "bg-[rgba(226,65,44,0.1)] text-[var(--red)]"}`}>
      {r === "si" ? "Sí" : "No"}
    </span>
  );

  const galeria = (fotos: string[]) => (
    <div className="flex flex-wrap gap-2">
      {fotos.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i} src={f} alt={`Foto ${i + 1}`} onClick={() => setAmpliada(f)} className="w-24 h-24 rounded-md object-cover border border-[var(--gray-200)] cursor-pointer" />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-6 px-2 sm:px-4">
      <div className="w-full max-w-[430px] md:max-w-[620px] lg:max-w-[760px] bg-white min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-xl overflow-hidden pb-8">
        <div className="px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between border-b border-[var(--gray-200)] flex-wrap gap-2">
          <a href="/checklist/elegir" className="text-[var(--blue)] text-xs font-semibold">← Tipo de check list</a>
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <div className="leading-tight">
              <p className="font-display font-extrabold text-[var(--red)] text-[12px] m-0">TRANSPORTES</p>
              <p className="font-display font-extrabold text-[var(--red)] text-[12px] m-0">LOGISTICAR</p>
            </div>
          </div>
        </div>
        <div className="text-center py-2 border-b border-[var(--gray-200)]">
          <h1 className="font-display font-extrabold text-[var(--navy)] text-base uppercase tracking-wide">Check de Documentación</h1>
        </div>

        {error && (
          <div className="mx-4 sm:mx-6 mt-3 bg-[rgba(226,65,44,0.1)] border border-[var(--red)]/30 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold text-[var(--red)]">⚠ {error}</div>
        )}

        <div className="px-4 sm:px-6 py-4 flex flex-col gap-5">
          {vista !== "guardado" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <label className="font-display font-extrabold text-[var(--navy)] text-xs whitespace-nowrap">ECO. UNIDAD</label>
                {vista === "formulario" ? (
                  <select value={eco} onChange={(e) => setEco(e.target.value)} className="flex-1 h-9 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-2 text-sm">
                    {UNIDADES.map((u) => (
                      <option key={u.eco} value={u.eco}>{u.eco}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-sm font-semibold">{eco}</span>
                )}
              </div>
              <div className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[11.5px] flex flex-col gap-1">
                <span><b className="text-[var(--navy)]">Descripción de unidad:</b> {unidad?.descripcion || "—"}</span>
                <span><b className="text-[var(--navy)]">Placas:</b> {unidad?.placa || "—"}</span>
              </div>
            </div>
          )}

          {vista === "formulario" && (
            <>
              <div className="flex flex-col gap-3">
                {DOCUMENTOS_CHECK.map((d) => {
                  const doc = docs[d.key];
                  return (
                    <div key={d.key} className="border border-[var(--gray-200)] rounded-lg p-3.5 flex flex-col sm:flex-row gap-3 sm:items-start">
                      <div className="sm:w-[46%] shrink-0">
                        <p className="text-[12.5px] font-semibold text-[var(--text)] m-0 mb-2">{d.label}</p>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" checked={doc.respuesta === "si"} onChange={() => setRespuesta(d.key, "si")} className="accent-[var(--green)] w-4 h-4" />
                            <span className={`text-[11.5px] font-bold ${doc.respuesta === "si" ? "text-[var(--green)]" : "text-[var(--gray-400)]"}`}>Sí</span>
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="radio" checked={doc.respuesta === "no"} onChange={() => setRespuesta(d.key, "no")} className="accent-[var(--red)] w-4 h-4" />
                            <span className={`text-[11.5px] font-bold ${doc.respuesta === "no" ? "text-[var(--red)]" : "text-[var(--gray-400)]"}`}>No</span>
                          </label>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10.5px] text-[var(--gray-400)] m-0 mb-1.5">Fotografías ({doc.fotos.length}/{MAX_FOTOS_DOC}) — opcional</p>
                        <div className="flex flex-wrap gap-2">
                          {doc.fotos.map((f, i) => (
                            <div key={i} className="relative w-16 h-16 rounded-md overflow-hidden border border-[var(--gray-200)]">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={f} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                              <button type="button" onClick={() => quitarFoto(d.key, i)} className="absolute top-0 right-0 bg-[var(--red)] text-white text-[11px] w-4 h-4 flex items-center justify-center leading-none">×</button>
                            </div>
                          ))}
                          {doc.fotos.length < MAX_FOTOS_DOC && (
                            <label className="w-16 h-16 rounded-md border-2 border-dashed border-[var(--gray-200)] flex items-center justify-center cursor-pointer text-[var(--navy)] shrink-0">
                              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                                <circle cx="12" cy="13" r="4" />
                              </svg>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  e.target.value = "";
                                  if (files.length) agregarFotos(d.key, files);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={previsualizar} className="w-full bg-[var(--navy)] text-white font-display font-bold text-[13px] rounded-lg py-3">
                Previsualizar
              </button>
            </>
          )}

          {vista === "previsualizacion" && (
            <>
              <p className="text-[12px] text-[var(--gray-400)] m-0">Revisa la información antes de guardar.</p>
              <div className="flex flex-col gap-3">
                {DOCUMENTOS_CHECK.map((d) => {
                  const doc = docs[d.key];
                  return (
                    <div key={d.key} className="border border-[var(--gray-200)] rounded-lg p-3.5 flex flex-col gap-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[12.5px] font-semibold m-0">{d.label}</p>
                        {badge(doc.respuesta)}
                      </div>
                      {doc.fotos.length > 0 ? galeria(doc.fotos) : <p className="text-[11px] italic text-[var(--gray-400)] m-0">Sin fotografías adjuntas.</p>}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2.5">
                <button type="button" disabled={guardando} onClick={() => { setError(""); setVista("formulario"); }} className="flex-1 border border-[var(--gray-200)] text-[var(--navy)] font-display font-bold text-[12.5px] rounded-lg py-3 disabled:opacity-50">
                  ← Editar
                </button>
                <button type="button" disabled={guardando} onClick={guardar} className="flex-1 bg-[var(--green)] text-white font-display font-bold text-[12.5px] rounded-lg py-3 disabled:opacity-60">
                  {guardando ? "Guardando..." : "Confirmar y guardar"}
                </button>
              </div>
            </>
          )}

          {vista === "guardado" && registro && (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-[var(--green)] flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h2 className="font-display font-extrabold text-[var(--navy)] text-[16px] m-0">¡Check de documentación guardado!</h2>
              <p className="text-[12.5px] text-[var(--gray-400)] m-0">Folio: {registro.folio}</p>
              <div className="flex flex-col gap-2.5 w-full max-w-[280px] mt-3">
                <button type="button" disabled={descargando !== null} onClick={() => descargar("pdf")} className="bg-[var(--navy)] text-white font-display font-bold text-[12.5px] rounded-lg py-3 disabled:opacity-60">
                  {descargando === "pdf" ? "Generando PDF..." : "Descargar PDF"}
                </button>
                <button type="button" disabled={descargando !== null} onClick={() => descargar("xlsx")} className="bg-[var(--green)] text-white font-display font-bold text-[12.5px] rounded-lg py-3 disabled:opacity-60">
                  {descargando === "xlsx" ? "Generando Excel..." : "Descargar Excel"}
                </button>
                <button type="button" onClick={nuevoCheck} className="border border-[var(--gray-200)] text-[var(--navy)] font-display font-bold text-[12.5px] rounded-lg py-3">
                  Nuevo check
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {ampliada && (
        <div onClick={() => setAmpliada(null)} className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 cursor-pointer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ampliada} alt="Foto ampliada" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}
    </div>
  );
}
