"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import ExpedienteFormModal from "@/components/ExpedienteFormModal";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type ExpedienteResumen = { id: number; nombre: string; puesto: string | null; categoria: string | null; fotografia: string | null };

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

export default function ExpedientesPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<ExpedienteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargar = async () => {
    try {
      const res = await fetch("/api/expedientes/list", { cache: "no-store" });
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
    if (registros.length === 0) return;
    cargarQRiousLib()
      .then(() => {
        registros.forEach((r) => {
          const canvas = document.getElementById(`qr-expediente-${r.id}`) as HTMLCanvasElement | null;
          if (canvas) {
            new window.QRious({ element: canvas, value: `${window.location.origin}/personas/expedientes/detalle?id=${r.id}`, size: 84, level: "M" });
          }
        });
      })
      .catch(() => {});
  }, [registros]);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Expedientes"
          subtitulo="Consulta y administra los expedientes del personal."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap gap-2.5 mb-5">
            <button type="button" onClick={() => setModalAbierto(true)} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar / editar registro
            </button>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && registros.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay expedientes. Usa &quot;Agregar / editar registro&quot; para crear el primero.</p>
          )}

          {!cargando && registros.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {registros.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => router.push(`/personas/expedientes/detalle?id=${r.id}`)}
                  className="bg-white border border-[var(--gray-200)] rounded-2xl p-4 text-center hover:border-[var(--blue)] transition-colors"
                >
                  <div className="w-[76px] h-[76px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-3 p-1.5">
                    <canvas id={`qr-expediente-${r.id}`} />
                  </div>
                  {r.fotografia ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.fotografia} alt={r.nombre} className="w-[46px] h-[46px] rounded-full object-cover mx-auto mb-2 border border-[var(--gray-200)]" />
                  ) : (
                    <div className="w-[46px] h-[46px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-2">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                    </div>
                  )}
                  <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 mb-0.5 leading-tight">{r.nombre}</p>
                  {(r.puesto || r.categoria) && <p className="text-[10.5px] text-[var(--gray-400)] m-0">{[r.puesto, r.categoria].filter(Boolean).join(" · ")}</p>}
                </button>
              ))}
            </div>
          )}
        </div>
        <PageFooter />
      </div>

      {modalAbierto && (
        <ExpedienteFormModal
          onCancelar={() => setModalAbierto(false)}
          onGuardado={() => {
            setModalAbierto(false);
            cargar();
          }}
        />
      )}
    </div>
  );
}
