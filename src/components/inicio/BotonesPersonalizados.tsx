"use client";
import { useCallback, useEffect, useState } from "react";
import MenuCard from "@/components/MenuCard";
import { EVENTO_MODO, modoEdicionActivo } from "@/components/modoEdicion";
import { Arrastrable } from "@/components/inicio/Ordenable";

type Boton = { id: number; slug: string; titulo: string; descripcion: string | null };
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

// Botones agregados en modo edición (mismo diseño que los del inicio); llevan a un módulo vacío.
// Van en la misma cuadrícula del inicio, después de los existentes.
export default function BotonesPersonalizados({ esSysadmin }: { esSysadmin: boolean }) {
  const [botones, setBotones] = useState<Boton[]>([]);
  const [edicion, setEdicion] = useState(false);
  const [nuevo, setNuevo] = useState<{ titulo: string; descripcion: string } | null>(null);

  const cargar = useCallback(() => {
    fetch("/api/personalizacion/botones", { cache: "no-store" }).then((r) => r.json()).then((d) => setBotones(d.botones || [])).catch(() => {});
  }, []);
  useEffect(() => {
    cargar();
    const leer = () => setEdicion(modoEdicionActivo());
    leer();
    window.addEventListener(EVENTO_MODO, leer);
    return () => window.removeEventListener(EVENTO_MODO, leer);
  }, [cargar]);

  const crear = async () => {
    if (!nuevo?.titulo.trim()) return;
    const res = await fetch("/api/personalizacion/botones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevo) });
    if (!res.ok) return alert((await res.json()).error || "No se pudo agregar.");
    setNuevo(null);
    cargar();
  };
  const quitar = async (b: Boton) => {
    if (!confirm(`¿Quitar el botón "${b.titulo}"?`)) return;
    await fetch(`/api/personalizacion/botones?id=${b.id}`, { method: "DELETE" });
    cargar();
  };

  const modo = edicion && esSysadmin;
  return (
    <>
      {botones.map((b) => (
        <Arrastrable key={b.id} id={`custom-${b.id}`} grupo="tarjetas" className="relative h-full">
          <MenuCard
            compactoMovil
            href={`/modulo/${b.slug}`}
            icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M12 8v8M8 12h8" /></svg>}
            titulo={b.titulo}
            descripcion={b.descripcion || "Módulo en construcción."}
          />
          {modo && (
            <button type="button" data-no-editable onClick={() => quitar(b)} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-[var(--red)] text-white text-[13px]" title="Quitar botón">✕</button>
          )}
        </Arrastrable>
      ))}
      {modo && (
        <div data-no-editable style={{ order: 100000 }} className="border-2 border-dashed border-[var(--blue)] rounded-[18px] p-5 flex flex-col justify-center gap-2 bg-white/60 min-h-[150px]">
          {nuevo ? (
            <>
              <input autoFocus value={nuevo.titulo} onChange={(e) => setNuevo({ ...nuevo, titulo: e.target.value })} placeholder="Nombre del botón" className="border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px]" />
              <input value={nuevo.descripcion} onChange={(e) => setNuevo({ ...nuevo, descripcion: e.target.value })} placeholder="Descripción (opcional)" className="border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13px]" />
              <div className="flex gap-2 justify-end">
                <button type="button" className="btn btn-secundario py-1" onClick={() => setNuevo(null)}>Cancelar</button>
                <button type="button" className="btn btn-primario py-1" onClick={crear}>Agregar</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={() => setNuevo({ titulo: "", descripcion: "" })} className="text-[15px] font-bold text-[var(--blue)]">+ Agregar botón</button>
          )}
        </div>
      )}
    </>
  );
}
