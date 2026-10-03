"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// Acceso discreto al Buzón de quejas y sugerencias, con marcador rojo cuando hay sugerencias nuevas.
export default function BuzonIcono({ className = "" }: { className?: string }) {
  const [nuevas, setNuevas] = useState(0);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/buzon-sugerencias/pendientes", { cache: "no-store" });
      const d = await res.json();
      if (d.ok) setNuevas(d.nuevas || 0);
    } catch {
      // se reintenta en el siguiente ciclo
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = window.setInterval(cargar, 60000);
    window.addEventListener("focus", cargar);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", cargar);
    };
  }, [cargar]);

  return (
    <Link
      href="/buzon-sugerencias"
      title="Buzón de quejas y sugerencias"
      aria-label={nuevas > 0 ? `Buzón de quejas y sugerencias: ${nuevas} nuevas` : "Buzón de quejas y sugerencias"}
      className={`relative w-9 h-9 items-center justify-center rounded-lg hover:bg-[var(--gray-100)] ${className}`}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
        <path d="M8 9h8M8 13h5" />
      </svg>
      {nuevas > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--red)] text-white text-[10.5px] font-bold leading-[18px] text-center shadow-[0_0_0_2px_#fff]">
          {nuevas > 99 ? "99+" : nuevas}
        </span>
      )}
    </Link>
  );
}
