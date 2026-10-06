"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { compressImage } from "@/lib/imageUtils";
import { useSesion } from "@/lib/useSesion";
import { puedeVerSeccion } from "@/lib/permisos";
import { moneda } from "@/lib/comprasData";

type Adjunto = { id?: number; nombre: string; mime: string; leyenda: string | null; contenido?: string; nuevo?: boolean; borrar?: boolean };
type Nota = { id: number; titulo: string; contenido: string; importante: boolean; vence_en: string | null; terminada: boolean; updated_at: string; adjuntos: Adjunto[]; propia: boolean; autor: string; compartida_con: { id: number; nombre: string }[]; monto_oc: number; num_oc: number; editado_por: string | null; carpeta_id: number | null };
type Carpeta = { id: number; nombre: string };
type Borrador = { id?: number; contenido: string; importante: boolean; vence_en: string; terminada: boolean; adjuntos: Adjunto[]; propia: boolean; compartir: number[]; base: string };
type UsuarioNota = { id: number; nombre: string };

const ACEPTA = "image/*,.pdf,.doc,.docx,.xls,.xlsx";
const MAX_ARCHIVO = 4_400_000;
const vencida = (n: { vence_en: string | null; terminada: boolean }) => !n.terminada && !!n.vence_en && new Date(n.vence_en) <= new Date();
const aLocal = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const fh = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

// Iconos de línea con un solo formato (mismo trazo, tamaño y color heredado).
function Ic({ children, size = 18 }: { children: React.ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}
const ICONOS = {
  campana: <><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></>,
  subtitulo: <path d="M6 4v16M18 4v16M6 12h12" />,
  casilla: <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></>,
  reloj: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  clip: <path d="M21 11.5l-8.6 8.6a5 5 0 01-7-7l8.6-8.6a3.4 3.4 0 014.8 4.8l-8.6 8.6a1.7 1.7 0 01-2.4-2.4l7.9-7.9" />,
  camara: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></>,
  persona: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></>,
  carpeta: <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  carpetaMas: <><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M12 10.5v5M9.5 13h5" /></>,
  palomita: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  carrito: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h3l2.6 12.4a1 1 0 00.8.6h9.2a1 1 0 001-.8L21 7H6" /></>,
  agrandar: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  reducir: <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />,
  cerrar: <path d="M6 6l12 12M18 6L6 18" />,
  detener: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />,
};

// Globo de prioridad: campana con el signo de admiración, igual a la de notificaciones.
function GloboPrioridad({ size = 22 }: { size?: number }) {
  return (
    <span className="relative inline-flex text-[#4b5563]" title="Prioridad">
      <Ic size={size}>{ICONOS.campana}</Ic>
      <span className="absolute -top-1 -right-1.5 min-w-[15px] h-[15px] rounded-full bg-[var(--red)] text-white text-[10px] font-bold leading-[15px] text-center shadow-[0_0_0_2px_#fff]">!</span>
    </span>
  );
}

// Avance del checklist de una nota guardada (casillas marcadas / casillas totales).
function progresoChecks(html: string) {
  const tags = html.match(/<input[^>]*type=["']?checkbox["']?[^>]*>/gi) || [];
  const hechas = tags.filter((t) => /\schecked(\s|=|>|\/|$)/i.test(t)).length;
  return { total: tags.length, hechas, pct: tags.length ? Math.round((hechas * 100) / tags.length) : 0 };
}
const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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
    if (!src && a.id && (a.mime.startsWith("image/") || a.mime.startsWith("audio/"))) fetch(`/api/notas/adjuntos?id=${a.id}`).then((r) => r.json()).then((d) => setSrc(d.contenido)).catch(() => {});
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
  if (a.mime.startsWith("audio/"))
    return src ? <audio controls src={src} className="w-full" /> : <div className="h-[40px] bg-[var(--gray-100)] rounded-lg" />;
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
  const sesion = useSesion();
  const puedeComprar = !sesion.cargando && puedeVerSeccion("compras", sesion.rol, sesion.secciones);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [verReloj, setVerReloj] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioNota[]>([]);
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [filtro, setFiltro] = useState<"todas" | "sin" | number>("todas");
  const [nuevaCarpeta, setNuevaCarpeta] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const [sobreCarpeta, setSobreCarpeta] = useState<string | null>(null);
  const versionRef = useRef("");
  const cargandoRef = useRef(false);
  const arrastrandoRef = useRef<number | null>(null);
  const [verCompartir, setVerCompartir] = useState(false);
  const [grande, setGrande] = useState(false);
  const [prog, setProg] = useState({ total: 0, hechas: 0 });
  const [grabando, setGrabando] = useState(false);
  const [seg, setSeg] = useState(0);
  const [parcial, setParcial] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const inputArchivo = useRef<HTMLInputElement>(null);
  const inputCamara = useRef<HTMLInputElement>(null);
  // Grabación de voz (audio adjunto + transcripción con el reconocimiento de voz del navegador)
  const grab = useRef<{ mr: MediaRecorder | null; stream: MediaStream | null; rec: any; chunks: Blob[]; texto: string; activa: boolean; descartar: boolean; timer: number | null; ini: number }>({ mr: null, stream: null, rec: null, chunks: [], texto: "", activa: false, descartar: false, timer: null, ini: 0 });

  const cargar = useCallback(async () => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    try {
      const res = await fetch("/api/notas", { cache: "no-store" });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudieron cargar las notas.");
      versionRef.current = d.version || "";
      setNotas(d.notas || []);
      setCarpetas(d.carpetas || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      cargandoRef.current = false;
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

  // Actualización automática: la huella de cambios llega cada pocos segundos (NotasEnVivo); si cambió, se recarga sola.
  useEffect(() => {
    const alCambiar = (e: Event) => {
      const v = (e as CustomEvent<string>).detail;
      if (v && v !== versionRef.current && arrastrandoRef.current === null) cargar();
    };
    window.addEventListener("notas-version", alCambiar);
    window.addEventListener("focus", cargar);
    return () => {
      window.removeEventListener("notas-version", alCambiar);
      window.removeEventListener("focus", cargar);
    };
  }, [cargar]);

  // Si la carpeta seleccionada ya no existe, se vuelve a "Todas".
  useEffect(() => {
    if (typeof filtro === "number" && !carpetas.some((c) => c.id === filtro)) setFiltro("todas");
  }, [carpetas, filtro]);

  const abrir = (n?: Nota) => {
    setVerReloj(false);
    setVerCompartir(false);
    setProg(n ? { total: progresoChecks(n.contenido).total, hechas: progresoChecks(n.contenido).hechas } : { total: 0, hechas: 0 });
    setBorrador(n ? { id: n.id, contenido: n.contenido, importante: n.importante, vence_en: aLocal(n.vence_en), terminada: n.terminada, adjuntos: n.adjuntos.map((a) => ({ ...a })), propia: n.propia, compartir: n.compartida_con.map((u) => u.id), base: n.updated_at } : { contenido: "", importante: false, vence_en: "", terminada: false, adjuntos: [], propia: true, compartir: [], base: "" });
    setTimeout(() => {
      if (editor.current) {
        editor.current.innerHTML = n?.contenido || "";
        editor.current.focus();
      }
    }, 0);
  };

  const cerrar = () => {
    if (grab.current.activa) detenerGrabacion(true);
    setBorrador(null);
    setGrande(false);
    setVerCompartir(false);
  };

  // Avance del checklist en el editor; al marcar todas, la nota queda terminada.
  const actualizarProgreso = () => {
    if (!editor.current) return;
    const cs = Array.from(editor.current.querySelectorAll<HTMLInputElement>("input[type=checkbox]"));
    const hechas = cs.filter((c) => c.checked).length;
    setProg({ total: cs.length, hechas });
    if (cs.length > 0 && hechas === cs.length) setBorrador((b) => (b && !b.terminada ? { ...b, terminada: true } : b));
  };

  // "Aa": el texto seleccionado toma el formato de subtítulo.
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
    actualizarProgreso();
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

  // ---- Grabación de voz ----
  const iniciarGrabacion = async () => {
    const g = grab.current;
    if (g.activa) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return alert("Tu navegador no permite grabar audio.");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const tipo = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, tipo ? { mimeType: tipo, audioBitsPerSecond: 24000 } : { audioBitsPerSecond: 24000 });
      g.mr = mr;
      g.stream = stream;
      g.chunks = [];
      g.texto = "";
      g.descartar = false;
      g.activa = true;
      g.ini = Date.now();
      mr.ondataavailable = (e) => e.data.size && g.chunks.push(e.data);
      mr.onstop = () => finalizarGrabacion(mr.mimeType || tipo || "audio/webm");
      mr.start(1000);
      // Transcripción en vivo (si el navegador la ofrece)
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const rec = new SR();
        rec.lang = "es-MX";
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e: any) => {
          let interino = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) g.texto += (g.texto ? " " : "") + t.trim();
            else interino += t;
          }
          setParcial(interino);
        };
        rec.onend = () => {
          if (g.activa) {
            try { rec.start(); } catch { /* ya iniciado */ }
          }
        };
        rec.onerror = () => {};
        try { rec.start(); } catch { /* sin transcripción */ }
        g.rec = rec;
      } else g.rec = null;
      setSeg(0);
      setParcial("");
      setGrabando(true);
      g.timer = window.setInterval(() => {
        const s = Math.floor((Date.now() - g.ini) / 1000);
        setSeg(s);
        if (s >= 600) detenerGrabacion(false); // máx. 10 min por grabación
      }, 500);
    } catch {
      alert("No se pudo acceder al micrófono. Revisa el permiso del navegador.");
    }
  };

  const detenerGrabacion = (descartar: boolean) => {
    const g = grab.current;
    if (!g.activa) return;
    g.descartar = descartar;
    g.activa = false;
    if (g.timer) window.clearInterval(g.timer);
    try { g.rec?.stop(); } catch { /* */ }
    try { g.mr?.stop(); } catch { /* */ }
    g.stream?.getTracks().forEach((t) => t.stop());
    setGrabando(false);
    setParcial("");
  };

  const finalizarGrabacion = async (mimeCompleto: string) => {
    const g = grab.current;
    if (g.descartar || !g.chunks.length) return;
    const mime = mimeCompleto.split(";")[0] || "audio/webm";
    const blob = new Blob(g.chunks, { type: mime });
    // El reconocimiento de voz puede entregar su último resultado un instante después de detenerse.
    await new Promise((r) => setTimeout(r, 900));
    try {
      const contenido = await leerArchivo(new File([blob], "voz", { type: mime }));
      if (contenido.length > MAX_ARCHIVO * 1.37) return alert("La grabación es demasiado grande (máx. ~4 MB).");
      const ahora = new Date();
      const nombre = `Nota de voz ${ahora.toLocaleDateString("es-MX", { day: "2-digit", month: "short" })} ${ahora.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}.${mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm"}`;
      setBorrador((b) => (b ? { ...b, adjuntos: [...b.adjuntos, { nombre, mime, leyenda: "Nota de voz", contenido, nuevo: true }] } : b));
      // Transcripción dentro de la nota (si el editor está vacío, se crea el título)
      const ed = editor.current;
      if (ed) {
        const vacio = !ed.innerText.trim();
        const titulo = vacio ? `<div>Nota de voz · ${esc(ahora.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }))}</div>` : "";
        if (g.texto.trim()) ed.insertAdjacentHTML("beforeend", `${titulo}<div>${esc(g.texto.trim())}</div>`);
        else {
          if (titulo) ed.insertAdjacentHTML("beforeend", titulo);
          alert(g.rec === null ? "Se adjuntó el audio, pero este navegador no transcribe voz. Usa Chrome o Edge para la transcripción." : "Se adjuntó el audio, pero no se detectó voz para transcribir.");
        }
      }
    } catch {
      alert("No se pudo procesar la grabación.");
    }
  };

  const abrirConVoz = () => {
    abrir();
    setTimeout(iniciarGrabacion, 200);
  };

  const guardar = async (): Promise<number | null> => {
    if (!borrador || !editor.current) return null;
    if (grab.current.activa) detenerGrabacion(false);
    enlazar(editor.current);
    // Las casillas se guardan con su estado actual.
    const cs = Array.from(editor.current.querySelectorAll<HTMLInputElement>("input[type=checkbox]"));
    cs.forEach((c) => (c.checked ? c.setAttribute("checked", "") : c.removeAttribute("checked")));
    const todasMarcadas = cs.length > 0 && cs.every((c) => c.checked);
    const contenido = editor.current.innerHTML;
    const titulo = (editor.current.innerText.split("\n").find((l) => l.trim()) || "Sin título").trim();
    setGuardando(true);
    try {
      const res = await fetch("/api/notas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: borrador.id, titulo, contenido, importante: borrador.importante, vence_en: borrador.vence_en ? new Date(borrador.vence_en).toISOString() : null, terminada: borrador.terminada || todasMarcadas }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "No se pudo guardar.");
      if (!borrador.id && typeof filtro === "number") await fetch("/api/notas/organizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota_id: d.id, carpeta_id: filtro }) });
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
      setGrande(false);
      window.dispatchEvent(new Event("notas-cambiaron"));
      cargar();
      return d.id as number;
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
      return null;
    } finally {
      setGuardando(false);
    }
  };

  // Carrito: guarda la nota y abre la captura de una nueva orden de compra vinculada a ella.
  const nuevaOrdenCompra = async () => {
    const w = window.open("about:blank", "_blank");
    const id = await guardar();
    if (!id) return w?.close();
    const url = `/compras?nota=${id}`;
    if (w) w.location.href = url;
    else window.open(url, "_blank");
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

  // Arrastrar y soltar: reordena las notas (el orden queda guardado para cada usuario).
  const mover = async (origen: number, destino: number) => {
    if (origen === destino) return;
    const lista = [...notas];
    const i = lista.findIndex((n) => n.id === origen);
    const j = lista.findIndex((n) => n.id === destino);
    if (i < 0 || j < 0) return;
    const [x] = lista.splice(i, 1);
    lista.splice(j, 0, x);
    setNotas(lista);
    await fetch("/api/notas/organizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden: lista.map((n) => n.id) }) }).catch(() => {});
    cargar();
  };
  const asignarCarpeta = async (notaId: number, carpetaId: number | null) => {
    setNotas((ns) => ns.map((n) => (n.id === notaId ? { ...n, carpeta_id: carpetaId } : n)));
    await fetch("/api/notas/organizar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nota_id: notaId, carpeta_id: carpetaId }) }).catch(() => {});
    cargar();
  };
  const crearCarpeta = async () => {
    const nombre = (nuevaCarpeta || "").trim();
    if (!nombre) return setNuevaCarpeta(null);
    const r = await fetch("/api/notas/carpetas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nombre }) });
    const d = await r.json();
    if (!r.ok) return alert(d.error || "No se pudo crear la carpeta.");
    setNuevaCarpeta(null);
    await cargar();
    setFiltro(d.id);
  };
  const renombrarCarpeta = async (c: Carpeta) => {
    const nombre = prompt("Nuevo nombre de la carpeta:", c.nombre);
    if (!nombre || nombre.trim() === c.nombre) return;
    const r = await fetch("/api/notas/carpetas", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, nombre }) });
    if (!r.ok) return alert((await r.json()).error || "No se pudo renombrar.");
    cargar();
  };
  const eliminarCarpeta = async (c: Carpeta) => {
    if (!confirm(`¿Eliminar la carpeta "${c.nombre}"? Las notas NO se borran: regresan a "Sin carpeta".`)) return;
    await fetch(`/api/notas/carpetas?id=${c.id}`, { method: "DELETE" });
    setFiltro("todas");
    cargar();
  };
  // Aviso de edición simultánea: otro usuario guardó esta nota mientras la tengo abierta.
  const notaAbierta = borrador?.id ? notas.find((n) => n.id === borrador.id) : undefined;
  const hayConflicto = !!(notaAbierta && borrador && borrador.base && notaAbierta.updated_at !== borrador.base);
  const cargarVersionNueva = () => {
    if (!notaAbierta || !borrador || !editor.current) return;
    editor.current.innerHTML = notaAbierta.contenido;
    setBorrador({ ...borrador, contenido: notaAbierta.contenido, importante: notaAbierta.importante, terminada: notaAbierta.terminada, vence_en: aLocal(notaAbierta.vence_en), base: notaAbierta.updated_at, adjuntos: [...notaAbierta.adjuntos.map((a) => ({ ...a })), ...borrador.adjuntos.filter((a) => a.nuevo)] });
    actualizarProgreso();
  };

  const visibles = notas.filter((n) => (filtro === "todas" ? true : filtro === "sin" ? !n.carpeta_id : n.carpeta_id === filtro));
  const nombreCarpeta = (id: number | null) => carpetas.find((c) => c.id === id)?.nombre;
  const chip = (activa: boolean, soltando: boolean) => `inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${soltando ? "border-[var(--blue)] bg-[var(--blue-light)] text-[var(--blue)] ring-2 ring-[var(--blue)]" : activa ? "bg-[var(--navy)] border-[var(--navy)] text-white" : "bg-white border-[var(--gray-200)] text-[var(--gray-500)] hover:text-[var(--navy)]"}`;

  const mmss = `${String(Math.floor(seg / 60)).padStart(2, "0")}:${String(seg % 60).padStart(2, "0")}`;
  const btn = "relative w-9 h-9 flex items-center justify-center rounded-lg text-[var(--gray-500)] hover:bg-[var(--gray-100)] hover:text-[var(--navy)] transition-colors";
  const activo = "!bg-[var(--blue-light)] !text-[var(--blue)]";

  // KPI de la pantalla de notas
  const pendientes = notas.filter((n) => !n.terminada);
  const kpis = [
    { etiqueta: "Pendientes por cerrar", valor: String(pendientes.length), color: "text-[var(--navy)]" },
    { etiqueta: "Con prioridad", valor: String(pendientes.filter((n) => n.importante).length), color: "text-[var(--red)]" },
    { etiqueta: "Vencidas", valor: String(notas.filter(vencida).length), color: "text-[var(--red)]" },
    ...(notas.some((n) => n.num_oc > 0) ? [{ etiqueta: "Monto en órdenes de compra", valor: moneda(notas.reduce((a, n) => a + (n.monto_oc || 0), 0)), color: "text-[var(--green)]" }] : []),
  ];

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
        <PageHeader titulo="Notas" subtitulo="Tus notas con recordatorios y archivos. Puedes compartirlas con otros usuarios para editarlas juntos." backHref="/" backLabel="Menú principal" />
        <div className="flex flex-wrap items-stretch gap-3 mb-4">
          {kpis.map((k) => (
            <div key={k.etiqueta} className="bg-white border border-[var(--gray-200)] rounded-xl px-4 py-2.5 min-w-[130px]">
              <div className={`text-[22px] font-bold leading-tight ${k.color}`}>{k.valor}</div>
              <div className="text-[11.5px] text-[var(--gray-500)]">{k.etiqueta}</div>
            </div>
          ))}
          <button type="button" title="Nueva carpeta" aria-label="Nueva carpeta" onClick={() => setNuevaCarpeta(nuevaCarpeta === null ? "" : null)} className={`w-12 flex items-center justify-center rounded-xl border bg-white hover:bg-[var(--gray-100)] ${nuevaCarpeta !== null ? "border-[var(--blue)] text-[var(--blue)]" : "border-[var(--gray-200)] text-[var(--navy)]"}`}>
            <Ic size={22}>{ICONOS.carpetaMas}</Ic>
          </button>
        </div>
        {nuevaCarpeta !== null && (
          <div className="flex items-center gap-2 mb-4">
            <input autoFocus value={nuevaCarpeta} onChange={(e) => setNuevaCarpeta(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") crearCarpeta(); if (e.key === "Escape") setNuevaCarpeta(null); }} placeholder="Nombre de la carpeta" maxLength={60} className="border border-[var(--gray-300)] rounded-lg px-3 py-2 text-[13px] w-[240px]" />
            <button type="button" onClick={crearCarpeta} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">Crear</button>
            <button type="button" onClick={() => setNuevaCarpeta(null)} className="text-[12.5px] text-[var(--gray-500)]">Cancelar</button>
          </div>
        )}
        {/* Filtro por carpeta · también son destino al arrastrar una nota */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <button type="button" onClick={() => setFiltro("todas")} className={chip(filtro === "todas", false)}>
            Todas <span className="font-normal opacity-80">{notas.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setFiltro("sin")}
            onDragOver={(e) => { if (arrastrando !== null) { e.preventDefault(); setSobreCarpeta("sin"); } }}
            onDragLeave={() => setSobreCarpeta(null)}
            onDrop={(e) => { e.preventDefault(); if (arrastrando !== null) asignarCarpeta(arrastrando, null); setSobreCarpeta(null); setArrastrando(null); arrastrandoRef.current = null; }}
            className={chip(filtro === "sin", sobreCarpeta === "sin")}
          >
            Sin carpeta <span className="font-normal opacity-80">{notas.filter((n) => !n.carpeta_id).length}</span>
          </button>
          {carpetas.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFiltro(c.id)}
              onDragOver={(e) => { if (arrastrando !== null) { e.preventDefault(); setSobreCarpeta(String(c.id)); } }}
              onDragLeave={() => setSobreCarpeta(null)}
              onDrop={(e) => { e.preventDefault(); if (arrastrando !== null) asignarCarpeta(arrastrando, c.id); setSobreCarpeta(null); setArrastrando(null); arrastrandoRef.current = null; }}
              className={chip(filtro === c.id, sobreCarpeta === String(c.id))}
            >
              <Ic size={14}>{ICONOS.carpeta}</Ic>
              {c.nombre} <span className="font-normal opacity-80">{notas.filter((n) => n.carpeta_id === c.id).length}</span>
            </button>
          ))}
          {typeof filtro === "number" && (
            <span className="flex items-center gap-3 ml-2 text-[12px] font-bold">
              <button type="button" className="text-[var(--blue)]" onClick={() => renombrarCarpeta(carpetas.find((c) => c.id === filtro)!)}>Renombrar</button>
              <button type="button" className="text-[var(--red)]" onClick={() => eliminarCarpeta(carpetas.find((c) => c.id === filtro)!)}>Eliminar carpeta</button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mb-5">
          <button type="button" onClick={() => abrir()} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">+ Agregar nota</button>
          <button type="button" onClick={abrirConVoz} title="Grabar nota de voz" aria-label="Grabar nota de voz" className="w-10 h-10 flex items-center justify-center rounded-lg border border-[var(--gray-200)] bg-white text-[var(--navy)] hover:bg-[var(--gray-100)]">
            <Ic>{ICONOS.mic}</Ic>
          </button>
          {visibles.length > 1 && <span className="text-[11.5px] text-[var(--gray-400)] ml-2">Arrastra una nota para cambiarla de lugar o soltarla en una carpeta.</span>}
        </div>
        {error && <p className="text-[13px] text-[var(--red)]">{error}</p>}
        {cargando ? (
          <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="text-[13px] text-[var(--gray-400)]">{notas.length === 0 ? "Aún no tienes notas." : "No hay notas en esta carpeta."}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibles.map((n) => {
              const pr = progresoChecks(n.contenido);
              const gris = n.terminada ? "opacity-55 grayscale" : "";
              return (
                <div
                  key={n.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(n.id));
                    arrastrandoRef.current = n.id;
                    setArrastrando(n.id);
                  }}
                  onDragEnd={() => {
                    arrastrandoRef.current = null;
                    setArrastrando(null);
                    setSobre(null);
                    setSobreCarpeta(null);
                  }}
                  onDragOver={(e) => {
                    if (arrastrando !== null && arrastrando !== n.id) {
                      e.preventDefault();
                      setSobre(n.id);
                    }
                  }}
                  onDragLeave={() => setSobre((x) => (x === n.id ? null : x))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const origen = arrastrando;
                    setSobre(null);
                    setArrastrando(null);
                    arrastrandoRef.current = null;
                    if (origen !== null) mover(origen, n.id);
                  }}
                  className={`relative rounded-xl border p-4 flex flex-col gap-2 cursor-grab active:cursor-grabbing transition-shadow ${n.terminada ? "bg-[#f1f2f4]" : "bg-white"} ${vencida(n) ? "border-[var(--red)]" : "border-[var(--gray-200)]"} ${arrastrando === n.id ? "opacity-40" : ""} ${sobre === n.id ? "ring-2 ring-[var(--blue)] shadow-lg" : ""}`}
                >
                  <div className={`flex flex-col gap-2 ${gris}`}>
                    {n.importante && (
                      <span className="absolute top-3 right-4">
                        <GloboPrioridad />
                      </span>
                    )}
                    <button type="button" onClick={() => abrir(n)} className={`text-left text-[15px] font-bold m-0 text-[var(--navy)] ${n.importante ? "pr-9" : ""} ${n.terminada ? "line-through" : ""}`}>
                      {n.titulo}
                    </button>
                    {n.vence_en && <span className={`text-[11.5px] font-bold ${vencida(n) ? "text-[var(--red)]" : "text-[var(--gray-500)]"}`}>⏰ {vencida(n) ? "Venció" : "Vence"} {fh(n.vence_en)}</span>}
                    {pr.total > 0 && (
                      <div>
                        <div className="flex justify-between text-[11.5px] font-bold text-[var(--gray-500)] mb-1">
                          <span>Avance {pr.hechas}/{pr.total}</span>
                          <span className={pr.pct === 100 ? "text-[var(--green)]" : ""}>{pr.pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--gray-100)] overflow-hidden">
                          <div className={`h-full rounded-full ${pr.pct === 100 ? "bg-[var(--green)]" : "bg-[var(--blue)]"}`} style={{ width: `${pr.pct}%` }} />
                        </div>
                      </div>
                    )}
                    {n.num_oc > 0 && (
                      <span className="flex items-center gap-1.5 text-[11.5px] font-bold text-[var(--green)]">
                        <Ic size={14}>{ICONOS.carrito}</Ic> {n.num_oc} orden(es) de compra · {moneda(n.monto_oc)}
                      </span>
                    )}
                    {!n.propia ? (
                      <span className="text-[11.5px] font-bold text-[var(--blue)]">👥 Compartida por {n.autor}</span>
                    ) : n.compartida_con.length > 0 ? (
                      <span className="text-[11.5px] font-bold text-[var(--blue)]">👥 Compartida con {n.compartida_con.map((u) => u.nombre).join(", ")}</span>
                    ) : null}
                    {filtro === "todas" && n.carpeta_id && nombreCarpeta(n.carpeta_id) && (
                      <span className="flex items-center gap-1 text-[11.5px] text-[var(--gray-500)]">
                        <Ic size={13}>{ICONOS.carpeta}</Ic> {nombreCarpeta(n.carpeta_id)}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--gray-400)]">Editada {fh(n.updated_at)}{n.editado_por ? ` por ${n.editado_por}` : ""} · {n.adjuntos.length} archivo(s)</span>
                  </div>
                  <div className="flex items-center gap-3 mt-auto pt-2 text-[12px] font-bold">
                    <button
                      type="button"
                      title={n.terminada ? "Terminada — clic para reabrir" : "Marcar terminada"}
                      aria-label={n.terminada ? "Reabrir nota" : "Marcar nota como terminada"}
                      onClick={() => terminar(n, !n.terminada)}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${n.terminada ? "bg-[var(--green)] text-white shadow-[0_2px_8px_rgba(33,168,102,0.5)]" : "text-[var(--gray-300)] hover:text-[var(--green)]"}`}
                    >
                      <Ic size={n.terminada ? 16 : 20}>{ICONOS.palomita}</Ic>
                    </button>
                    <button type="button" className="text-[var(--blue)]" onClick={() => abrir(n)}>Abrir</button>
                    {n.propia && <button type="button" className="text-[var(--red)] ml-auto" onClick={() => eliminar(n)}>Eliminar</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {borrador && (
        <div className={`fixed inset-0 bg-[rgba(22,33,92,0.5)] flex items-center justify-center z-50 ${grande ? "p-0" : "p-3"}`} onClick={() => !guardando && !grabando && cerrar()}>
          <div className={`bg-white overflow-y-auto flex flex-col ${grande ? "w-screen h-screen rounded-none p-4 sm:p-6" : "rounded-2xl w-full max-w-[820px] max-h-[92vh] p-4 sm:p-5"}`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-0.5 mb-3">
              {/* Izquierda: herramientas de la nota */}
              <button type="button" title="Prioridad" onClick={() => setBorrador({ ...borrador, importante: !borrador.importante })} className={`${btn} ${borrador.importante ? activo : ""}`}>
                {borrador.importante ? <GloboPrioridad size={18} /> : <Ic>{ICONOS.campana}</Ic>}
              </button>
              <button type="button" title="Subtítulo (texto seleccionado)" onMouseDown={(e) => e.preventDefault()} onClick={subtitulo} className={btn}><Ic>{ICONOS.subtitulo}</Ic></button>
              <button type="button" title="Agregar casilla" onMouseDown={(e) => e.preventDefault()} onClick={insertarCheck} className={btn}><Ic>{ICONOS.casilla}</Ic></button>
              <button type="button" title="Fecha y hora de vencimiento" onClick={() => setVerReloj((v) => !v)} className={`${btn} ${borrador.vence_en ? activo : ""}`}><Ic>{ICONOS.reloj}</Ic></button>
              <button type="button" title="Adjuntar imágenes o archivos (PDF, Word, Excel)" onClick={() => inputArchivo.current?.click()} className={btn}><Ic>{ICONOS.clip}</Ic></button>
              <button type="button" title="Tomar foto" onClick={() => inputCamara.current?.click()} className={btn}><Ic>{ICONOS.camara}</Ic></button>
              <button type="button" title={grabando ? "Detener grabación" : "Grabar nota de voz"} onClick={() => (grabando ? detenerGrabacion(false) : iniciarGrabacion())} className={`${btn} ${grabando ? "!bg-[#fdecea] !text-[var(--red)]" : ""}`}><Ic>{grabando ? ICONOS.detener : ICONOS.mic}</Ic></button>
              <input ref={inputArchivo} type="file" accept={ACEPTA} multiple className="hidden" onChange={(e) => { adjuntar(e.target.files); e.target.value = ""; }} />
              <input ref={inputCamara} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { adjuntar(e.target.files); e.target.value = ""; }} />

              {/* Derecha: compartir, orden de compra, ampliar y cerrar */}
              <span className="ml-auto flex items-center gap-0.5">
                {borrador.propia && (
                  <span className="relative">
                    <button type="button" title="Compartir con otros usuarios" onClick={() => setVerCompartir((v) => !v)} className={`${btn} ${borrador.compartir.length ? activo : ""}`}>
                      <Ic>{ICONOS.persona}</Ic>
                      {borrador.compartir.length > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full bg-[var(--blue)] text-white text-[10px] font-bold leading-[15px] text-center">{borrador.compartir.length}</span>}
                    </button>
                    {verCompartir && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setVerCompartir(false)} />
                        <div className="absolute right-0 top-10 z-20 w-[250px] max-h-[260px] overflow-y-auto bg-white border border-[var(--gray-200)] rounded-xl shadow-lg p-3">
                          <p className="text-[12px] font-bold text-[var(--navy)] m-0 mb-2">Compartir con (ambos editan)</p>
                          {usuarios.length === 0 ? (
                            <p className="text-[12px] text-[var(--gray-400)] m-0">No hay otros usuarios con acceso a Notas.</p>
                          ) : (
                            usuarios.map((u) => (
                              <label key={u.id} className="flex items-center gap-2 text-[12.5px] py-1 cursor-pointer">
                                <input type="checkbox" checked={borrador.compartir.includes(u.id)} onChange={(e) => setBorrador({ ...borrador, compartir: e.target.checked ? [...borrador.compartir, u.id] : borrador.compartir.filter((x) => x !== u.id) })} />
                                {u.nombre}
                              </label>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </span>
                )}
                {puedeComprar && (
                  <button type="button" title="Nueva orden de compra (guarda la nota y la vincula)" disabled={guardando} onClick={nuevaOrdenCompra} className={btn}><Ic>{ICONOS.carrito}</Ic></button>
                )}
                <span className="w-px h-5 bg-[var(--gray-200)] mx-1" />
                <button type="button" title={grande ? "Reducir" : "Pantalla completa"} onClick={() => setGrande((g) => !g)} className={btn}><Ic>{grande ? ICONOS.reducir : ICONOS.agrandar}</Ic></button>
                <button type="button" title="Cerrar" onClick={() => !guardando && cerrar()} className={btn}><Ic>{ICONOS.cerrar}</Ic></button>
              </span>
            </div>
            {hayConflicto && notaAbierta && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 rounded-lg bg-[#fff8e1] border border-[#f5c518] px-3 py-2 text-[12.5px] text-[#8a5a00]">
                <span className="font-bold">⚠ {notaAbierta.editado_por || "Otro usuario"} modificó esta nota mientras la editabas.</span>
                <span>Si guardas, se sobrescribirán sus cambios.</span>
                <button type="button" className="font-bold underline ml-auto" onClick={cargarVersionNueva}>Cargar su versión</button>
                <button type="button" className="underline" onClick={() => setBorrador({ ...borrador, base: notaAbierta.updated_at })}>Ignorar</button>
              </div>
            )}
            {verReloj && (
              <div className="flex items-center gap-2 mb-3">
                <input type="datetime-local" value={borrador.vence_en} onChange={(e) => setBorrador({ ...borrador, vence_en: e.target.value })} className="border border-[var(--gray-300)] rounded-md px-2 py-1.5 text-[12.5px]" />
                {borrador.vence_en && <button type="button" className="text-[12px] text-[var(--red)]" onClick={() => setBorrador({ ...borrador, vence_en: "" })}>Quitar</button>}
              </div>
            )}
            {grabando && (
              <div className="flex items-start gap-2 mb-3 rounded-lg bg-[#fdecea] px-3 py-2 text-[12.5px] text-[var(--red)]">
                <span className="mt-1 w-2 h-2 rounded-full bg-[var(--red)] animate-pulse shrink-0" />
                <span className="font-bold">Grabando {mmss}</span>
                <span className="text-[var(--gray-500)] italic truncate">{parcial}</span>
                <button type="button" className="ml-auto font-bold underline shrink-0" onClick={() => detenerGrabacion(false)}>Detener</button>
              </div>
            )}
            <div
              ref={editor}
              contentEditable
              suppressContentEditableWarning
              onBlur={() => editor.current && enlazar(editor.current)}
              onInput={actualizarProgreso}
              onClick={(e) => {
                const a = (e.target as HTMLElement).closest("a");
                if (a) window.open(a.getAttribute("href") || "", "_blank", "noopener");
                if ((e.target as HTMLElement).tagName === "INPUT") actualizarProgreso();
              }}
              data-placeholder="Escribe aquí. La primera línea será el título."
              className={`nota-editor border border-[var(--gray-200)] rounded-xl p-4 text-[13.5px] leading-relaxed focus:outline-none focus:border-[var(--blue)] ${grande ? "flex-1 min-h-[50vh]" : "min-h-[240px]"}`}
            />
            {prog.total > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-[12px] font-bold text-[var(--gray-500)] mb-1">
                  <span>Avance {prog.hechas}/{prog.total}{borrador.terminada && prog.hechas === prog.total ? " · nota terminada" : ""}</span>
                  <span>{Math.round((prog.hechas * 100) / prog.total)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--gray-100)] overflow-hidden">
                  <div className={`h-full rounded-full ${prog.hechas === prog.total ? "bg-[var(--green)]" : "bg-[var(--blue)]"}`} style={{ width: `${(prog.hechas * 100) / prog.total}%` }} />
                </div>
              </div>
            )}
            {!borrador.propia && <p className="mt-3 text-[12px] text-[var(--blue)] font-bold">👥 Nota compartida contigo — puedes editarla.</p>}
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
              <button type="button" className="btn btn-secundario py-1.5" disabled={guardando} onClick={cerrar}>Cancelar</button>
              <button type="button" className="btn btn-primario py-1.5" disabled={guardando} onClick={() => guardar()}>{guardando ? "Guardando…" : "Guardar nota"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
