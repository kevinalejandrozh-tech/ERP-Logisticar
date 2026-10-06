"use client";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type Aviso = { id: number; nota_id: number | null; de: string; texto: string };

// Tiempo real de Notas entre usuarios (sondeo ligero cada pocos segundos, sin conexiones persistentes):
//  · avisa al instante con un recuadro cuando otro usuario comparte, edita, termina o elimina una nota tuya/compartida
//  · emite "notas-version" para que la pantalla de Notas se actualice sola cuando algo cambia
//  · emite "notas-avisos" para que la campana de notificaciones se refresque al momento
const CADA_MS = 4000;

export default function NotasEnVivo() {
  const ruta = usePathname();
  const router = useRouter();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const bloqueado = useRef(false); // sin sesión o sin acceso a Notas: se deja de consultar

  useEffect(() => {
    bloqueado.current = false;
    if (!ruta || ruta === "/login" || ruta.startsWith("/sitio")) return;
    let vivo = true;
    let enCurso = false;
    const consultar = async () => {
      if (!vivo || enCurso || bloqueado.current || document.hidden) return;
      enCurso = true;
      try {
        const res = await fetch("/api/notas/cambios", { cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          bloqueado.current = true;
          return;
        }
        if (!res.ok) return;
        const d = await res.json();
        window.dispatchEvent(new CustomEvent("notas-version", { detail: d.version }));
        if (Array.isArray(d.avisos) && d.avisos.length) {
          window.dispatchEvent(new Event("notas-avisos"));
          setAvisos((prev) => [...prev, ...d.avisos].slice(-4));
          d.avisos.forEach((a: Aviso) => window.setTimeout(() => setAvisos((prev) => prev.filter((x) => x.id !== a.id)), 9000));
        }
      } catch {
        /* sin conexión: se reintenta en el siguiente ciclo */
      } finally {
        enCurso = false;
      }
    };
    consultar();
    const id = window.setInterval(consultar, CADA_MS);
    const alVolver = () => !document.hidden && consultar();
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);
    window.addEventListener("notas-cambiaron", alVolver);
    return () => {
      vivo = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
      window.removeEventListener("notas-cambiaron", alVolver);
    };
  }, [ruta]);

  if (!avisos.length) return null;
  return (
    <div className="fixed top-4 right-4 z-[90] flex flex-col gap-2 w-[min(340px,calc(100vw-2rem))]">
      {avisos.map((a) => (
        <div key={a.id} className="flex items-start gap-3 bg-white border border-[var(--gray-200)] border-l-4 !border-l-[var(--blue)] rounded-xl shadow-lg px-4 py-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="1.8" strokeLinecap="round" className="shrink-0 mt-0.5">
            <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 01-3.4 0" />
          </svg>
          <button
            type="button"
            className="text-left text-[12.5px] leading-snug text-[var(--text)] flex-1"
            onClick={() => {
              setAvisos((prev) => prev.filter((x) => x.id !== a.id));
              router.push("/notas");
            }}
          >
            <b className="text-[var(--navy)]">{a.de}</b> {a.texto}
          </button>
          <button type="button" aria-label="Cerrar aviso" className="text-[var(--gray-400)] text-lg leading-none" onClick={() => setAvisos((prev) => prev.filter((x) => x.id !== a.id))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
