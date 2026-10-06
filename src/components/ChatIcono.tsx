"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Nuevo = { id: number; conversacion_id: number; de: string; texto: string; tipo: string; nombre: string | null };

// Icono de Mensajes (debajo de la casita): contador de no leídos y aviso al instante cuando llega un mensaje.
export default function ChatIcono() {
  const ruta = usePathname() || "/";
  const router = useRouter();
  const [noLeidos, setNoLeidos] = useState(0);
  const [avisos, setAvisos] = useState<Nuevo[]>([]);
  const bloqueado = useRef(false);

  useEffect(() => {
    bloqueado.current = false;
    let vivo = true;
    const consultar = async () => {
      if (!vivo || bloqueado.current || document.hidden) return;
      try {
        const r = await fetch("/api/chat/resumen", { cache: "no-store" });
        if (r.status === 401 || r.status === 403) return void (bloqueado.current = true);
        if (!r.ok) return;
        const d = await r.json();
        setNoLeidos(d.noLeidos || 0);
        if (d.nuevos?.length && !window.location.pathname.startsWith("/mensajes")) {
          setAvisos((prev) => [...prev, ...d.nuevos].slice(-3));
          d.nuevos.forEach((a: Nuevo) => window.setTimeout(() => setAvisos((prev) => prev.filter((x) => x.id !== a.id)), 7000));
        }
      } catch {
        /* sin conexión */
      }
    };
    consultar();
    const id = window.setInterval(consultar, 5000);
    const ya = () => consultar();
    window.addEventListener("chat-leido", ya);
    document.addEventListener("visibilitychange", ya);
    return () => {
      vivo = false;
      window.clearInterval(id);
      window.removeEventListener("chat-leido", ya);
      document.removeEventListener("visibilitychange", ya);
    };
  }, [ruta]);

  return (
    <>
      <Link href="/mensajes" title="Mensajes" aria-label={noLeidos ? `Mensajes: ${noLeidos} sin leer` : "Mensajes"} className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/95 border border-[var(--gray-200)] shadow-sm hover:bg-[var(--gray-100)]">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H8l-5 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
        {noLeidos > 0 && <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-[var(--red)] text-white text-[10px] font-bold leading-[17px] text-center shadow-[0_0_0_2px_#fff]">{noLeidos > 99 ? "99+" : noLeidos}</span>}
      </Link>
      {avisos.length > 0 && (
        <div className="fixed bottom-4 left-4 z-[90] flex flex-col gap-2 w-[min(320px,calc(100vw-2rem))]">
          {avisos.map((a) => (
            <button key={a.id} type="button" onClick={() => { setAvisos((p) => p.filter((x) => x.id !== a.id)); router.push(`/mensajes?c=${a.conversacion_id}`); }} className="text-left bg-white border border-[var(--gray-200)] border-l-4 !border-l-[var(--blue)] rounded-xl shadow-lg px-4 py-3">
              <span className="block text-[12px] font-bold text-[var(--navy)]">💬 {a.de}{a.tipo !== "directo" && a.nombre ? ` · ${a.nombre}` : ""}</span>
              <span className="block text-[12.5px] text-[var(--text)] truncate">{a.texto}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
