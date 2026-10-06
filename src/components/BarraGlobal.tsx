"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSesion } from "@/lib/useSesion";
import ChatIcono from "./ChatIcono";
import { EVENTO_MODO, cambiarModoEdicion, modoEdicionActivo } from "./modoEdicion";

// Casita (inicio) y engrane en todas las páginas, arriba a la derecha.
// El engrane abre: Mi perfil y, para el sysadmin, el lápiz de Modo edición (editar textos de la página).
// Los textos editados se guardan por página y se aplican para todos los usuarios.
export default function BarraGlobal() {
  const ruta = usePathname() || "/";
  const router = useRouter();
  const sesion = useSesion();
  const [menu, setMenu] = useState(false);
  const [mant, setMant] = useState(false);
  const [notifMax, setNotifMax] = useState(50);
  const [edicion, setEdicion] = useState(false);
  const [editando, setEditando] = useState<{ nodo: Text; original: string; valor: string; x: number; y: number } | null>(null);
  const originales = useRef(new WeakMap<Text, string>());
  const textos = useRef<Map<string, string>>(new Map());
  const esSysadmin = sesion.rol === "sysadmin";

  // Al abrir el engrane: estado del modo mantenimiento (sysadmin) y límite de notificaciones guardadas.
  useEffect(() => {
    if (!menu) return;
    fetch("/api/sistema/preferencias?clave=notif_max", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && d.valor && setNotifMax(Number(d.valor))).catch(() => {});
    if (esSysadmin) fetch("/api/sistema/mantenimiento", { cache: "no-store" }).then((r) => r.json()).then((d) => d.ok && setMant(d.activo === true)).catch(() => {});
  }, [menu, esSysadmin]);
  const cambiarMantenimiento = async () => {
    const nuevo = !mant;
    setMant(nuevo);
    await fetch("/api/sistema/mantenimiento", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ activo: nuevo }) }).catch(() => setMant(!nuevo));
    window.dispatchEvent(new Event("mantenimiento-cambio"));
  };
  const cambiarNotifMax = async (n: number) => {
    setNotifMax(n);
    await fetch("/api/sistema/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: "notif_max", valor: n }) }).catch(() => {});
    window.dispatchEvent(new Event("notas-avisos")); // refresca la campana
  };
  const oculto = ruta === "/login" || ruta.startsWith("/sitio");

  useEffect(() => {
    const leer = () => setEdicion(modoEdicionActivo());
    leer();
    window.addEventListener(EVENTO_MODO, leer);
    return () => window.removeEventListener(EVENTO_MODO, leer);
  }, []);

  // Aplica los textos personalizados a los nodos de texto de la página.
  const aplicar = useCallback(() => {
    if (!textos.current.size) return;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode as Text;
      if (t.parentElement?.closest("[data-no-editable], script, style, textarea")) continue;
      const actual = t.data.trim();
      if (!actual) continue;
      const original = originales.current.get(t) ?? actual;
      const nuevo = textos.current.get(original);
      if (nuevo && actual !== nuevo) {
        originales.current.set(t, original);
        t.data = t.data.replace(actual, nuevo);
      }
    }
  }, []);

  useEffect(() => {
    if (oculto) return;
    let cancelado = false;
    textos.current = new Map();
    fetch(`/api/personalizacion/textos?pagina=${encodeURIComponent(ruta)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelado || !d.ok) return;
        textos.current = new Map((d.textos || []).map((x: { original: string; texto: string }) => [x.original, x.texto]));
        aplicar();
      })
      .catch(() => {});
    let pendiente = 0;
    const obs = new MutationObserver(() => {
      window.clearTimeout(pendiente);
      pendiente = window.setTimeout(aplicar, 60);
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    return () => {
      cancelado = true;
      obs.disconnect();
      window.clearTimeout(pendiente);
    };
  }, [ruta, oculto, aplicar]);

  // En modo edición, un clic sobre cualquier texto abre el editor flotante (sin cambiar formato ni tamaño).
  useEffect(() => {
    if (!edicion || !esSysadmin) return;
    const alClic = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-no-editable]")) return;
      const nodo = Array.from(el.childNodes).find((n) => n.nodeType === Node.TEXT_NODE && (n as Text).data.trim()) as Text | undefined;
      if (!nodo) return;
      e.preventDefault();
      e.stopPropagation();
      const actual = nodo.data.trim();
      setEditando({ nodo, original: originales.current.get(nodo) ?? actual, valor: actual, x: Math.min(e.clientX, window.innerWidth - 340), y: Math.min(e.clientY + 12, window.innerHeight - 150) });
    };
    document.addEventListener("click", alClic, true);
    document.body.classList.add("modo-edicion");
    return () => {
      document.removeEventListener("click", alClic, true);
      document.body.classList.remove("modo-edicion");
    };
  }, [edicion, esSysadmin]);

  const guardar = async (restablecer = false) => {
    if (!editando) return;
    const texto = restablecer ? "" : editando.valor.trim();
    const res = await fetch("/api/personalizacion/textos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pagina: ruta, original: editando.original, texto }) });
    if (!res.ok) return alert((await res.json()).error || "No se pudo guardar.");
    const final = texto || editando.original;
    if (texto) textos.current.set(editando.original, texto);
    else textos.current.delete(editando.original);
    originales.current.set(editando.nodo, editando.original);
    editando.nodo.data = editando.nodo.data.replace(editando.nodo.data.trim(), final);
    setEditando(null);
  };

  if (oculto) return null;
  return (
    <>
      <style>{`body.modo-edicion :where(h1,h2,h3,h4,p,span,a,button,label,th,td,b,small,li):hover { outline: 2px dashed #2f6fed; outline-offset: 2px; cursor: text; }`}</style>
      <div data-no-editable className="fixed top-2 right-2 z-[75] flex items-center gap-1.5 print:hidden">
        {ruta !== "/" && (
          <Link href="/" title="Página principal" className="w-9 h-9 flex items-center justify-center rounded-full bg-white/95 border border-[var(--gray-200)] shadow-sm hover:bg-[var(--gray-100)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" /></svg>
          </Link>
        )}
        <div className="relative">
          <button type="button" title="Configuración" onClick={() => setMenu((v) => !v)} className={`w-9 h-9 flex items-center justify-center rounded-full border shadow-sm ${edicion ? "bg-[var(--blue)] border-[var(--blue)]" : "bg-white/95 border-[var(--gray-200)] hover:bg-[var(--gray-100)]"}`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={edicion ? "#fff" : "#16215c"} strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
          </button>
          {menu && (
            <div className="absolute right-0 top-11 w-[220px] bg-white border border-[var(--gray-200)] rounded-xl shadow-lg p-1.5">
              <button type="button" className="w-full text-left px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--gray-100)]" onClick={() => { setMenu(false); router.push("/?perfil=1"); }}>
                👤 Mi perfil
              </button>
              <label className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--gray-100)]" title="Al llegar al límite se conservan solo las más recientes y se borran las más antiguas">
                <span>🔔 Notificaciones guardadas</span>
                <select value={notifMax} onChange={(e) => cambiarNotifMax(Number(e.target.value))} className="border border-[var(--gray-300)] rounded-md px-1 py-0.5 text-[12px] bg-white">
                  {[10, 25, 50, 100, 200].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              {esSysadmin && (
                <button type="button" className="w-full text-left px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--gray-100)] flex items-center justify-between gap-2" onClick={cambiarMantenimiento} title="Muestra a todos los usuarios el aviso de que se están cargando mejoras">
                  <span>🛠 Aviso de mejoras</span>
                  <span className={`text-[11.5px] font-bold ${mant ? "text-[var(--green)]" : "text-[var(--gray-400)]"}`}>{mant ? "Activo" : "Apagado"}</span>
                </button>
              )}
              {esSysadmin && (
                <button type="button" className="w-full text-left px-3 py-2 rounded-lg text-[13px] hover:bg-[var(--gray-100)] flex items-center gap-2" onClick={() => { setMenu(false); cambiarModoEdicion(!edicion); }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                  {edicion ? "Salir del modo edición" : "Modo edición"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      {/* Mensajes: debajo de la casita */}
      <div data-no-editable className="fixed top-[52px] right-[50px] z-[75] print:hidden">
        <ChatIcono />
      </div>
      {edicion && esSysadmin && (
        <div data-no-editable className="fixed top-2 left-1/2 -translate-x-1/2 z-[75] bg-[var(--blue)] text-white text-[12px] font-bold rounded-full px-4 py-1.5 shadow print:hidden">
          Modo edición · clic en un texto para cambiarlo ·{" "}
          <button type="button" className="underline" onClick={() => cambiarModoEdicion(false)}>Salir</button>
        </div>
      )}
      {editando && (
        <div data-no-editable className="fixed z-[90] w-[320px] bg-white border border-[var(--gray-200)] rounded-xl shadow-xl p-3" style={{ left: editando.x, top: editando.y }}>
          <p className="text-[11px] text-[var(--gray-500)] m-0 mb-1.5 truncate">Original: {editando.original}</p>
          <textarea autoFocus rows={2} value={editando.valor} onChange={(e) => setEditando({ ...editando, valor: e.target.value })} className="w-full border border-[var(--gray-300)] rounded-md px-2 py-1.5 text-[13px]" />
          <div className="flex justify-between gap-2 mt-2">
            <button type="button" className="text-[12px] text-[var(--gray-500)]" onClick={() => guardar(true)}>Restablecer</button>
            <span className="flex gap-2">
              <button type="button" className="btn btn-secundario py-1 text-[12px]!" onClick={() => setEditando(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario py-1 text-[12px]!" onClick={() => guardar()}>Guardar</button>
            </span>
          </div>
        </div>
      )}
    </>
  );
}
