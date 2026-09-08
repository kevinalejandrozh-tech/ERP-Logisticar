"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Sugerencia = { id: number; nombre: string; comentario: string; fecha: string };

declare global {
  interface Window {
    QRious: any;
  }
}
function cargarQRiousLib(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.QRious) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el generador de código QR."));
    document.body.appendChild(script);
  });
}
function formatearFecha(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function BuzonSugerenciasPage() {
  const [registros, setRegistros] = useState<Sugerencia[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try {
      const res = await fetch("/api/buzon-sugerencias/list", { cache: "no-store" });
      const data = await res.json();
      setRegistros(data.registros || []);
    } catch {
      // se reintenta al volver a la pestaña
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  useEffect(() => {
    cargarQRiousLib()
      .then(() => {
        const canvas = document.getElementById("qr-buzon-sugerencias") as HTMLCanvasElement | null;
        if (canvas) {
          new window.QRious({ element: canvas, value: `${window.location.origin}/buzon-sugerencias/enviar`, size: 108, level: "M" });
        }
      })
      .catch(() => {});
  }, []);

  const eliminar = async (id: number) => {
    if (!confirm("¿Eliminar este registro del buzón?")) return;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch("/api/buzon-sugerencias/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargar();
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Buzón de sugerencias e ideas de mejora"
          subtitulo="Escanea el código QR para que cualquier persona comparta una idea, o revisa aquí lo que ya se ha recibido."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M12 2C7 2 3 5 3 9c0 2.4 1.4 4.5 3.5 5.8V21l4-2.2c.5.1 1 .2 1.5.2 5 0 9-3 9-7s-4-7-9-7z" /></svg>}
        />

        <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 mb-5 flex items-center gap-4 flex-wrap">
          <div className="w-[124px] h-[124px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto sm:mx-0 p-2 shrink-0">
            <canvas id="qr-buzon-sugerencias" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[var(--navy)] m-0 mb-1">Escanea para dejar tu idea</p>
            <p className="text-[12px] text-[var(--gray-400)] m-0">
              Cualquier persona, desde su celular, puede escanear este código y compartir una sugerencia o idea de mejora de forma anónima o con su nombre.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-bold text-[var(--navy)] m-0">Sugerencias recibidas</h3>
            {!cargando && <span className="text-[12px] font-bold text-[var(--gray-400)]">{registros.length} registro{registros.length === 1 ? "" : "s"}</span>}
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && registros.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no se ha recibido ninguna sugerencia. Comparte el código QR para empezar.</p>
          )}

          {!cargando && registros.length > 0 && (
            <div className="flex flex-col gap-3">
              {registros.map((r) => (
                <div key={r.id} className="border border-[var(--gray-200)] rounded-xl p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[12.5px] font-bold text-[var(--navy)]">{r.nombre}</span>
                      <span className="text-[10.5px] text-[var(--gray-400)]">{formatearFecha(r.fecha)}</span>
                    </div>
                    <p className="text-[13.5px] text-[var(--text)] m-0 leading-relaxed whitespace-pre-line">{r.comentario}</p>
                  </div>
                  <span onClick={() => eliminar(r.id)} className="text-[var(--red)] cursor-pointer shrink-0 mt-0.5" title="Eliminar registro">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <PageFooter />
      </div>
    </div>
  );
}
