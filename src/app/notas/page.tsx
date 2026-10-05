"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { compressImage } from "@/lib/imageUtils";

type Adjunto = { id?: number; nombre: string; mime: string; leyenda: string | null; contenido?: string; nuevo?: boolean; borrar?: boolean };
type Nota = { id: number; titulo: string; contenido: string; importante: boolean; vence_en: string | null; terminada: boolean; updated_at: string; adjuntos: Adjunto[]; propia: boolean; autor: string; compartida_con: { id: number; nombre: string }[] };
type Borrador = { id?: number; contenido: string; importante: boolean; vence_en: string; terminada: boolean; adjuntos: Adjunto[]; propia: boolean; compartir: number[] };
type UsuarioNota = { id: number; nombre: string };

const ACEPTA = "image/*,.pdf,.doc,.docx,.xls,.xlsx";
const MAX_ARCHIVO = 4_400_000;
const vencida = (n: { vence_en: string | null; terminada: boolean }) => !n.terminada && !!n.vence_en && new Date(n.vence_en) <= new Date();
const aLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fh = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

// Convierte en enlaces las URL escritas o pegadas como texto.
function enlazar(raiz: HTMLElement) {
  const walker = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const nodos: Text[] = [];
  while (walker.nextNode()) {
    const t = walker.currentNode as Text;
    if (!t.parentElement?.closest("a") && /https?:\/\/\S+/.test(t.data)) nodos.push(t);
  }
  for (const t of nodos) {
    const frag = document.createDocumentFragment();
    let ultimo = 0;
    t.data.replace(/https?:\/\/[^\s<]+/g, (url, i: number) => {
      frag.append(t.data.slice(ultimo, i));
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = url;
      frag.append(a);
      ultimo = i + url.length;
      return url;
    });
    frag.append(t.data.slice(ultimo));
    t.replaceWith(frag);
  }
}

function leerArchivo(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(f);
  });
}

function VistaAdjunto({ a }: { a: Adjunto }) {
  const [src, setSrc] = useState<string | null>(a.contenido || null);
  useEffect(() => {
    if (!src && a.id && a.mime.startsWith("image/")) fetch(`/api/notas/adjuntos?id=${a.id}`).then((r) => r.json()).then((d) => setSrc(d.contenido)).catch(() => {});
  }, [a.id, a.mime, src]);
  const abrir = async () => {
    let data = src;
    if (!data && a.id) data = (await fetch(`/api/notas/adjuntos?id=${a.id}`).then((r) => r.json())).contenido;
    if (!data) return;
    const bin = atob(data.slice(data.indexOf(",") + 1));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    window.open(URL.createObjectURL(new Blob([bytes], { type: a.mime })), "_blank");
  };
  if (a.mime.startsWith("image/"))
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={a.nombre} onClick={abrir} className="max-h-[220px] max-w-full mx-auto rounded-lg cursor-zoom-in" />
    ) : (
      <div className="h-[120px] bg-[var(--gray-100)] rounded-lg" />
    );
  return (
    <button type="button" onClick={abrir} className="mx-auto flex items-center gap-2 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] text-[var(--navy)] bg-white">
      📄 {a.nombre}
    </button>
  );
}

export default function NotasPage() {
  const [notas, setNotas] = useState<Nota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [verReloj, setVerReloj] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioNota[]>([]);
  const editor = useRef<HTMLDivElement>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const inputCamara = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/notas", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudieron cargar las notas.");
      setNotas(d.notas || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
    fetch("/api/notas/compartir", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUsuarios(d.usuarios || []))
      .catch(() => {});
  }, [cargar]);

  const abrir = (n?: Nota) => {
    setVerReloj(false);
    setBorrador(n ? { id: n.id, contenido: n.contenido, importante: n.importante, vence_en: aLocal(n.vence_en), terminada: n.terminada, adjuntos: n.adjuntos.map((a) => ({ ...a })), propia: n.propia, compartir: n.compartida_con.map((u) => u.id) } : { contenido: "", importante: false, vence_en: "", terminada: false, adjuntos: [], propia: true, compartir: [] });
    setTimeout(() => {
      if (editor.current) {
        editor.current.innerHTML = n?.contenido || "";
        editor.current.focus();
      }
    }, 0);
  };

  // "B": el texto seleccionado toma el formato de subtítulo.
  const subtitulo = () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return alert("Selecciona el texto al que quieres dar formato de subtítulo.");
    const r = sel.getRangeAt(0);
    if (!editor.current?.contains(r.commonAncestorContainer)) return;
    const span = document.createElement("span");
    span.className = "nota-sub";
    span.appendChild(r.extractContents());
    r.insertNode(span);
    sel.removeAllRanges();
  };

  const insertarCheck = () => {
    editor.current?.focus();
    document.execCommand("insertHTML", false, `<div class="nota-check"><input type="checkbox" />&nbsp;Pendiente</div>`);
  };

  const adjuntar = async (files: FileList | null) => {
    if (!files) return;
    const nuevos: Adjunto[] = [];
    for (const f of Array.from(files)) {
      try {
        const contenido = f.type.startsWith("image/") ? await compressImage(f, 1400, 0.72, 3_500_000) : await leerArchivo(f);
        if (contenido.length > MAX_ARCHIVO * 1.37) {
          alert(`"${f.name}" es demasiado grande (máx. ~4 MB).`);
          continue;
        }
        nuevos.push({ nombre: f.name, mime: f.type.startsWith("image/") ? "image/jpeg" : f.type, leyenda: "", contenido, nuevo: true });
      } catch {
        alert(`No se pudo leer "${f.name}".`);
      }
    }
    setBorrador((b) => (b ? { ...b, adjuntos: [...b.adjuntos, ...nuevos] } : b));
  };

  const guardar = async () => {
    if (!borrador || !editor.current) return;
    enlazar(editor.current);
    // Las casillas se guardan con su estado actual.
    editor.current.querySelectorAll<HTMLInputElement>("input[type=checkbox]").forEach((c) => (c.checked ? c.setAttribute("checked", "") : c.removeAttribute("checked")));
    const contenido = editor.current.innerHTML;
    const titulo = (editor.current.innerText.split("\n").find((l) => l.trim()) || "Sin título").trim();
    setGuardando(true);
    try {
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: borrador.id, titulo, contenido, importante: borrador.importante, vence_en: borrador.vence_en ? new Date(borrador.vence_en).toISOString() : null, terminada: borrador.terminada }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
      if (borrador.propia && (borrador.id || borrador.compartir.length)) {
        const rc = await fetch("/api/notas/compartir", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota_id: d.id, usuarios: borrador.compartir }) });
        if (!rc.ok) alert((await rc.json()).error || "No se pudo compartir la nota.");
      }
      for (const a of borrador.adjuntos) {
        if (a.borrar && a.id) await fetch(`/api/notas/adjuntos?id=${a.id}`, { method: "DELETE" });
        else if (a.nuevo && !a.borrar) {
          const r = await fetch("/api/notas/adjuntos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota_id: d.id, nombre: a.nombre, contenido: a.contenido, leyenda: a.leyenda }) });
          if (!r.ok) alert((await r.json()).error || `No se pudo adjuntar ${a.nombre}.`);
        } else if (a.id) await fetch("/api/notas/adjuntos", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: a.id, leyenda: a.leyenda }) });
      }
      setBorrador(null);
      window.dispatchEvent(new Event("notas-cambiaron"));
      cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const terminar = async (n: Nota, terminada: boolean) => {
    await fetch("/api/notas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...n, terminada }) });
    window.dispatchEvent(new Event("notas-cambiaron"));
    cargar();
  };
  const eliminar = async (n: Nota) => {
    if (!confirm(`¿Eliminar la nota "${n.titulo}" y sus archivos?`)) return;
    await fetch(`/api/notas?id=${n.id}`, { method: "DELETE" });
    window.dispatchEvent(new Event("notas-cambiaron"));
    cargar();
  };

  const icono = "w-9 h-9 flex items-center justify-center rounded-lg border border-[var(--gray-200)] bg-white hover:bg-[var(--gray-100)] text-[var(--navy)]";

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <style>{`
        .nota-editor::first-line, .nota-cuerpo::first-line { font-weight: 700; font-size: 16px; color: var(--navy); }
        .nota-sub { font-weight: 700; font-size: 15px; color: var(--navy); }
        .nota-editor a, .nota-cuerpo a { color: var(--blue); text-decoration: underline; cursor: pointer; }
        .nota-check { display: flex; align-items: center; gap: 4px; }
        .nota-check input { width: 15px; height: 15px; }
      `}</style>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-10">
        <PageHeader titulo="Notas" subtitulo="Tus notas con recordatorios y archivos. Puedes compartirlas con otro usuario para editarlas juntos." backHref="/" backLabel="Menú principal" />
        <button type="button" onClick={() => abrir()} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold mb-5">+ Agregar nota</button>
        {error && <p className="text-[13px] text-[var(--red)]">{error}</p>}
        {cargando ? (
          <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>
        ) : notas.length === 0 ? (
          <p className="text-[13px] text-[var(--gray-400)]">Aún no tienes notas.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {notas.map((n) => (
              <div key={n.id} className={`bg-white rounded-xl border p-4 flex flex-col gap-2 ${vencida(n) ? "border-[var(--red)]" : "border-[var(--gray-200)]"} ${n.terminada ? "opacity-60" : ""}`}>
                <button type="button" onClick={() => abrir(n)} className={`text-left text-[15px] font-bold m-0 ${n.importante ? "bg-[#fff3c4] text-[#b42318] px-1.5 rounded" : "text-[var(--navy)]"} ${n.terminada ? "line-through" : ""}`}>
                  {n.importante && "★ "}
                  {n.titulo}
                </button>
                {n.vence_en && <span className={`text-[11.5px] font-bold ${vencida(n) ? "text-[var(--red)]" : "text-[var(--gray-500)]"}`}>⏰ {vencida(n) ? "Venció" : "Vence"} {fh(n.vence_en)}</span>}
                {!n.propia ? (
                  <span className="text-[11.5px] font-bold text-[var(--blue)]">👥 Compartida por {n.autor}</span>
                ) : n.compartida_con.length > 0 ? (
                  <span className="text-[11.5px] font-bold text-[var(--blue)]">👥 Compartida con {n.compartida_con.map((u) => u.nombre).join(", ")}</span>
                ) : null}
                <span className="text-[11px] text-[var(--gray-400)]">Editada {fh(n.updated_at)} · {n.adjuntos.length} archivo(s)</span>
                <div className="flex gap-3 mt-auto pt-2 text-[12px] font-bold">
                  <button type="button" className="text-[var(--green)]" onClick={() => terminar(n, !n.terminada)}>{n.terminada ? "Reabrir" : "Marcar terminada"}</button>
                  <button type="button" className="text-[var(--blue)]" onClick={() => abrir(n)}>Abrir</button>
                  {n.propia && <button type="button" className="text-[var(--red)] ml-auto" onClick={() => eliminar(n)}>Eliminar</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {borrador && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center p-3 z-50" onClick={() => !guardando && setBorrador(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[820px] max-h-[92vh] overflow-y-auto p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <button type="button" title="Subtítulo (texto seleccionado)" onMouseDown={(e) => e.preventDefault()} onClick={subtitulo} className={`${icono} font-black`}>B</button>
              <button type="button" title="Agregar casilla" onMouseDown={(e) => e.preventDefault()} onClick={insertarCheck} className={icono}>☑</button>
              <button type="button" title="Fecha y hora de vencimiento" onClick={() => setVerReloj((v) => !v)} className={`${icono} ${borrador.vence_en ? "!border-[var(--blue)] !text-[var(--blue)]" : ""}`}>⏰</button>
              <button type="button" title="Importante" onClick={() => setBorrador({ ...borrador, importante: !borrador.importante })} className={`${icono} ${borrador.importante ? "!bg-[#fff3c4] !border-[#f5c518] !text-[#b42318]" : ""}`}>★</button>
              <button type="button" title="Adjuntar imágenes o archivos (PDF, Word, Excel)" onClick={() => inputArchivo.current?.click()} className={icono}>📎</button>
              <button type="button" title="Tomar foto" onClick={() => inputCamara.current?.click()} className={icono}>📷</button>
              <input ref={inputArchivo} type="file" accept={ACEPTA} multiple className="hidden" onChange={(e) => { adjuntar(e.target.files); e.target.value = ""; }} />
              <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { adjuntar(e.target.files); e.target.value = ""; }} />
              {verReloj && (
                <span className="flex items-center gap-2">
                  <input type="datetime-local" value={borrador.vence_en} onChange={(e) => setBorrador({ ...borrador, vence_en: e.target.value })} className="border border-[var(--gray-300)] rounded-md px-2 py-1.5 text-[12.5px]" />
                  {borrador.vence_en && <button type="button" className="text-[12px] text-[var(--red)]" onClick={() => setBorrador({ ...borrador, vence_en: "" })}>Quitar</button>}
                </span>
              )}
              <span onClick={() => !guardando && setBorrador(null)} className="ml-auto text-[var(--gray-400)] cursor-pointer text-xl leading-none">✕</span>
            </div>
            <div
              ref={editor}
              contentEditable
              suppressContentEditableWarning
              onBlur={() => editor.current && enlazar(editor.current)}
              onClick={(e) => {
                const a = (e.target as HTMLElement).closest("a");
                if (a) window.open(a.getAttribute("href") || "", "_blank", "noopener");
              }}
              data-placeholder="Escribe aquí. La primera línea será el título."
              className="nota-editor min-h-[240px] border border-[var(--gray-200)] rounded-xl p-4 text-[13.5px] leading-relaxed focus:outline-none focus:border-[var(--blue)]"
            />
            {borrador.propia ? (
              <div className="mt-4 border border-[var(--gray-200)] rounded-xl p-3">
                <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 mb-2">👥 Compartir con otro usuario (ambos podrán editar la nota)</p>
                {usuarios.length === 0 ? (
                  <p className="text-[12px] text-[var(--gray-400)] m-0">No hay otros usuarios con acceso a Notas.</p>
                ) : (
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                    {usuarios.map((u) => (
                      <label key={u.id} className="flex items-center gap-1.5 text-[12.5px] cursor-pointer">
                        <input type="checkbox" checked={borrador.compartir.includes(u.id)} onChange={(e) => setBorrador({ ...borrador, compartir: e.target.checked ? [...borrador.compartir, u.id] : borrador.compartir.filter((x) => x !== u.id) })} />
                        {u.nombre}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-[12px] text-[var(--blue)] font-bold">👥 Nota compartida contigo — puedes editarla.</p>
            )}
            {borrador.adjuntos.filter((a) => !a.borrar).length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                {borrador.adjuntos.map((a, i) =>
                  a.borrar ? null : (
                    <div key={i} className="border border-[var(--gray-200)] rounded-xl p-3 flex flex-col gap-2">
                      <VistaAdjunto a={a} />
                      <input value={a.leyenda || ""} onChange={(e) => setBorrador({ ...borrador, adjuntos: borrador.adjuntos.map((x, k) => (k === i ? { ...x, leyenda: e.target.value } : x)) })} placeholder="Texto de referencia" className="text-center border-0 border-b border-[var(--gray-200)] text-[12.5px] py-1 focus:outline-none" />
                      <button type="button" className="text-[11.5px] text-[var(--red)] self-end" onClick={() => setBorrador({ ...borrador, adjuntos: borrador.adjuntos.map((x, k) => (k === i ? { ...x, borrar: true } : x)) })}>Quitar</button>
                    </div>
                  )
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="btn btn-secundario py-1.5" disabled={guardando} onClick={() => setBorrador(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario py-1.5" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar nota"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
