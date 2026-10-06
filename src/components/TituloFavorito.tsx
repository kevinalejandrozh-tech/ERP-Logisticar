"use client";
import { useEffect, useState } from "react";

// Título de la página: al hacer clic aparece la opción de agregarla (o quitarla) de los accesos directos del inicio.
export default function TituloFavorito({ titulo, className, children }: { titulo: string; className?: string; children?: React.ReactNode }) {
  const [ruta, setRuta] = useState("");
  const [activo, setActivo] = useState(false);
  const [visible, setVisible] = useState(false);
  const [abierto, setAbierto] = useState(false);
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

  const contenido = children ?? titulo;
  if (!visible || !ruta || ruta === "/") return <h1 className={className}>{contenido}</h1>;

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
      setAbierto(false);
    }
  };

  return (
    <div className="relative">
      <h1 className={className}>
        <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} title="Clic para opciones de accesos directos" className="text-left cursor-pointer hover:opacity-80">
          {contenido}
        </button>
      </h1>
      {abierto && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
          <div className="absolute left-0 top-full mt-1 z-50 w-[250px] bg-white border border-[var(--gray-200)] rounded-xl shadow-lg p-1.5">
            <button type="button" onClick={alternar} className="w-full text-left px-3 py-2 rounded-lg text-[13px] font-medium text-[var(--navy)] hover:bg-[var(--gray-100)] flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill={activo ? "none" : "var(--amber)"} stroke="var(--amber)" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.37l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93z" /></svg>
              {activo ? "Quitar de accesos directos" : "Agregar a accesos directos"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
