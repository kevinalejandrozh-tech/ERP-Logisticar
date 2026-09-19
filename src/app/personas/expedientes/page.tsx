"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import ExpedienteFormModal from "@/components/ExpedienteFormModal";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type ExpedienteResumen = { id: number; nombre: string; puesto: string | null; categoria: string | null; fotografia: string | null };
type UltimaEvaluacion = { capacitacion: string; aciertos: number; fecha: string };

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

function colorAciertos(aciertos: number): string {
  if (aciertos >= 80) return "text-[var(--green)] bg-[rgba(33,168,102,0.12)]";
  if (aciertos >= 60) return "text-[var(--amber)] bg-[rgba(242,177,52,0.14)]";
  return "text-[var(--red)] bg-[rgba(226,65,44,0.12)]";
}

export default function ExpedientesPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState<ExpedienteResumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [qrExpediente, setQrExpediente] = useState<ExpedienteResumen | null>(null);
  const [ultimasEvaluaciones, setUltimasEvaluaciones] = useState<Record<string, UltimaEvaluacion>>({});

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
    fetch("/api/capacitaciones/ultimas-por-nombre", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setUltimasEvaluaciones(d.porNombre || {}))
      .catch(() => {});
  }, []);
  useRefrescarAlEnfocar(cargar);

  useEffect(() => {
    if (!qrExpediente) return;
    cargarQRiousLib()
      .then(() => {
        const canvas = document.getElementById("qr-expediente-modal") as HTMLCanvasElement | null;
        if (canvas) {
          new window.QRious({ element: canvas, value: `${window.location.origin}/personas/expedientes/detalle?id=${qrExpediente.id}`, size: 190, level: "M" });
        }
      })
      .catch(() => {});
  }, [qrExpediente]);

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
                <div key={r.id} className="relative bg-white border border-[var(--gray-200)] rounded-2xl p-4 text-center hover:border-[var(--blue)] transition-colors">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setQrExpediente(r);
                    }}
                    title="Ver código QR"
                    className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center cursor-pointer z-10"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
                    </svg>
                  </span>
                  <button type="button" onClick={() => router.push(`/personas/expedientes/detalle?id=${r.id}`)} className="w-full text-center">
                    {r.fotografia ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.fotografia} alt={r.nombre} className="w-[96px] h-[96px] rounded-full object-cover mx-auto mb-3 border border-[var(--gray-200)]" />
                    ) : (
                      <div className="w-[96px] h-[96px] rounded-full bg-[var(--blue-light)] flex items-center justify-center mx-auto mb-3">
                        <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                      </div>
                    )}
                    <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 mb-0.5 leading-tight">{r.nombre}</p>
                    {(r.puesto || r.categoria) && <p className="text-[10.5px] text-[var(--gray-400)] m-0 mb-1.5">{[r.puesto, r.categoria].filter(Boolean).join(" · ")}</p>}
                    {ultimasEvaluaciones[r.nombre.trim().toLowerCase()] && (
                      <span
                        className={`inline-block text-[10px] font-bold rounded-full px-2 py-0.5 ${colorAciertos(ultimasEvaluaciones[r.nombre.trim().toLowerCase()].aciertos)}`}
                        title={`Última evaluación: ${ultimasEvaluaciones[r.nombre.trim().toLowerCase()].capacitacion}`}
                      >
                        {Math.round(ultimasEvaluaciones[r.nombre.trim().toLowerCase()].aciertos)}% · {ultimasEvaluaciones[r.nombre.trim().toLowerCase()].capacitacion}
                      </span>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
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

      {qrExpediente && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setQrExpediente(null)}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13.5px] font-bold text-[var(--navy)] mb-1">{qrExpediente.nombre}</p>
            <p className="text-[11.5px] text-[var(--gray-400)] mb-4">Escanea para consultar el expediente</p>
            <div className="w-[210px] h-[210px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-4 p-2.5">
              <canvas id="qr-expediente-modal" />
            </div>
            <button type="button" onClick={() => setQrExpediente(null)} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
