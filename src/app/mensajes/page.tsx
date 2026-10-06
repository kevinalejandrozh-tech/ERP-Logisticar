"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";

type Miembro = { id: number; nombre: string };
type Conv = { id: number; tipo: "general" | "directo" | "grupo"; nombre: string | null; ultimo: { texto: string; usuario: string; usuario_id: number; fecha: string } | null; no_leidos: number; miembros: Miembro[] };
type Msg = { id: number; usuario_id: number; usuario_nombre: string; texto: string; created_at: string };

const iniciales = (n: string) => n.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?";
const hora = (f: string) => new Date(f).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const etiquetaDia = (f: string) => {
  const d = new Date(f);
  const hoy = new Date();
  const ayer = new Date(Date.now() - 86400000);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
};
const corto = (f: string) => {
  const d = new Date(f);
  return d.toDateString() === new Date().toDateString() ? hora(f) : d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
};

export default function MensajesPage() {
  const [yo, setYo] = useState<Miembro | null>(null);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [usuarios, setUsuarios] = useState<Miembro[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [mensajes, setMensajes] = useState<Msg[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [modal, setModal] = useState<null | "chat" | "grupo">(null);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<{ nombre: string; ids: number[] }>({ nombre: "", ids: [] });
  const [cargando, setCargando] = useState(true);
  const fin = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const ultimoId = useRef(0);
  const cerca = useRef(true); // ¿el usuario está al final de la conversación?

  const cargarLista = useCallback(async () => {
    try {
      const r = await fetch("/api/chat", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) return;
      setYo(d.yo);
      setConvs(d.conversaciones);
      setUsuarios(d.usuarios);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarLista();
    const c = Number(new URLSearchParams(window.location.search).get("c"));
    if (c) setSel(c);
    const id = window.setInterval(() => !document.hidden && cargarLista(), 5000);
    return () => window.clearInterval(id);
  }, [cargarLista]);

  const nombreConv = (c: Conv) => (c.tipo === "general" ? "Todos" : c.tipo === "grupo" ? c.nombre || "Grupo" : c.miembros.find((m) => m.id !== yo?.id)?.nombre || "Chat");

  // Mensajes de la conversación abierta: carga completa y luego solo los nuevos cada 2.5 s.
  useEffect(() => {
    setMensajes([]);
    ultimoId.current = 0;
    cerca.current = true;
    if (!sel) return;
    let vivo = true;
    const traer = async () => {
      if (!vivo || document.hidden) return;
      try {
        const r = await fetch(`/api/chat/mensajes?conversacion=${sel}${ultimoId.current ? `&despues=${ultimoId.current}` : ""}`, { cache: "no-store" });
        const d = await r.json();
        if (!r.ok || !vivo) return;
        if (d.mensajes.length) {
          ultimoId.current = d.mensajes[d.mensajes.length - 1].id;
          setMensajes((prev) => (ultimoId.current && prev.length ? [...prev, ...d.mensajes.filter((m: Msg) => !prev.some((x) => x.id === m.id))] : d.mensajes));
        }
        window.dispatchEvent(new Event("chat-leido"));
      } catch {
        /* sin conexión */
      }
    };
    traer();
    const id = window.setInterval(traer, 2500);
    return () => {
      vivo = false;
      window.clearInterval(id);
    };
  }, [sel]);

  useEffect(() => {
    if (cerca.current) fin.current?.scrollIntoView({ block: "end" });
  }, [mensajes]);

  const alDesplazar = () => {
    const c = caja.current;
    if (c) cerca.current = c.scrollHeight - c.scrollTop - c.clientHeight < 80;
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !sel || enviando) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/chat/mensajes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversacion: sel, texto: t }) });
      const d = await r.json();
      if (!r.ok) return alert(d.error || "No se pudo enviar.");
      setTexto("");
      cerca.current = true;
      const n = await fetch(`/api/chat/mensajes?conversacion=${sel}${ultimoId.current ? `&despues=${ultimoId.current}` : ""}`, { cache: "no-store" }).then((x) => x.json());
      if (n.mensajes?.length) {
        ultimoId.current = n.mensajes[n.mensajes.length - 1].id;
        setMensajes((prev) => [...prev, ...n.mensajes.filter((m: Msg) => !prev.some((x) => x.id === m.id))]);
      }
      cargarLista();
    } finally {
      setEnviando(false);
    }
  };

  const abrirDirecto = async (usuarioId: number) => {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "directo", usuario_id: usuarioId }) });
    const d = await r.json();
    if (!r.ok) return alert(d.error || "No se pudo abrir el chat.");
    setModal(null);
    setBusca("");
    await cargarLista();
    setSel(d.id);
  };
  const crearGrupo = async () => {
    const r = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "grupo", nombre: grupo.nombre, usuarios: grupo.ids }) });
    const d = await r.json();
    if (!r.ok) return alert(d.error || "No se pudo crear el grupo.");
    setModal(null);
    setGrupo({ nombre: "", ids: [] });
    await cargarLista();
    setSel(d.id);
  };

  const conv = convs.find((c) => c.id === sel);
  const filtrados = usuarios.filter((u) => u.nombre.toLowerCase().includes(busca.trim().toLowerCase()));
  const Avatar = ({ nombre, grande = false, grupoIcono = false }: { nombre: string; grande?: boolean; grupoIcono?: boolean }) => (
    <span className={`${grande ? "w-10 h-10 text-[13px]" : "w-9 h-9 text-[12px]"} rounded-full bg-[var(--blue-light)] text-[var(--blue)] font-bold flex items-center justify-center shrink-0`}>
      {grupoIcono ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.5a3 3 0 010 5.5M17.5 14.7c2 .6 3.5 2.4 3.5 5.3" /></svg> : iniciales(nombre)}
    </span>
  );

  let diaPrevio = "";
  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10 pb-8">
        <PageHeader titulo="Mensajes" subtitulo="Chat entre los usuarios del sistema." backHref="/" backLabel="Menú principal" />
        <div className="flex bg-white border border-[var(--gray-200)] rounded-2xl overflow-hidden h-[calc(100dvh-190px)] min-h-[440px]">
          {/* Lista de conversaciones */}
          <aside className={`${sel ? "hidden md:flex" : "flex"} flex-col w-full md:w-[310px] md:border-r border-[var(--gray-200)] shrink-0`}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--gray-200)]">
              <span className="font-display text-[15px] font-bold text-[var(--navy)] flex-1">Conversaciones</span>
              <button type="button" onClick={() => setModal("chat")} title="Nuevo chat" aria-label="Nuevo chat" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--navy)] hover:bg-[var(--gray-100)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
              </button>
              <button type="button" onClick={() => setModal("grupo")} title="Nuevo grupo" aria-label="Nuevo grupo" className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--navy)] hover:bg-[var(--gray-100)]">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M19 8v6M16 11h6" /></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {cargando ? (
                <p className="px-4 py-5 text-[13px] text-[var(--gray-500)] m-0">Cargando…</p>
              ) : (
                convs.map((c) => (
                  <button key={c.id} type="button" onClick={() => setSel(c.id)} className={`w-full text-left flex items-center gap-3 px-4 py-3 border-b border-[var(--gray-100)] hover:bg-[var(--gray-50)] ${sel === c.id ? "bg-[var(--blue-light)]" : ""}`}>
                    <Avatar nombre={nombreConv(c)} grupoIcono={c.tipo !== "directo"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-[13.5px] font-bold text-[var(--navy)] truncate">{nombreConv(c)}</span>
                        {c.ultimo && <span className="text-[10.5px] text-[var(--gray-400)] shrink-0">{corto(c.ultimo.fecha)}</span>}
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`text-[12px] truncate ${c.no_leidos ? "text-[var(--navy)] font-medium" : "text-[var(--gray-500)]"}`}>{c.ultimo ? `${c.ultimo.usuario_id === yo?.id ? "Tú" : c.ultimo.usuario.split(" ")[0]}: ${c.ultimo.texto}` : "Sin mensajes todavía"}</span>
                        {c.no_leidos > 0 && <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--blue)] text-white text-[10.5px] font-bold leading-[18px] text-center shrink-0">{c.no_leidos}</span>}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>

          {/* Conversación abierta */}
          <section className={`${sel ? "flex" : "hidden md:flex"} flex-col flex-1 min-w-0 bg-[#f7f8fb]`}>
            {!conv ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--gray-400)] px-6">
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                <p className="text-[13.5px] mt-3 m-0">Elige una conversación o inicia un chat nuevo.</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-[var(--gray-200)]">
                  <button type="button" onClick={() => setSel(null)} className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-[var(--navy)]" aria-label="Volver">‹</button>
                  <Avatar nombre={nombreConv(conv)} grande grupoIcono={conv.tipo !== "directo"} />
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold text-[var(--navy)] m-0 truncate">{nombreConv(conv)}</p>
                    <p className="text-[11.5px] text-[var(--gray-500)] m-0 truncate">{conv.tipo === "general" ? "Todos los usuarios del sistema" : conv.tipo === "grupo" ? conv.miembros.map((m) => m.nombre.split(" ")[0]).join(", ") : "Conversación privada"}</p>
                  </div>
                </div>
                <div ref={caja} onScroll={alDesplazar} className="flex-1 overflow-y-auto px-4 py-4">
                  {mensajes.length === 0 && <p className="text-center text-[12.5px] text-[var(--gray-400)] mt-6">Aún no hay mensajes. ¡Escribe el primero!</p>}
                  {mensajes.map((m, i) => {
                    const mio = m.usuario_id === yo?.id;
                    const dia = new Date(m.created_at).toDateString();
                    const sep = dia !== diaPrevio;
                    diaPrevio = dia;
                    const mismoAutor = !sep && mensajes[i - 1]?.usuario_id === m.usuario_id;
                    return (
                      <div key={m.id}>
                        {sep && <p className="text-center my-3"><span className="inline-block text-[11px] font-medium text-[var(--gray-500)] bg-white border border-[var(--gray-200)] rounded-full px-3 py-0.5 capitalize">{etiquetaDia(m.created_at)}</span></p>}
                        <div className={`flex ${mio ? "justify-end" : "justify-start"} ${mismoAutor ? "mt-0.5" : "mt-2.5"}`}>
                          <div className={`max-w-[80%] sm:max-w-[68%] rounded-2xl px-3.5 py-2 text-[13.5px] leading-snug shadow-[0_1px_2px_rgba(22,33,92,0.06)] ${mio ? "bg-[var(--navy)] text-white rounded-br-md" : "bg-white text-[var(--text)] border border-[var(--gray-200)] rounded-bl-md"}`}>
                            {!mio && !mismoAutor && conv.tipo !== "directo" && <p className="text-[11.5px] font-bold text-[var(--blue)] m-0 mb-0.5">{m.usuario_nombre}</p>}
                            <p className="m-0 whitespace-pre-wrap break-words">{m.texto}</p>
                            <p className={`text-[10px] m-0 mt-1 text-right ${mio ? "text-white/60" : "text-[var(--gray-400)]"}`}>{hora(m.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={fin} />
                </div>
                <div className="flex items-end gap-2 p-3 bg-white border-t border-[var(--gray-200)]">
                  <textarea
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !(e.nativeEvent as KeyboardEvent).isComposing) {
                        e.preventDefault();
                        enviar();
                      }
                    }}
                    rows={1}
                    maxLength={2000}
                    placeholder="Escribe un mensaje…"
                    className="flex-1 resize-none max-h-[120px] border border-[var(--gray-200)] rounded-2xl px-4 py-2.5 text-[13.5px] focus:outline-none focus:border-[var(--blue)]"
                  />
                  <button type="button" onClick={enviar} disabled={!texto.trim() || enviando} aria-label="Enviar" className="w-10 h-10 rounded-full bg-[var(--navy)] text-white flex items-center justify-center disabled:opacity-40 shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-[80] bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-3" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-[400px] max-h-[80vh] flex flex-col p-4" onClick={(e) => e.stopPropagation()}>
            <p className="font-display text-[16px] font-bold text-[var(--navy)] m-0 mb-3">{modal === "chat" ? "Nuevo chat" : "Nuevo grupo"}</p>
            {modal === "grupo" && <input value={grupo.nombre} onChange={(e) => setGrupo({ ...grupo, nombre: e.target.value })} placeholder="Nombre del grupo" maxLength={60} className="border border-[var(--gray-300)] rounded-lg px-3 py-2 text-[13px] mb-2" />}
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar persona…" className="border border-[var(--gray-300)] rounded-lg px-3 py-2 text-[13px] mb-2" />
            <div className="overflow-y-auto flex-1 -mx-1">
              {filtrados.map((u) =>
                modal === "chat" ? (
                  <button key={u.id} type="button" onClick={() => abrirDirecto(u.id)} className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--gray-100)]">
                    <Avatar nombre={u.nombre} />
                    <span className="text-[13.5px] text-[var(--navy)]">{u.nombre}</span>
                  </button>
                ) : (
                  <label key={u.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--gray-100)] cursor-pointer">
                    <input type="checkbox" checked={grupo.ids.includes(u.id)} onChange={(e) => setGrupo({ ...grupo, ids: e.target.checked ? [...grupo.ids, u.id] : grupo.ids.filter((x) => x !== u.id) })} />
                    <Avatar nombre={u.nombre} />
                    <span className="text-[13.5px] text-[var(--navy)]">{u.nombre}</span>
                  </label>
                )
              )}
              {filtrados.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] px-2 py-3 m-0">Sin resultados.</p>}
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button type="button" className="btn btn-secundario py-1.5" onClick={() => setModal(null)}>Cancelar</button>
              {modal === "grupo" && <button type="button" className="btn btn-primario py-1.5" onClick={crearGrupo}>Crear grupo</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
