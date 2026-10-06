"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

// Orden personal de los botones del inicio: se arrastran con el mouse (clic sostenido) y quedan guardados por usuario.
type Orden = Record<string, string[]>;
type Ctx = {
  orden: Orden;
  arrastrando: { grupo: string; id: string } | null;
  setArrastrando: (v: { grupo: string; id: string } | null) => void;
  mover: (grupo: string, origen: string, destino: string, contenedor: HTMLElement | null) => void;
};
const OrdenCtx = createContext<Ctx | null>(null);

export function OrdenInicioProvider({ children }: { children: React.ReactNode }) {
  const [orden, setOrden] = useState<Orden>({});
  const [arrastrando, setArrastrando] = useState<{ grupo: string; id: string } | null>(null);

  useEffect(() => {
    fetch("/api/sistema/preferencias?clave=inicio_orden", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => d?.valor && typeof d.valor === "object" && setOrden(d.valor))
      .catch(() => {});
  }, []);

  const mover = useCallback((grupo: string, origen: string, destino: string, contenedor: HTMLElement | null) => {
    if (origen === destino || !contenedor) return;
    // Orden visual actual de los botones del grupo (los no guardados quedan al final, en su orden original).
    setOrden((prev) => {
      const guardado = prev[grupo] || [];
      const nodos = Array.from(contenedor.querySelectorAll<HTMLElement>(`[data-arr-grupo="${grupo}"]`));
      const ids = nodos
        .map((n, i) => ({ id: n.dataset.arrId || "", k: guardado.includes(n.dataset.arrId || "") ? guardado.indexOf(n.dataset.arrId || "") : 1000 + i }))
        .sort((a, b) => a.k - b.k)
        .map((x) => x.id);
      const i = ids.indexOf(origen);
      const j = ids.indexOf(destino);
      if (i < 0 || j < 0) return prev;
      const [x] = ids.splice(i, 1);
      ids.splice(j, 0, x);
      const nuevo = { ...prev, [grupo]: ids };
      fetch("/api/sistema/preferencias", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clave: "inicio_orden", valor: nuevo }) }).catch(() => {});
      return nuevo;
    });
  }, []);

  return <OrdenCtx.Provider value={{ orden, arrastrando, setArrastrando, mover }}>{children}</OrdenCtx.Provider>;
}

// Envuelve un botón del inicio para que se pueda arrastrar y reubicar dentro de su grupo.
export function Arrastrable({ id, grupo, children, className = "" }: { id: string; grupo: string; children: React.ReactNode; className?: string }) {
  const ctx = useContext(OrdenCtx);
  const ref = useRef<HTMLDivElement>(null);
  const [sobre, setSobre] = useState(false);
  if (!ctx) return <div className={className}>{children}</div>;
  const pos = ctx.orden[grupo]?.indexOf(id) ?? -1;
  const mio = ctx.arrastrando?.grupo === grupo && ctx.arrastrando.id === id;
  return (
    <div
      ref={ref}
      data-arr-grupo={grupo}
      data-arr-id={id}
      draggable
      style={{ order: pos >= 0 ? pos + 1 : 1000 }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", id);
        ctx.setArrastrando({ grupo, id });
      }}
      onDragEnd={() => {
        ctx.setArrastrando(null);
        setSobre(false);
      }}
      onDragOver={(e) => {
        if (ctx.arrastrando?.grupo === grupo && !mio) {
          e.preventDefault();
          setSobre(true);
        }
      }}
      onDragLeave={() => setSobre(false)}
      onDrop={(e) => {
        e.preventDefault();
        setSobre(false);
        const a = ctx.arrastrando;
        ctx.setArrastrando(null);
        if (a && a.grupo === grupo) ctx.mover(grupo, a.id, id, ref.current?.parentElement || null);
      }}
      className={`${className} cursor-grab active:cursor-grabbing transition-shadow ${mio ? "opacity-40" : ""} ${sobre ? "ring-2 ring-[var(--blue)] rounded-xl" : ""}`}
    >
      {children}
    </div>
  );
}
