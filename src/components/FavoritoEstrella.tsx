"use client";
import { useEffect, useState } from "react";

// Estrella de favoritos: al marcarla, la página aparece como acceso directo en el inicio.
export default function FavoritoEstrella({ titulo }: { titulo: string }) {
  const [ruta, setRuta] = useState("");
  const [activo, setActivo] = useState(false);
  const [visible, setVisible] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    const r = window.location.pathname + window.location.search;
    setRuta(r);
    fetch("/api/favoritos", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        if (!d?.ok) return;
        setVisible(true);
        setActivo(d.favoritos.some((f: { ruta: string }) => f.ruta === r));
      })
      .catch(() => {});
  }, []);

  if (!visible || !ruta || ruta === "/") return null;

  const alternar = async () => {
    if (guardando) return;
    const nuevo = !activo;
    setActivo(nuevo);
    setGuardando(true);
    try {
      const res = nuevo
        ? await fetch("/api/favoritos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ruta, titulo }) })
        : await fetch(`/api/favoritos?ruta=${encodeURIComponent(ruta)}`, { method: "DELETE" });
      if (!res.ok) setActivo(!nuevo);
    } catch {
      setActivo(!nuevo);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <button
      type="button"
      onClick={alternar}
      title={activo ? "Quitar de favoritos" : "Agregar a favoritos (acceso directo en el inicio)"}
      aria-label={activo ? "Quitar de favoritos" : "Agregar a favoritos"}
      aria-pressed={activo}
      className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md hover:bg-[var(--gray-100)] transition-colors"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill={activo ? "var(--amber)" : "none"} stroke={activo ? "var(--amber)" : "var(--gray-400)"} strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.37l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93z" />
      </svg>
    </button>
  );
}
