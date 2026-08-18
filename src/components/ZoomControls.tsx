"use client";
import { useEffect, useState } from "react";

const NIVELES = [70, 80, 90, 100, 110, 125, 150];

export default function ZoomControls({ children }: { children: React.ReactNode }) {
  const [zoom, setZoom] = useState(100);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    const guardado = window.localStorage.getItem("zoomNivelApp");
    if (guardado) setZoom(Number(guardado));
    setListo(true);
  }, []);

  useEffect(() => {
    if (!listo) return;
    window.localStorage.setItem("zoomNivelApp", String(zoom));
  }, [zoom, listo]);

  const acercar = () => setZoom((z) => NIVELES.find((n) => n > z) || z);
  const alejar = () => setZoom((z) => [...NIVELES].reverse().find((n) => n < z) || z);
  const restablecer = () => setZoom(100);

  return (
    <>
      <div style={{ zoom: `${zoom}%` }}>{children}</div>
      <div className="fixed bottom-4 left-4 z-[9999] flex items-center gap-0.5 bg-white rounded-full shadow-lg border border-[var(--gray-200)] px-1.5 py-1">
        <button
          type="button"
          onClick={alejar}
          title="Alejar"
          className="w-7 h-7 flex items-center justify-center text-[var(--navy)] rounded-full hover:bg-[var(--gray-100)] font-bold text-[15px] leading-none"
        >
          −
        </button>
        <span onClick={restablecer} title="Restablecer zoom" className="text-[10.5px] font-bold text-[var(--gray-400)] w-9 text-center cursor-pointer select-none">
          {zoom}%
        </span>
        <button
          type="button"
          onClick={acercar}
          title="Acercar"
          className="w-7 h-7 flex items-center justify-center text-[var(--navy)] rounded-full hover:bg-[var(--gray-100)] font-bold text-[15px] leading-none"
        >
          +
        </button>
      </div>
    </>
  );
}
