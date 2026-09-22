"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import ExpedienteFormModal from "@/components/ExpedienteFormModal";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type ExpedienteResumen = {
  id: number;
  nombre: string;
  puesto: string | null;
  categoria: string | null;
  cuenta: string | null;
  rfc: string | null;
  curp: string | null;
  tipo_personal: string | null;
  fotografia: string | null;
};
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
  const [busqueda, setBusqueda] = useState("");
  const [filtroAbierto, setFiltroAbierto] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "administrativo" | "operador">("todos");
  const [filtroCuenta, setFiltroCuenta] = useState<"todas" | "TMS" | "KN">("todas");

  const filtrosActivos = filtroTipo !== "todos" || filtroCuenta !== "todas";
  const registrosFiltrados = registros.filter((r) => {
    if (filtroTipo !== "todos" && (r.tipo_personal || "operador") !== filtroTipo) return false;
    if (filtroCuenta !== "todas" && r.cuenta !== filtroCuenta) return false;
    if (busqueda.trim()) {
      const q = busqueda.trim().toLowerCase();
      const coincide = [r.nombre, r.puesto, r.rfc, r.curp].some((v) => v && v.toLowerCase().includes(q));
      if (!coincide) return false;
    }
    return true;
  });

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
          <div className="flex flex-wrap items-center gap-2.5 mb-5">
            <button type="button" onClick={() => setModalAbierto(true)} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar / editar registro
            </button>
            <div className="relative flex-1 min-w-[200px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre, puesto, RFC o CURP..."
                className="w-full border border-[var(--gray-200)] rounded-lg pl-9 pr-3 py-2.5 text-[13px]"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setFiltroAbierto((v) => !v)}
                className={`flex items-center gap-2 border rounded-lg px-4 py-2.5 text-[13px] font-bold ${filtrosActivos ? "border-[var(--blue)] text-[var(--blue)] bg-[var(--blue-light)]" : "border-[var(--gray-200)] text-[var(--navy)] bg-white"}`}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 6h16M7 12h10M10 18h4" /></svg>
                Filtrar
                {filtrosActivos && <span className="w-1.5 h-1.5 rounded-full bg-[var(--blue)]" />}
              </button>
              {filtroAbierto && (
                <>
                  <div onClick={() => setFiltroAbierto(false)} className="fixed inset-0 z-40" />
                  <div className="absolute right-0 top-11 bg-white border border-[var(--gray-200)] rounded-xl shadow-lg w-[220px] z-50 p-4 flex flex-col gap-3.5">
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--navy)] uppercase tracking-wide mb-1.5">Tipo de personal</label>
                      <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as any)} className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px] bg-white">
                        <option value="todos">Todos</option>
                        <option value="administrativo">Administrativo</option>
                        <option value="operador">Operador</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10.5px] font-bold text-[var(--navy)] uppercase tracking-wide mb-1.5">Cuenta</label>
                      <select value={filtroCuenta} onChange={(e) => setFiltroCuenta(e.target.value as any)} className="w-full border border-[var(--gray-200)] rounded-lg px-2.5 py-2 text-[12.5px] bg-white">
                        <option value="todas">Todas</option>
                        <option value="TMS">TMS</option>
                        <option value="KN">KN</option>
                      </select>
                    </div>
                    {filtrosActivos && (
                      <button
                        type="button"
                        onClick={() => {
                          setFiltroTipo("todos");
                          setFiltroCuenta("todas");
                        }}
                        className="text-[11.5px] font-bold text-[var(--red)] text-left"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && registros.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay expedientes. Usa &quot;Agregar / editar registro&quot; para crear el primero.</p>
          )}

          {!cargando && registros.length > 0 && registrosFiltrados.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Ningún expediente coincide con la búsqueda o el filtro.</p>
          )}

          {!cargando && registrosFiltrados.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {registrosFiltrados.map((r) => {
                const evaluacion = ultimasEvaluaciones[r.nombre.trim().toLowerCase()];
                return (
                  <div key={r.id} className="relative bg-white border border-[var(--gray-200)] rounded-2xl p-4 hover:border-[var(--blue)] transition-colors">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setQrExpediente(r);
                      }}
                      title="Ver código QR"
                      className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-[var(--gray-100)] flex items-center justify-center cursor-pointer z-10"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                        <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
                      </svg>
                    </span>
                    <button type="button" onClick={() => router.push(`/personas/expedientes/detalle?id=${r.id}`)} className="w-full text-left flex gap-3">
                      {r.fotografia ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.fotografia} alt={r.nombre} className="w-14 h-14 rounded-full object-cover shrink-0 border border-[var(--gray-200)]" />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 pr-5">
                        <p className="text-[13px] font-bold text-[var(--navy)] m-0 leading-tight truncate">{r.nombre}</p>
                        {r.puesto && <p className="text-[11px] text-[var(--gray-400)] m-0 mb-1.5 truncate">{r.puesto}</p>}
                        <p className="text-[10.5px] text-[var(--text)] m-0 leading-[1.6]">
                          No. Empleado: <span className="font-semibold">{String(r.id).padStart(6, "0")}</span>
                        </p>
                        {r.curp && (
                          <p className="text-[10.5px] text-[var(--text)] m-0 leading-[1.6] truncate">
                            CURP: <span className="font-semibold">{r.curp}</span>
                          </p>
                        )}
                        {r.rfc && (
                          <p className="text-[10.5px] text-[var(--text)] m-0 leading-[1.6] truncate">
                            RFC: <span className="font-semibold">{r.rfc}</span>
                          </p>
                        )}
                        {evaluacion && (
                          <span className={`inline-block mt-1.5 text-[9.5px] font-bold rounded-full px-2 py-0.5 ${colorAciertos(evaluacion.aciertos)}`} title={`Última evaluación: ${evaluacion.capacitacion}`}>
                            {Math.round(evaluacion.aciertos)}% · {evaluacion.capacitacion}
                          </span>
                        )}
                      </div>
                    </button>
                  </div>
                );
              })}
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
