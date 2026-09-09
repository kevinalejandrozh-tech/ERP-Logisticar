"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import ExpedienteFormModal, { ExpedienteData } from "@/components/ExpedienteFormModal";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type ExpedienteCompleto = ExpedienteData & { id: number; fecha_ingreso: string | null };

function formatoFecha(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
}
function descargarArchivo(dataUrl: string, nombreArchivo: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const CAMPO: { label: string; key: keyof ExpedienteCompleto }[] = [
  { label: "Categoría", key: "categoria" },
  { label: "Puesto", key: "puesto" },
  { label: "Unidad que maneja", key: "unidad_maneja" },
  { label: "Tipo de viajes", key: "tipo_viajes" },
  { label: "Cuenta", key: "cuenta" },
  { label: "Sueldo ofertado", key: "sueldo_ofertado" },
  { label: "Radio asignado", key: "radio_asignado" },
];

export default function DetalleExpedientePage() {
  const [registro, setRegistro] = useState<ExpedienteCompleto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);

  const cargar = () => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      setError("Falta el identificador del expediente.");
      setCargando(false);
      return;
    }
    fetch(`/api/expedientes/get?id=${id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) throw new Error(data.error || "No se encontró el expediente.");
        setRegistro(data.registro);
      })
      .catch((err) => setError(err.message || "No se encontró el expediente."))
      .finally(() => setCargando(false));
  };
  useEffect(() => {
    cargar();
  }, []);

  const eliminar = async () => {
    if (!registro || !confirm(`¿Eliminar el expediente de ${registro.nombre}? Esta acción no se puede deshacer.`)) return;
    try {
      await fetch("/api/expedientes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: registro.id }) });
      window.location.href = "/personas/expedientes";
    } catch {
      alert("No se pudo eliminar el expediente.");
    }
  };

  const archivos: { label: string; valor: string | undefined; nombre: string }[] = registro
    ? [
        { label: "RFC (PDF)", valor: registro.rfc_pdf, nombre: `RFC_${registro.nombre}.pdf` },
        { label: "CURP (PDF)", valor: registro.curp_pdf, nombre: `CURP_${registro.nombre}.pdf` },
        { label: "NSS (PDF)", valor: registro.nss_pdf, nombre: `NSS_${registro.nombre}.pdf` },
        { label: "Tipo de licencia (PDF)", valor: registro.tipo_licencia_pdf, nombre: `Licencia_${registro.nombre}.pdf` },
      ]
    : [];

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[840px] mx-auto px-4 sm:px-6 md:px-10 pt-6 md:pt-10">
        <PageHeader
          titulo="Expediente"
          subtitulo="Consulta, descarga o edita la información del colaborador."
          backHref="/personas/expedientes"
          backLabel="Expedientes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
        />

        {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-16">Cargando...</p>}
        {error && <p className="text-center text-[var(--red)] text-[13px] py-16">{error}</p>}

        {registro && (
          <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-4">
                {registro.fotografia ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={registro.fotografia} alt={registro.nombre} className="w-[80px] h-[80px] rounded-full object-cover border border-[var(--gray-200)]" />
                ) : (
                  <div className="w-[80px] h-[80px] rounded-full bg-[var(--blue-light)] flex items-center justify-center">
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                  </div>
                )}
                <div>
                  <h2 className="text-[19px] font-bold text-[var(--navy)] m-0 mb-1">{registro.nombre}</h2>
                  <p className="text-[12.5px] text-[var(--gray-400)] m-0">Fecha de ingreso: {formatoFecha(registro.fecha_ingreso)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button type="button" onClick={() => setEditando(true)} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                  Editar
                </button>
                <button type="button" onClick={eliminar} className="flex items-center gap-1.5 bg-white text-[var(--red)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                  Eliminar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 mb-6">
              <div>
                <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-0.5">RFC</p>
                <p className="text-[13.5px] text-[var(--navy)] font-semibold m-0">{registro.rfc || "—"}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-0.5">CURP</p>
                <p className="text-[13.5px] text-[var(--navy)] font-semibold m-0">{registro.curp || "—"}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-0.5">NSS</p>
                <p className="text-[13.5px] text-[var(--navy)] font-semibold m-0">{registro.nss || "—"}</p>
              </div>
              <div>
                <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-0.5">Tipo de licencia</p>
                <p className="text-[13.5px] text-[var(--navy)] font-semibold m-0">{registro.tipo_licencia || "—"}</p>
              </div>
              {CAMPO.map((c) => (
                <div key={c.key}>
                  <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-0.5">{c.label}</p>
                  <p className="text-[13.5px] text-[var(--navy)] font-semibold m-0">{(registro[c.key] as string) || "—"}</p>
                </div>
              ))}
            </div>

            {registro.resultados_evaluacion && (
              <div className="mb-6">
                <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-1">Resultados generales de evaluación</p>
                <p className="text-[13.5px] text-[var(--text)] m-0 whitespace-pre-line leading-relaxed bg-[var(--gray-100)] rounded-lg p-3">{registro.resultados_evaluacion}</p>
              </div>
            )}

            <div>
              <p className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase m-0 mb-2">Documentos</p>
              <div className="flex flex-wrap gap-2">
                {archivos.filter((a) => a.valor).length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] m-0">Sin documentos adjuntos.</p>}
                {archivos
                  .filter((a) => a.valor)
                  .map((a) => (
                    <button
                      key={a.label}
                      type="button"
                      onClick={() => descargarArchivo(a.valor as string, a.nombre)}
                      className="flex items-center gap-1.5 bg-[var(--gray-100)] text-[var(--navy)] rounded-lg px-3.5 py-2 text-[12px] font-bold"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                      {a.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        )}
        <PageFooter />
      </div>

      {editando && registro && (
        <ExpedienteFormModal
          inicial={{ ...registro, fecha_ingreso: registro.fecha_ingreso ? registro.fecha_ingreso.slice(0, 10) : "" }}
          onCancelar={() => setEditando(false)}
          onGuardado={() => {
            setEditando(false);
            setCargando(true);
            cargar();
          }}
        />
      )}
    </div>
  );
}
