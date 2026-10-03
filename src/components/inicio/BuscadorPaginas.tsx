"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PAGINAS_SISTEMA, coincideBusqueda } from "@/lib/paginas";
import { rutaPermitida } from "@/lib/permisos";

// Barra "Buscar...": filtra las tarjetas del inicio (vía onCambio) y sugiere páginas de todo el sistema.
export default function BuscadorPaginas({
  valor,
  onCambio,
  rol,
  secciones,
  className = "",
  onNavegar,
}: {
  valor: string;
  onCambio: (v: string) => void;
  rol?: string;
  secciones?: string[] | null;
  className?: string;
  onNavegar?: () => void;
}) {
  const router = useRouter();
  const [enfocado, setEnfocado] = useState(false);
  const [indice, setIndice] = useState(0);
  const cajaRef = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => {
    if (!valor.trim()) return [];
    return PAGINAS_SISTEMA.filter((p) => {
      if (p.ruta === "/") return false;
      if (rol === "supervisor_tms" && !p.supervisor) return false;
      if (p.ruta === "/admin/usuarios" && rol !== "sysadmin") return false;
      if (rol && !rutaPermitida(p.ruta, rol, secciones)) return false;
      return coincideBusqueda(`${p.titulo} ${p.seccion} ${p.palabras || ""}`, valor);
    }).slice(0, 8);
  }, [valor, rol, secciones]);

  const ir = (ruta: string) => {
    setEnfocado(false);
    onCambio("");
    onNavegar?.();
    router.push(ruta);
  };

  const abierto = enfocado && valor.trim().length > 0;

  return (
    <div
      ref={cajaRef}
      className={`relative ${className}`}
      onBlur={(e) => {
        if (!cajaRef.current?.contains(e.relatedTarget as Node)) setEnfocado(false);
      }}
    >
      <div className="flex items-center gap-2.5 bg-white border border-[var(--gray-200)] rounded-lg px-4 py-2.5 focus-within:border-[var(--blue)] focus-within:shadow-[0_0_0_3px_rgba(47,111,237,0.15)]">
        <svg className="shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2"><circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.35-4.35" /></svg>
        <input
          type="search"
          value={valor}
          onChange={(e) => {
            onCambio(e.target.value);
            setIndice(0);
            setEnfocado(true);
          }}
          onFocus={() => setEnfocado(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndice((i) => Math.min(i + 1, resultados.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndice((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && resultados[indice]) {
              e.preventDefault();
              ir(resultados[indice].ruta);
            } else if (e.key === "Escape") {
              onCambio("");
              setEnfocado(false);
            }
          }}
          placeholder="Buscar..."
          aria-label="Buscar en el sistema"
          className="w-full min-w-0 bg-transparent outline-none border-0 text-[15px] text-[var(--navy)] placeholder:text-[var(--gray-500)]"
        />
      </div>
      {abierto && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] bg-white border border-[var(--gray-200)] rounded-xl shadow-lg z-50 overflow-hidden">
          {resultados.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-[var(--gray-500)] m-0">Sin resultados para “{valor}”.</p>
          ) : (
            <ul className="list-none m-0 p-1 max-h-[320px] overflow-y-auto">
              {resultados.map((r, i) => (
                <li key={r.ruta}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseEnter={() => setIndice(i)}
                    onClick={() => ir(r.ruta)}
                    className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg ${i === indice ? "bg-[var(--gray-100)]" : ""}`}
                  >
                    <span className="text-[13.5px] font-medium text-[var(--navy)] truncate">{r.titulo}</span>
                    <span className="text-[11px] text-[var(--gray-400)] shrink-0">{r.seccion}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
