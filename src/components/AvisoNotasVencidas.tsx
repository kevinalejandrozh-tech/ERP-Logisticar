"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Globo persistente en todas las páginas cuando hay notas vencidas.
// Solo desaparece cuando la nota se marca como terminada en Notas.
export default function AvisoNotasVencidas() {
  const [vencidas, setVencidas] = useState<{ id: number; titulo: string }[]>([]);
  const ruta = usePathname();

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/notas?vencidas=1", { cache: "no-store" });
      if (!res.ok) return setVencidas([]);
      const d = await res.json();
      setVencidas(d.vencidas || []);
    } catch {
      /* sin conexión */
    }
  }, []);

  useEffect(() => {
    if (ruta === "/login" || ruta?.startsWith("/sitio")) return;
    cargar();
    const id = window.setInterval(cargar, 60000);
    const alEnfocar = () => cargar();
    window.addEventListener("focus", alEnfocar);
    window.addEventListener("notas-cambiaron", alEnfocar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", alEnfocar);
      window.removeEventListener("notas-cambiaron", alEnfocar);
    };
  }, [cargar, ruta]);

  if (!vencidas.length || ruta === "/login") return null;
  return (
    <Link
      href="/notas"
      className="fixed bottom-4 right-4 z-[80] max-w-[300px] flex items-start gap-2.5 rounded-2xl bg-[var(--red)] text-white px-4 py-3 shadow-[0_8px_24px_rgba(220,38,38,0.35)] no-underline animate-pulse"
      title="Marca la nota como terminada para quitar este aviso"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" className="shrink-0 mt-0.5"><circle cx="12" cy="13" r="8" /><path d="M12 9v4l2.5 2.5M9 2h6" /></svg>
      <span className="text-[12.5px] leading-snug">
        <b className="block">{vencidas.length === 1 ? "Nota vencida" : `${vencidas.length} notas vencidas`}</b>
        {vencidas.slice(0, 2).map((v) => v.titulo).join(" · ")}
      </span>
    </Link>
  );
}
