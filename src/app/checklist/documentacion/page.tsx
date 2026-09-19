"use client";
import { useEffect, useMemo, useState } from "react";
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
type ResumenDoc = Record<string, { respuesta: string | null; fotos: number }>;
type FilaConsulta = { id: number; folio: string; eco_unidad: string; descripcion_unidad: string | null; placas: string | null; fecha_hora: string; resumen: ResumenDoc | null };

const fechaHoraMx = (iso: string) => new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });
const hoyMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());

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

  // Consultas
  const [tab, setTab] = useState<"registrar" | "consultar">("registrar");
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filas, setFilas] = useState<FilaConsulta[]>([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [errorLista, setErrorLista] = useState("");
  const [detalle, setDetalle] = useState<RegistroDocumentacion | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);

  const cargarLista = async (fecha: string) => {
    setCargandoLista(true);
    setErrorLista("");
    try {
      const res = await fetch(`/api/checklist-documentacion/list${fecha ? `?fecha=${fecha}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudieron cargar los registros.");
      setFilas(data.registros || []);
    } catch (e: any) {
      setErrorLista(e.message || "No se pudieron cargar los registros.");
      setFilas([]);
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => {
    if (tab === "consultar" && !detalle) cargarLista(filtroFecha);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, filtroFecha]);

  const verRegistro = async (id: number) => {
    setCargandoDetalle(true);
    setErrorLista("");
    try {
      const res = await fetch(`/api/checklist-documentacion/get?id=${id}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "No se pudo abrir el registro.");
      const r = data.registro;
      setDetalle({ folio: r.folio, fecha_hora: r.fecha_hora, eco_unidad: r.eco_unidad, descripcion_unidad: r.descripcion_unidad || "", placas: r.placas || "", documentos: r.documentos });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e: any) {
      setErrorLista(e.message || "No se pudo abrir el registro.");
    } finally {
      setCargandoDetalle(false);
    }
  };

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

  const descargar = async (tipo: "pdf" | "xlsx", reg: RegistroDocumentacion | null = registro) => {
    if (!reg) return;
    setDescargando(tipo);
    try {
      if (tipo === "pdf") await descargarPdfDocumentacion(reg);
      else await descargarExcelDocumentacion(reg);
    } catch {
      setError("No se pudo generar el archivo. Intenta de nuevo.");
      setErrorLista("No se pudo generar el archivo. Intenta de nuevo.");
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

  const tarjetasDocumentos = (documentos: DocumentosCheck) => (
    <div className="flex flex-col gap-3">
      {DOCUMENTOS_CHECK.map((d) => {
        const doc = documentos[d.key];
        return (
          <div key={d.key} className="border border-[var(--gray-200)] rounded-lg p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12.5px] font-semibold m-0">{d.label}</p>
              {badge(doc?.respuesta ?? null)}
            </div>
            {doc?.fotos?.length > 0 ? galeria(doc.fotos) : <p className="text-[11px] italic text-[var(--gray-400)] m-0">Sin fotografías adjuntas.</p>}
          </div>
        );
      })}
    </div>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-4 sm:px-6 pt-4">
          {([
            { k: "registrar", n: "Opción 1", t: "Registrar check", d: "Captura un nuevo check de documentación con fotografías." },
            { k: "consultar", n: "Opción 2", t: "Consultar checks", d: "Historial de registros, filtro por día, PDF y Excel." },
          ] as const).map((o) => (
            <button
              key={o.k}
              type="button"
              onClick={() => setTab(o.k)}
              className={`p-3.5 rounded-xl border text-left transition-all ${tab === o.k ? "bg-white border-[var(--blue)] shadow-md ring-2 ring-[var(--blue)]/20" : "bg-white/60 border-[var(--gray-200)] hover:bg-white"}`}
            >
              <span className="text-[11px] font-bold tracking-wider text-[var(--blue)] uppercase block mb-0.5">{o.n}</span>
              <h2 className="text-[14.5px] font-bold text-[var(--navy)] m-0">{o.t}</h2>
              <p className="text-[11.5px] text-[var(--gray-400)] mt-1.5 mb-0">{o.d}</p>
            </button>
          ))}
        </div>

        {tab === "registrar" && error && (
          <div className="mx-4 sm:mx-6 mt-3 bg-[rgba(226,65,44,0.1)] border border-[var(--red)]/30 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold text-[var(--red)]">⚠ {error}</div>
        )}

        {tab === "registrar" && (
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
              {tarjetasDocumentos(docs)}
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
        )}

        {tab === "consultar" && (
          <div className="px-4 sm:px-6 py-4 flex flex-col gap-4">
            {errorLista && (
              <div className="bg-[rgba(226,65,44,0.1)] border border-[var(--red)]/30 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold text-[var(--red)]">⚠ {errorLista}</div>
            )}

            {!detalle && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-end gap-2.5">
                  <div className="flex-1">
                    <label className="font-display font-extrabold text-[var(--navy)] text-xs block mb-1">Filtrar por día</label>
                    <input
                      type="date"
                      value={filtroFecha}
                      onChange={(e) => setFiltroFecha(e.target.value)}
                      className="w-full h-9 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setFiltroFecha(hoyMx())} className="h-9 px-3.5 bg-[var(--blue-light)] text-[var(--blue)] text-[12px] font-bold rounded-md">Hoy</button>
                    <button type="button" onClick={() => setFiltroFecha("")} className="h-9 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-bold rounded-md">Todos</button>
                    <button type="button" onClick={() => cargarLista(filtroFecha)} className="h-9 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-bold rounded-md">🔄</button>
                  </div>
                </div>

                {(cargandoLista || cargandoDetalle) && (
                  <p className="text-center text-[13px] text-gray-500 py-6 m-0">{cargandoDetalle ? "Abriendo registro..." : "Cargando registros..."}</p>
                )}

                {!cargandoLista && !errorLista && filas.length === 0 && (
                  <div className="py-10 text-center bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                    <p className="text-[13px] text-gray-500 font-medium m-0">
                      {filtroFecha ? "No hay registros en el día seleccionado." : "Aún no hay registros guardados."}
                    </p>
                  </div>
                )}

                {!cargandoLista && filas.length > 0 && (
                  <div className="overflow-x-auto border border-[var(--gray-200)] rounded-xl">
                    <table className="w-full text-left text-[12.5px] border-collapse min-w-[560px]">
                      <thead className="bg-[#f8fafc] text-[var(--navy)] font-bold border-b border-[var(--gray-200)]">
                        <tr>
                          <th className="p-3">Folio</th>
                          <th className="p-3">Fecha</th>
                          <th className="p-3">Unidad</th>
                          <th className="p-3 text-center">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--gray-200)]">
                        {filas.map((f) => (
                          <tr key={f.id} className="hover:bg-gray-50/60 transition-colors">
                            <td className="p-3 font-bold text-[var(--navy)] break-all">{f.folio}</td>
                            <td className="p-3 text-gray-600 whitespace-nowrap">{fechaHoraMx(f.fecha_hora)}</td>
                            <td className="p-3">
                              <span className="font-semibold">{f.eco_unidad}</span>
                              {f.descripcion_unidad && <span className="block text-[11px] text-[var(--gray-400)]">{f.descripcion_unidad}</span>}
                            </td>
                            <td className="p-3 text-center">
                              <button type="button" disabled={cargandoDetalle} onClick={() => verRegistro(f.id)} className="px-3 py-1 bg-blue-50 text-[var(--blue)] hover:bg-blue-100 font-semibold text-[12px] rounded-md transition-colors whitespace-nowrap disabled:opacity-60">
                                👁️ Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {detalle && (
              <>
                <button type="button" onClick={() => setDetalle(null)} className="self-start text-[var(--blue)] text-[12px] font-bold">← Volver a la lista</button>
                <div className="bg-[var(--blue-light)] rounded-lg px-3 py-2 text-[11px] font-bold text-[var(--navy)]">
                  Folio: {detalle.folio} · {fechaHoraMx(detalle.fecha_hora)}
                </div>
                <div className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[11.5px] flex flex-col gap-1">
                  <span><b className="text-[var(--navy)]">ECO unidad:</b> {detalle.eco_unidad}</span>
                  <span><b className="text-[var(--navy)]">Descripción de unidad:</b> {detalle.descripcion_unidad || "—"}</span>
                  <span><b className="text-[var(--navy)]">Placas:</b> {detalle.placas || "—"}</span>
                </div>
                {tarjetasDocumentos(detalle.documentos)}
                <div className="flex gap-2.5">
                  <button type="button" disabled={descargando !== null} onClick={() => descargar("pdf", detalle)} className="flex-1 bg-[var(--navy)] text-white font-display font-bold text-[12.5px] rounded-lg py-3 disabled:opacity-60">
                    {descargando === "pdf" ? "Generando PDF..." : "Descargar PDF"}
                  </button>
                  <button type="button" disabled={descargando !== null} onClick={() => descargar("xlsx", detalle)} className="flex-1 bg-[var(--green)] text-white font-display font-bold text-[12.5px] rounded-lg py-3 disabled:opacity-60">
                    {descargando === "xlsx" ? "Generando Excel..." : "Descargar Excel"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
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
