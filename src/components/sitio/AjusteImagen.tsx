"use client";
import { useEffect, useRef, useState } from "react";
import { Ajuste, estiloDeAjuste, leerAjuste, textoAjuste } from "@/lib/sitioData";
import { Modal } from "./PanelesSitio";

export type VistaImagen = { nombre: string; aspecto: number };

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Cuántos píxeles se desplaza el contenido cuando la posición pasa de 0 % a 100 %.
// Sirve para que al arrastrar la imagen siga al cursor 1 a 1 (con cualquier zoom).
function recorrido(w: number, h: number, zoom: number, natural: { w: number; h: number } | null) {
  const nat = natural && natural.w > 0 && natural.h > 0 ? natural : { w, h };
  const escala = Math.max(w / nat.w, h / nat.h);
  const sobraX = Math.max(0, nat.w * escala - w);
  const sobraY = Math.max(0, nat.h * escala - h);
  return { rx: w * (zoom - 1) + zoom * sobraX, ry: h * (zoom - 1) + zoom * sobraY };
}

// Ajusta cómo se ve una imagen en su marco: arrastrar para mover, rueda o control para acercar.
// El archivo no se recorta: se guarda el encuadre (zoom y posición), así se puede volver a ajustar cuando se quiera.
export default function AjusteImagen({
  src,
  ajusteInicial,
  aspecto,
  vistas,
  esNueva,
  aplicando,
  onAplicar,
  onCancelar,
}: {
  src: string;
  ajusteInicial: string;
  aspecto: number;
  vistas?: VistaImagen[];
  esNueva: boolean;
  aplicando: boolean;
  onAplicar: (ajuste: string) => void;
  onCancelar: () => void;
}) {
  const [aj, setAj] = useState<Ajuste>(() => leerAjuste(ajusteInicial));
  const [vista, setVista] = useState(0);
  const marco = useRef<HTMLDivElement>(null);
  const natural = useRef<{ w: number; h: number } | null>(null);
  const arrastre = useRef<{ px: number; py: number; a: Ajuste; w: number; h: number } | null>(null);
  const razon = vistas?.[vista]?.aspecto ?? aspecto;

  // La rueda del mouse acerca o aleja (listener nativo para poder evitar que la página se desplace).
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      setAj((a) => ({ ...a, zoom: limitar(a.zoom - e.deltaY * 0.0015, 1, 4) }));
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, []);

  const iniciar = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = e.currentTarget.getBoundingClientRect();
    arrastre.current = { px: e.clientX, py: e.clientY, a: aj, w: r.width, h: r.height };
  };
  const mover = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = arrastre.current;
    if (!d) return;
    const { rx, ry } = recorrido(d.w, d.h, d.a.zoom, natural.current);
    setAj({
      zoom: d.a.zoom,
      x: rx > 0.5 ? limitar(d.a.x - (100 * (e.clientX - d.px)) / rx, 0, 100) : d.a.x,
      y: ry > 0.5 ? limitar(d.a.y - (100 * (e.clientY - d.py)) / ry, 0, 100) : d.a.y,
    });
  };
  const soltar = () => {
    arrastre.current = null;
  };

  const teclado = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const paso = 2;
    if (e.key === "ArrowLeft") setAj((a) => ({ ...a, x: limitar(a.x + paso, 0, 100) }));
    else if (e.key === "ArrowRight") setAj((a) => ({ ...a, x: limitar(a.x - paso, 0, 100) }));
    else if (e.key === "ArrowUp") setAj((a) => ({ ...a, y: limitar(a.y + paso, 0, 100) }));
    else if (e.key === "ArrowDown") setAj((a) => ({ ...a, y: limitar(a.y - paso, 0, 100) }));
    else if (e.key === "+" || e.key === "=") setAj((a) => ({ ...a, zoom: limitar(a.zoom + 0.1, 1, 4) }));
    else if (e.key === "-") setAj((a) => ({ ...a, zoom: limitar(a.zoom - 0.1, 1, 4) }));
    else return;
    e.preventDefault();
  };

  const zoomBtn = (delta: number) => setAj((a) => ({ ...a, zoom: limitar(a.zoom + delta, 1, 4) }));

  return (
    <Modal titulo={esNueva ? "Ajustar la nueva imagen" : "Ajustar imagen"} onCerrar={onCancelar} ancho="max-w-[700px]" cerrarAlClicFuera={false}>
      <p className="text-[13px] text-[var(--gray-500)] mb-3">
        Arrastra la imagen para moverla y usa el control (o la rueda del mouse) para acercar. Lo que ves dentro del marco es lo que se mostrará en el sitio.
      </p>
      {vistas && vistas.length > 1 && (
        <div className="flex gap-1.5 mb-3" role="group" aria-label="Vista previa">
          {vistas.map((v, i) => (
            <button
              key={v.nombre}
              type="button"
              onClick={() => setVista(i)}
              aria-pressed={i === vista}
              className={`px-3 py-1 rounded-md text-[12.5px] font-medium border ${i === vista ? "bg-[var(--navy)] text-white border-[var(--navy)]" : "bg-white text-[var(--navy)] border-[var(--gray-300)] hover:border-[var(--navy)]"}`}
            >
              {v.nombre}
            </button>
          ))}
        </div>
      )}
      <div
        ref={marco}
        tabIndex={0}
        role="group"
        aria-label="Marco de la imagen: arrastra para mover; flechas para mover; más y menos para el zoom"
        onPointerDown={iniciar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerCancel={soltar}
        onKeyDown={teclado}
        style={{ aspectRatio: String(razon), width: `min(100%, ${Math.round(52 * razon)}vh)` }}
        className="relative mx-auto overflow-hidden rounded-md bg-[var(--navy-dark)] cursor-grab active:cursor-grabbing touch-none select-none outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--blue)] ring-1 ring-[var(--gray-300)]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Vista previa de la imagen"
          draggable={false}
          onLoad={(e) => {
            natural.current = { w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight };
          }}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={estiloDeAjuste(aj)}
        />
      </div>
      <div className="flex items-center gap-3 mt-4 max-w-[520px] mx-auto">
        <button type="button" onClick={() => zoomBtn(-0.1)} aria-label="Alejar" className="w-8 h-8 shrink-0 rounded-md border border-[var(--gray-300)] text-[18px] leading-none text-[var(--navy)] hover:border-[var(--navy)]">
          −
        </button>
        <input
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={aj.zoom}
          onChange={(e) => setAj((a) => ({ ...a, zoom: Number(e.target.value) }))}
          aria-label="Zoom"
          className="flex-1 min-w-0"
        />
        <button type="button" onClick={() => zoomBtn(0.1)} aria-label="Acercar" className="w-8 h-8 shrink-0 rounded-md border border-[var(--gray-300)] text-[18px] leading-none text-[var(--navy)] hover:border-[var(--navy)]">
          +
        </button>
        <span className="w-12 text-right text-[12.5px] tabular-nums text-[var(--gray-500)]">{Math.round(aj.zoom * 100)}%</span>
      </div>
      <div className="flex items-center justify-between gap-2 mt-5">
        <button type="button" onClick={() => setAj({ zoom: 1, x: 50, y: 50 })} disabled={aplicando} className="btn btn-secundario">
          Restablecer
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onCancelar} disabled={aplicando} className="btn btn-secundario">
            Cancelar
          </button>
          <button type="button" onClick={() => onAplicar(textoAjuste(aj))} disabled={aplicando} className="btn btn-primario">
            {aplicando ? "Subiendo..." : esNueva ? "Usar esta imagen" : "Aplicar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
