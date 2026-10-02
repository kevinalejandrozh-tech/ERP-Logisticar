"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import {
  ACEPTA,
  CampoDocumento,
  DocumentoArchivo,
  MIME_WORD,
  TipoCampo,
  analizarDocumento,
  aplicarValores,
  camposUnicos,
  fechaLarga,
  htmlImpresion,
  leerComoDataUrl,
  mimeDe,
} from "@/lib/rhDocumentos";

type DocLista = { id: number; nombre: string; archivo_nombre: string; mime: string; campos: CampoDocumento[]; tamano: number; actualizado: string };
type Grupo = { id: number; nombre: string; documento_ids: number[] };
type Edicion = { id: number | null; nombre: string; archivo: string; mime: string; archivo_nombre: string; campos: CampoDocumento[] };
type Impresion = { titulo: string; ids: number[]; campos: CampoDocumento[]; paso: "datos" | "vista"; html: string };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";
const tipoArchivo = (mime: string) => (mime === MIME_WORD ? "Word" : mime === "application/pdf" ? "PDF" : "Imagen");
const MAX_BYTES = 3 * 1024 * 1024;

const IconoImprimir = ({ c = "currentColor" }: { c?: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
);

export default function DocumentosRhPage() {
  const [docs, setDocs] = useState<DocLista[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [analizando, setAnalizando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [grupo, setGrupo] = useState<{ id: number | null; nombre: string; ids: number[] } | null>(null);
  const [imp, setImp] = useState<Impresion | null>(null);
  const marco = useRef<HTMLIFrameElement>(null);

  const cargar = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([pedir<{ documentos: DocLista[] }>("/api/rh-documentos"), pedir<{ grupos: Grupo[] }>("/api/rh-documentos/grupos")]);
      setDocs(d.documentos);
      setGrupos(g.grupos);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los documentos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const q = busqueda.trim().toLowerCase();
  const docsVisibles = useMemo(
    () => (q ? docs.filter((d) => `${d.nombre} ${d.archivo_nombre} ${(d.campos || []).map((c) => `${c.etiqueta} ${c.valor}`).join(" ")}`.toLowerCase().includes(q)) : docs),
    [docs, q]
  );
  const gruposVisibles = useMemo(
    () => (q ? grupos.filter((g) => g.nombre.toLowerCase().includes(q) || g.documento_ids.some((id) => docsVisibles.some((d) => d.id === id))) : grupos),
    [grupos, q, docsVisibles]
  );

  // ---------- Agregar / editar documento ----------
  const adjuntar = async (file?: File | null) => {
    if (!file || !edicion) return;
    const mime = mimeDe(file);
    if (!/^(application\/pdf|image\/(png|jpe?g|webp))$/.test(mime) && mime !== MIME_WORD) return alert("Formato no permitido. Usa PDF, imagen (PNG/JPG) o Word (.docx).");
    if (file.size > MAX_BYTES) return alert("El archivo es muy grande (máximo 3 MB).");
    setAnalizando(true);
    try {
      const archivo = await leerComoDataUrl(file);
      const campos = await analizarDocumento(archivo, mime);
      // Conserva los valores capturados de campos con la misma etiqueta.
      const previos = edicion.campos;
      setEdicion({
        ...edicion,
        nombre: edicion.nombre || file.name.replace(/\.[^.]+$/, ""),
        archivo,
        mime,
        archivo_nombre: file.name,
        campos: [...aplicarValores(campos, previos), ...previos.filter((p) => !p.marcador && !campos.some((c) => c.etiqueta.toLowerCase() === p.etiqueta.toLowerCase()))],
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo analizar el documento.");
    } finally {
      setAnalizando(false);
    }
  };

  const setCampo = (i: number, cambios: Partial<CampoDocumento>) => setEdicion((e) => (e ? { ...e, campos: e.campos.map((c, j) => (j === i ? { ...c, ...cambios } : c)) } : e));

  const editar = async (d: DocLista) => {
    setEdicion({ id: d.id, nombre: d.nombre, archivo: "", mime: d.mime, archivo_nombre: d.archivo_nombre, campos: (d.campos || []).map((c) => ({ ...c })) });
  };

  const guardar = async () => {
    if (!edicion) return;
    if (!edicion.nombre.trim()) return alert("Indica el nombre del documento.");
    if (!edicion.id && !edicion.archivo) return alert("Adjunta el documento.");
    setOcupado(true);
    try {
      await pedir("/api/rh-documentos", { method: edicion.id ? "PUT" : "POST", body: JSON.stringify({ ...edicion, campos: edicion.campos.filter((c) => c.etiqueta.trim()) }) });
      setEdicion(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async (d: DocLista) => {
    if (!confirm(`¿Eliminar el documento “${d.nombre}”? También se quita de los grupos.`)) return;
    try {
      await pedir(`/api/rh-documentos?id=${d.id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  // ---------- Grupos ----------
  const guardarGrupo = async () => {
    if (!grupo) return;
    setOcupado(true);
    try {
      await pedir("/api/rh-documentos/grupos", { method: grupo.id ? "PUT" : "POST", body: JSON.stringify({ id: grupo.id, nombre: grupo.nombre, documento_ids: grupo.ids }) });
      setGrupo(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar el grupo.");
    } finally {
      setOcupado(false);
    }
  };

  const eliminarGrupo = async (g: Grupo) => {
    if (!confirm(`¿Eliminar el grupo “${g.nombre}”? Los documentos no se borran.`)) return;
    try {
      await pedir(`/api/rh-documentos/grupos?id=${g.id}`, { method: "DELETE" });
      setGrupo(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  // ---------- Impresión: datos → vista previa → imprimir ----------
  const iniciarImpresion = (titulo: string, ids: number[]) => {
    const seleccion = docs.filter((d) => ids.includes(d.id));
    if (!seleccion.length) return alert("No hay documentos para imprimir.");
    const campos = camposUnicos(seleccion).map((c) => (c.tipo === "fecha_auto" && !c.valor ? { ...c, valor: fechaLarga() } : c));
    setImp({ titulo, ids: seleccion.map((d) => d.id), campos, paso: "datos", html: "" });
  };

  const verPrevia = async () => {
    if (!imp) return;
    setOcupado(true);
    try {
      const r = await pedir<{ documentos: DocumentoArchivo[] }>(`/api/rh-documentos?ids=${imp.ids.join(",")}`);
      const ordenados = imp.ids.map((id) => r.documentos.find((d) => d.id === id)).filter(Boolean) as DocumentoArchivo[];
      const conDatos = ordenados.map((d) => ({ ...d, campos: aplicarValores(d.campos || [], imp.campos) }));
      const html = await htmlImpresion(conDatos, imp.titulo);
      setImp({ ...imp, paso: "vista", html });
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo preparar la vista previa.");
    } finally {
      setOcupado(false);
    }
  };

  const imprimir = () => {
    const w = marco.current?.contentWindow;
    if (!w) return;
    w.focus();
    w.print();
  };

  const pasoCampos = (lista: CampoDocumento[], cambiar: (i: number, c: Partial<CampoDocumento>) => void, conMarcador: boolean) => (
    <div className="grid gap-2">
      {lista.map((c, i) => (
        <div key={i} className={`grid gap-2 items-end ${conMarcador ? "grid-cols-1 sm:grid-cols-[1fr_1.3fr_130px_auto]" : "grid-cols-1 sm:grid-cols-[1fr_1.5fr]"}`}>
          <div>
            {i === 0 && <label className={labelCls}>Campo</label>}
            {conMarcador ? (
              <input type="text" value={c.etiqueta} onChange={(e) => cambiar(i, { etiqueta: e.target.value })} className={inputCls} placeholder="Nombre del campo" />
            ) : (
              <p className="m-0 py-2 text-[13px] font-medium text-[var(--navy)]">{c.etiqueta}</p>
            )}
            {conMarcador && c.marcador && <p className="m-0 mt-0.5 text-[11px] text-[var(--gray-400)] truncate" title={c.marcador}>En el documento: {c.marcador.startsWith("pdf:") ? `campo del PDF “${c.marcador.slice(4)}”` : c.marcador}</p>}
          </div>
          <div>
            {i === 0 && <label className={labelCls}>Valor</label>}
            {c.tipo === "fecha" ? (
              <input type="date" value={c.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} className={inputCls} />
            ) : (
              <input type="text" value={c.valor} onChange={(e) => cambiar(i, { valor: e.target.value })} className={inputCls} placeholder={c.tipo === "fecha_auto" ? `Automática: ${fechaLarga()}` : ""} />
            )}
          </div>
          {conMarcador && (
            <>
              <div>
                {i === 0 && <label className={labelCls}>Tipo</label>}
                <select value={c.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoCampo })} className={inputCls}>
                  <option value="texto">Texto</option>
                  <option value="fecha">Fecha</option>
                  <option value="fecha_auto">Fecha automática</option>
                </select>
              </div>
              <button type="button" className="text-[12px] text-[var(--red)] hover:underline px-1 py-2" onClick={() => setEdicion((e) => (e ? { ...e, campos: e.campos.filter((_, j) => j !== i) } : e))}>Quitar</button>
            </>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Documentos"
          subtitulo="Plantillas de RH (contratos, formatos, cartas) con datos editables, impresión individual o por grupo."
          backHref="/personas"
          backLabel="Recursos Humanos"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        <div className="flex flex-wrap items-center gap-2.5 mb-5">
          <div className="flex items-center gap-2 bg-white border border-[var(--gray-300)] rounded-lg px-3.5 py-2 w-full sm:w-[360px]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.35-4.35" /></svg>
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar documentos…" className="flex-1 border-0 outline-none text-[13.5px] bg-transparent" style={{ boxShadow: "none" }} />
          </div>
          <div className="flex-1" />
          <button type="button" className="btn btn-secundario" onClick={() => setGrupo({ id: null, nombre: "", ids: [] })} disabled={!docs.length}>Crear grupo de documentos</button>
          <button type="button" className="btn btn-primario" onClick={() => setEdicion({ id: null, nombre: "", archivo: "", mime: "", archivo_nombre: "", campos: [] })}>+ Agregar documento</button>
        </div>

        {error && <p className="mb-4 text-[13px] text-[var(--red)]">{error}</p>}
        {cargando && <p className="text-[13px] text-[var(--gray-500)]">Cargando…</p>}

        {!cargando && (
          <>
            {gruposVisibles.length > 0 && (
              <section className="bg-white border border-[var(--gray-200)] rounded-xl p-4 mb-4 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
                <h3 className="text-[13px] font-bold text-[var(--navy)] uppercase tracking-wide m-0 mb-3">Grupos de documentos</h3>
                <div className="flex flex-wrap gap-2.5">
                  {gruposVisibles.map((g) => (
                    <div key={g.id} className="flex items-center rounded-lg overflow-hidden border border-[var(--navy)]">
                      <button type="button" onClick={() => iniciarImpresion(g.nombre, g.documento_ids)} className="flex items-center gap-2 bg-[var(--navy)] text-white px-3.5 py-2 text-[13px] font-medium" title="Capturar datos e imprimir el grupo">
                        <IconoImprimir c="#fff" />
                        {g.nombre}
                        <span className="text-[11px] bg-white/20 rounded px-1.5">{g.documento_ids.length}</span>
                      </button>
                      <button type="button" onClick={() => setGrupo({ id: g.id, nombre: g.nombre, ids: [...g.documento_ids] })} className="px-2.5 py-2 text-[12px] text-[var(--navy)] bg-white hover:bg-[var(--gray-50)]" title="Editar grupo">Editar</button>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white border border-[var(--gray-200)] rounded-xl p-4 mb-8 shadow-[0_1px_4px_rgba(22,33,92,0.05)]">
              <h3 className="text-[13px] font-bold text-[var(--navy)] uppercase tracking-wide m-0 mb-3">Documentos ({docsVisibles.length})</h3>
              {docsVisibles.length === 0 && (
                <p className="text-[13px] text-[var(--gray-500)] m-0">{docs.length ? "Ningún documento coincide con la búsqueda." : "Aún no hay documentos. Agrega el primero con “Agregar documento”."}</p>
              )}
              <div className="flex flex-wrap gap-2.5">
                {docsVisibles.map((d) => (
                  <div key={d.id} className="flex items-center gap-1 rounded-lg border border-[var(--gray-300)] bg-[var(--blue-light)] pl-3 pr-1 py-1">
                    <span className="text-[10.5px] font-medium text-[var(--blue)] bg-white rounded px-1.5 py-0.5">{tipoArchivo(d.mime)}</span>
                    <button type="button" onClick={() => editar(d)} className="text-[13px] font-medium text-[var(--navy)] px-1.5 hover:underline" title="Editar datos del documento">{d.nombre}</button>
                    <button type="button" onClick={() => iniciarImpresion(d.nombre, [d.id])} className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--navy)] hover:bg-white" title="Imprimir" aria-label={`Imprimir ${d.nombre}`}>
                      <IconoImprimir />
                    </button>
                    <button type="button" onClick={() => eliminar(d)} className="w-7 h-8 flex items-center justify-center rounded-md text-[var(--gray-400)] hover:text-[var(--red)] hover:bg-white" title="Eliminar" aria-label={`Eliminar ${d.nombre}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {/* Agregar / editar documento */}
      {edicion && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[820px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)]">
              <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{edicion.id ? "Editar documento" : "Agregar documento"}</h3>
              <p className="text-[12.5px] text-[var(--gray-500)] m-0">PDF, imagen o Word. Se analiza el documento y se proponen los datos importantes para editarlos (nombre, fecha automática, etc.).</p>
            </div>
            <div className="p-6 grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nombre del Documento</label>
                  <input type="text" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} className={inputCls} placeholder="Ej. Contrato individual de trabajo" />
                </div>
                <div>
                  <label className={labelCls}>Adjuntar documento</label>
                  <label className="flex items-center gap-2 border border-dashed border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px] text-[var(--navy)] cursor-pointer hover:border-[var(--blue)]">
                    <input type="file" accept={ACEPTA} className="hidden" onChange={(e) => adjuntar(e.target.files?.[0])} />
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.4 11.1l-9.2 9.2a6 6 0 01-8.5-8.5l9.2-9.2a4 4 0 015.7 5.7l-9.2 9.2a2 2 0 01-2.8-2.8l8.5-8.5" /></svg>
                    <span className="truncate">{analizando ? "Analizando…" : edicion.archivo_nombre || "Seleccionar archivo (máx. 3 MB)"}</span>
                  </label>
                  {edicion.id && !edicion.archivo && <p className="text-[11px] text-[var(--gray-400)] m-0 mt-0.5">Deja vacío para conservar el archivo actual.</p>}
                </div>
              </div>
              <div className="border border-[var(--gray-200)] rounded-lg p-3">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="m-0 text-[13px] font-medium text-[var(--navy)]">Campos del documento</p>
                    <p className="m-0 text-[11.5px] text-[var(--gray-500)]">
                      En Word se reemplazan los marcadores {"{{Campo}}"}, «Campo», [CAMPO] o renglones “Etiqueta: ______”. En PDF se llenan los campos de formulario.
                    </p>
                  </div>
                  <button type="button" className="btn btn-secundario py-1 text-[12.5px]" onClick={() => setEdicion({ ...edicion, campos: [...edicion.campos, { clave: `p${Date.now()}`, etiqueta: "", marcador: "", valor: "", tipo: "texto" }] })}>
                    + Agregar campo
                  </button>
                </div>
                {edicion.campos.length === 0 ? (
                  <p className="m-0 text-[12px] text-[var(--gray-400)]">Adjunta el documento para detectar sus campos, o agrega campos personalizados.</p>
                ) : (
                  pasoCampos(edicion.campos, setCampo, true)
                )}
                {edicion.campos.some((c) => !c.marcador && c.tipo !== "fecha_auto") && edicion.mime === MIME_WORD && (
                  <p className="m-0 mt-2 text-[11.5px] text-[var(--gray-500)]">Para que un campo personalizado aparezca en el Word, escribe en el documento el marcador {"{{Nombre del campo}}"}.</p>
                )}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-secundario" onClick={() => setEdicion(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado || analizando} onClick={guardar}>{ocupado ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Crear / editar grupo */}
      {grupo && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-12 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[520px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-4">{grupo.id ? "Editar grupo" : "Crear grupo de documentos"}</h3>
            <label className={labelCls}>Nombre del grupo</label>
            <input type="text" value={grupo.nombre} onChange={(e) => setGrupo({ ...grupo, nombre: e.target.value })} className={inputCls} placeholder="Ej. Alta de operador" />
            <p className={`${labelCls} mt-4`}>Documentos del grupo (se imprimen en este orden)</p>
            <div className="border border-[var(--gray-200)] rounded-lg max-h-[300px] overflow-y-auto divide-y divide-[var(--gray-100)]">
              {docs.map((d) => {
                const pos = grupo.ids.indexOf(d.id);
                return (
                  <label key={d.id} className="flex items-center gap-2.5 px-3 py-2 text-[13px] cursor-pointer hover:bg-[var(--gray-50)]">
                    <input type="checkbox" checked={pos >= 0} onChange={(e) => setGrupo({ ...grupo, ids: e.target.checked ? [...grupo.ids, d.id] : grupo.ids.filter((x) => x !== d.id) })} className="w-4 h-4 accent-[var(--navy)]" />
                    <span className="flex-1 text-[var(--navy)]">{d.nombre}</span>
                    {pos >= 0 && <span className="text-[11px] text-[var(--blue)] font-medium">#{pos + 1}</span>}
                    <span className="text-[11px] text-[var(--gray-400)]">{tipoArchivo(d.mime)}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              {grupo.id && <button type="button" className="mr-auto text-[12.5px] text-[var(--red)] hover:underline" onClick={() => eliminarGrupo(grupos.find((g) => g.id === grupo.id)!)}>Eliminar grupo</button>}
              <button type="button" className="btn btn-secundario" onClick={() => setGrupo(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado || !grupo.nombre.trim() || !grupo.ids.length} onClick={guardarGrupo}>Guardar grupo</button>
            </div>
          </div>
        </div>
      )}

      {/* Impresión: datos necesarios → vista previa → imprimir */}
      {imp && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-6 overflow-y-auto z-50 px-4">
          <div className={`bg-white rounded-lg w-full shadow-xl ${imp.paso === "vista" ? "max-w-[980px]" : "max-w-[640px]"}`}>
            <div className="px-6 py-4 border-b border-[var(--gray-200)]">
              <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{imp.titulo}</h3>
              <p className="text-[12.5px] text-[var(--gray-500)] m-0">
                {imp.paso === "datos" ? `Paso 1 de 2 · Captura los datos para ${imp.ids.length} documento(s).` : "Paso 2 de 2 · Revisa la vista previa e imprime."}
              </p>
            </div>
            <div className="p-6">
              {imp.paso === "datos" ? (
                imp.campos.length ? (
                  pasoCampos(imp.campos, (i, c) => setImp({ ...imp, campos: imp.campos.map((x, j) => (j === i ? { ...x, ...c } : x)) }), false)
                ) : (
                  <p className="text-[13px] text-[var(--gray-500)] m-0">Estos documentos no tienen datos que capturar.</p>
                )
              ) : (
                <iframe ref={marco} title="Vista previa" srcDoc={imp.html} className="w-full h-[68vh] border border-[var(--gray-200)] rounded-md bg-[#eef0f4]" />
              )}
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              <button type="button" className="btn btn-secundario" onClick={() => setImp(null)}>Cancelar</button>
              {imp.paso === "vista" && <button type="button" className="btn btn-secundario" onClick={() => setImp({ ...imp, paso: "datos" })}>Volver a los datos</button>}
              {imp.paso === "datos" ? (
                <button type="button" className="btn btn-primario" disabled={ocupado} onClick={verPrevia}>{ocupado ? "Preparando…" : "Vista previa"}</button>
              ) : (
                <button type="button" className="btn btn-primario" onClick={imprimir}><IconoImprimir c="#fff" /> Imprimir todo</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
