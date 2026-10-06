"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { coincideBusqueda } from "@/lib/paginas";

type Favorito = { ruta: string; titulo: string };

// Botones pequeños de acceso directo a las páginas marcadas con la estrella (favoritos).
export default function AccesosDirectos({ consulta = "" }: { consulta?: string }) {
  const [favoritos, setFavoritos] = useState<Favorito[]>([]);
  const [abierto, setAbierto] = useState(false); // plegado por defecto; al cambiar de página vuelve a ocultarse

  useEffect(() => {
    fetch("/api/favoritos", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.ok && setFavoritos(d.favoritos))
      .catch(() => {});
  }, []);

  const quitar = async (ruta: string) => {
    setFavoritos((l) => l.filter((f) => f.ruta !== ruta));
    fetch(`/api/favoritos?ruta=${encodeURIComponent(ruta)}`, { method: "DELETE" }).catch(() => {});
  };

  const visibles = favoritos.filter((f) => coincideBusqueda(f.titulo, consulta));
  if (visibles.length === 0) return null;

  return (
    <div className="mb-6 md:mb-8">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="flex items-center gap-1.5 text-[12px] md:text-[13px] font-medium tracking-[0.12em] uppercase text-[var(--gray-500)] hover:text-[var(--navy)] m-0 mb-2.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--amber)" stroke="var(--amber)" strokeWidth="1.8" strokeLinejoin="round"><path d="M12 2.8l2.85 5.78 6.38.93-4.62 4.5 1.09 6.36L12 17.37l-5.7 3 1.09-6.36-4.62-4.5 6.38-.93z" /></svg>
        Accesos directos
        <svg className={`transition-transform ${abierto ? "rotate-180" : ""}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {abierto && <div className="flex flex-wrap gap-2">
        {visibles.map((f) => (
          <span key={f.ruta} className="group inline-flex items-center bg-white border border-[var(--gray-200)] rounded-lg shadow-[0_1px_3px_rgba(22,33,92,0.06)] hover:border-[var(--blue)] transition-colors">
            <Link href={f.ruta} className="pl-3 pr-1.5 py-2 text-[13px] font-medium text-[var(--navy)] no-underline">
              {f.titulo}
            </Link>
            <button
              type="button"
              onClick={() => quitar(f.ruta)}
              title="Quitar de accesos directos"
              aria-label={`Quitar ${f.titulo} de accesos directos`}
              className="pr-2 pl-0.5 py-2 text-[var(--gray-400)] hover:text-[var(--red)]"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
      </div>}
    </div>
  );
}
