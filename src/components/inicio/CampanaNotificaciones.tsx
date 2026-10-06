"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Notificacion = {
  id: number;
  usuario: string;
  accion: string;
  pagina: string;
  paginaTitulo: string;
  veces: number;
  fecha: string;
  nueva: boolean;
};

function haceCuanto(fecha: string): string {
  const seg = Math.max(0, Math.round((Date.now() - new Date(fecha).getTime()) / 1000));
  if (seg < 60) return "hace un momento";
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} día${d === 1 ? "" : "s"}`;
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function iniciales(nombre: string) {
  return nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// Campana de notificaciones: muestra los movimientos que hicieron OTROS usuarios en cualquier página.
export default function CampanaNotificaciones() {
  const [abierto, setAbierto] = useState(false);
  const [noLeidas, setNoLeidas] = useState(0);
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const res = await fetch("/api/notificaciones", { cache: "no-store" });
      const d = await res.json();
      if (d.ok) {
        setNoLeidas(d.noLeidas);
        setItems(d.items);
      }
    } catch {
      // sin conexión: se reintenta en el siguiente ciclo
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const id = window.setInterval(cargar, 60000);
    const alEnfocar = () => cargar();
    window.addEventListener("focus", alEnfocar);
    window.addEventListener("notas-avisos", alEnfocar); // aviso inmediato de otro usuario (Notas)
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", alEnfocar);
      window.removeEventListener("notas-avisos", alEnfocar);
    };
  }, [cargar]);

  const abrir = () => {
    const nuevo = !abierto;
    setAbierto(nuevo);
    if (nuevo && noLeidas > 0) {
      setNoLeidas(0);
      fetch("/api/notificaciones", { method: "POST" }).catch(() => {});
    }
    if (!nuevo) setItems((lista) => lista.map((n) => ({ ...n, nueva: false })));
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={abrir}
        aria-label={noLeidas > 0 ? `Notificaciones: ${noLeidas} sin leer` : "Notificaciones"}
        aria-expanded={abierto}
        className="relative w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)]"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 01-3.4 0" /></svg>
        {noLeidas > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--red)] text-white text-[10.5px] font-bold leading-[18px] text-center shadow-[0_0_0_2px_#fff]">
            {noLeidas > 99 ? "99+" : noLeidas}
          </span>
        )}
      </button>
      {abierto && (
        <>
          <div onClick={abrir} className="fixed inset-0 z-40" />
          <div className="fixed left-3 right-3 top-[76px] sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:w-[380px] bg-white border border-[var(--gray-200)] rounded-xl shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--gray-200)]">
              <span className="text-[14px] font-bold text-[var(--navy)]">Notificaciones</span>
              <span className="text-[11px] text-[var(--gray-400)]">Movimientos de otros usuarios</span>
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {cargando ? (
                <p className="px-4 py-5 text-[13px] text-[var(--gray-500)] m-0">Cargando...</p>
              ) : items.length === 0 ? (
                <p className="px-4 py-5 text-[13px] text-[var(--gray-500)] m-0">Aún no hay movimientos de otros usuarios.</p>
              ) : (
                <ul className="list-none m-0 p-0">
                  {items.map((n) => (
                    <li key={n.id} className={`border-b border-[var(--gray-100)] last:border-b-0 ${n.nueva ? "bg-[#f3f7ff]" : ""}`}>
                      <Link href={n.pagina} onClick={() => setAbierto(false)} className="flex gap-3 px-4 py-3 no-underline hover:bg-[var(--gray-100)]">
                        <span className="w-9 h-9 rounded-full bg-[var(--blue-light)] text-[var(--blue)] text-[12px] font-bold flex items-center justify-center shrink-0">{iniciales(n.usuario)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] text-[var(--navy)] leading-snug">
                            <b>{n.usuario}</b> · {n.accion} en <b className="text-[var(--blue)]">{n.paginaTitulo}</b>
                            {n.veces > 1 && <span className="text-[var(--gray-500)]"> ({n.veces} cambios)</span>}
                          </span>
                          <span className="block text-[11px] text-[var(--gray-400)] mt-0.5">{haceCuanto(n.fecha)}</span>
                        </span>
                        {n.nueva && <span className="w-2 h-2 rounded-full bg-[var(--red)] mt-1.5 shrink-0" aria-label="Nueva" />}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
