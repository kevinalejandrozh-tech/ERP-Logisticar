"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import MenuCard from "@/components/MenuCard";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

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
const OPCIONES_EMPRESA = ["Logisticar", "Fleetlogis"];

export default function PersonasPage() {
  const [credencialAbierta, setCredencialAbierta] = useState(false);
  const [operadores, setOperadores] = useState<string[]>([]);
  const [cOperador, setCOperador] = useState("");
  const [cEmpresa, setCEmpresa] = useState(OPCIONES_EMPRESA[0]);
  const [puestosAbierto, setPuestosAbierto] = useState(false);
  const [puestos, setPuestos] = useState<string[]>([]);
  const [cargandoPuestos, setCargandoPuestos] = useState(false);
  const [puestoSel, setPuestoSel] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [esSysadmin, setEsSysadmin] = useState(false);
  const linkEvaluacion = (p: string) => `${typeof window !== "undefined" ? window.location.origin : ""}/personas/evaluacion-candidatos/formulario?puesto=${encodeURIComponent(p)}`;

  const elegirPuesto = (p: string) => {
    setPuestoSel(p);
    setQrDataUrl("");
    setCopiado(false);
    cargarQRiousLib()
      .then(() => setQrDataUrl(new window.QRious({ value: linkEvaluacion(p), size: 220, level: "M" }).toDataURL()))
      .catch(() => setQrDataUrl(""));
  };
  const copiarLink = async () => {
    if (!puestoSel) return;
    try {
      await navigator.clipboard.writeText(linkEvaluacion(puestoSel));
      setCopiado(true);
    } catch {
      prompt("Copia el link:", linkEvaluacion(puestoSel));
    }
  };

  useEffect(() => {
    // Documentos de candidatos (enlace general): la tarjeta solo se muestra al sysadmin.
    fetch("/api/auth/sesion", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setEsSysadmin(d?.rol === "sysadmin"))
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("/api/operadores/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOperadores((data.registros || []).map((o: { nombre: string }) => o.nombre)))
      .catch(() => {
        // si falla, el select queda vacío y se puede reintentar cerrando y abriendo el formulario
      });
  }, []);

  // Evaluación de candidatos: los puestos salen de la columna PUESTO del Cuadro Básico.
  const abrirPuestos = () => {
    setPuestoSel(null);
    setPuestosAbierto(true);
    setCargandoPuestos(true);
    fetch("/api/cuadro-basico", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        const unicos = Array.from(
          new Set(((data.filas || []) as { puesto: string | null }[]).map((f) => (f.puesto || "").trim()).filter(Boolean))
        ).sort((a, b) => a.localeCompare(b, "es"));
        setPuestos(unicos);
      })
      .catch(() => setPuestos([]))
      .finally(() => setCargandoPuestos(false));
  };

  const abrirCredencial = () => {
    setCOperador(operadores[0] || "");
    setCEmpresa(OPCIONES_EMPRESA[0]);
    setCredencialAbierta(true);
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Personas"
          subtitulo="Gestiona la información y trámites del personal."
          backHref="/"
          backLabel="Menú principal"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
              <circle cx="9" cy="8" r="3.5" />
              <path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
              <circle cx="18" cy="9" r="2.6" />
              <path d="M15 14c2.9.2 5.5 2.4 5.5 6.5" />
            </svg>
          }
        />

        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
          <button type="button" onClick={abrirCredencial} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="8" cy="12" r="2.3" /><path d="M13.5 10.5h6M13.5 13.5h4.5" /></svg>
            Crear credencial
          </button>
          <Link href="/personas/documentos" className="btn btn-secundario px-5 py-2.5 text-[13px] font-bold rounded-lg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
            Documentos
          </Link>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-5">
            <MenuCard
              href="/personas/expedientes/asistencia"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>}
              titulo="Asistencia diaria"
              descripcion="Registra la asistencia diaria del personal."
            />
            <MenuCard
              href="/personas/mochilas-covid"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>}
              titulo="Mochilas Covid"
              descripcion="Administra la asignación y revisión de mochilas Covid."
            />
            <MenuCard
              href="/personas/expedientes"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
              titulo="Personas"
              descripcion="Consulta y administra los expedientes del personal."
            />
            <MenuCard
              href="/personas/capacitaciones"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M2 8l10-4 10 4-10 4-10-4z" /><path d="M6 10v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" /><path d="M22 8v6" /></svg>}
              titulo="Capacitaciones"
              descripcion="Consulta el catálogo de capacitaciones y sus evaluaciones."
            />
            <MenuCard
              href="/personas/uniformes"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M16 4l4 3v4h-3v9H7v-9H4V7l4-3" /><path d="M9 4a3 3 0 006 0" /></svg>}
              titulo="Uniformes"
              descripcion="Registra tallas asignadas y genera la responsiva de entrega."
            />
            <MenuCard
              onClick={abrirPuestos}
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" /></svg>}
              titulo="Evaluación Candidatos"
              descripcion="Aplica la evaluación de ingreso según el puesto."
            />
            <MenuCard
              href="/personas/evaluaciones-candidatos"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>}
              titulo="Evaluaciones enviadas"
              descripcion="Consulta resultados de candidatos e imprime su dictamen."
            />
            {esSysadmin && (
              <MenuCard
                href="/personas/documentos-candidatos"
                icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M12 18v-6M9 15l3-3 3 3" /></svg>}
                titulo="Documentos de candidatos"
                descripcion="Comparte el enlace de carga y consulta los registros completos e incompletos."
              />
            )}
            <MenuCard
              href="/personas/nomina"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="2" y="5" width="20" height="14" rx="2" /><circle cx="12" cy="12" r="2.8" /><path d="M6 9v.01M18 15v.01" /></svg>}
              titulo="Nómina"
              descripcion="Captura semanal de sueldos, descuentos e incentivos y genera recibos."
            />
            <MenuCard
              href="/personas/nomina/dashboard"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>}
              titulo="Dashboard de nómina"
              descripcion="Finanzas de la nómina: total pagado, depósitos BBVA/viáticos, percepciones y deducciones."
            />
          </div>
        </div>
      </div>

      {puestosAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[560px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-1">Evaluación Candidatos</h3>
            {puestoSel ? (
              <>
                <p className="text-[12.5px] text-[var(--gray-400)] mb-4">
                  Puesto: <b className="text-[var(--navy)]">{puestoSel}</b> · Comparte el link o el QR con tu candidato. No necesita cuenta.
                </p>
                <div className="flex flex-col items-center gap-3">
                  {qrDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qrDataUrl} alt="QR de la evaluación" className="w-[200px] h-[200px] border border-[var(--gray-200)] rounded-lg p-2" />
                  ) : (
                    <div className="w-[200px] h-[200px] border border-[var(--gray-200)] rounded-lg flex items-center justify-center text-[12px] text-[var(--gray-400)]">Generando QR…</div>
                  )}
                  <div className="w-full bg-[var(--gray-100)] rounded-lg px-3 py-2 text-[11.5px] break-all text-[var(--navy)]">{linkEvaluacion(puestoSel)}</div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button type="button" onClick={copiarLink} className="bg-[var(--navy)] text-white rounded-lg px-4 py-2.5 text-[13px] font-bold">
                      {copiado ? "✓ Link copiado" : "Copiar link"}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Hola, te compartimos la evaluación para el puesto de ${puestoSel} en Transportes Logisticar: ${linkEvaluacion(puestoSel)}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-[#21a866] text-white rounded-lg px-4 py-2.5 text-[13px] font-bold"
                    >
                      Enviar por WhatsApp
                    </a>
                    {qrDataUrl && (
                      <a href={qrDataUrl} download={`QR_Evaluacion_${puestoSel.replace(/\s+/g, "_")}.png`} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[13px] font-bold">
                        Descargar QR
                      </a>
                    )}
                    <Link href={`/personas/evaluacion-candidatos/formulario?puesto=${encodeURIComponent(puestoSel)}`} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[13px] font-bold">
                      Abrir aquí
                    </Link>
                  </div>
                  <button type="button" onClick={() => setPuestoSel(null)} className="text-[12.5px] text-[var(--blue)] font-semibold">
                    ← Elegir otro puesto
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[12.5px] text-[var(--gray-400)] mb-4">Selecciona el puesto al que aplica el candidato.</p>
                {cargandoPuestos ? (
                  <p className="text-[13px] text-[var(--gray-400)]">Cargando puestos…</p>
                ) : puestos.length === 0 ? (
                  <p className="text-[12.5px] text-[var(--red)]">No hay puestos registrados. Captúralos en la columna PUESTO del Cuadro Básico.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[55vh] overflow-y-auto">
                    {puestos.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => elegirPuesto(p)}
                        className="border border-[var(--gray-200)] hover:border-[var(--blue)] hover:bg-[var(--blue-light)] rounded-lg px-4 py-3 text-[13px] font-bold text-[var(--navy)] text-left"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setPuestosAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {credencialAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Crear credencial</h3>

            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre del operador</label>
              {operadores.length === 0 ? (
                <p className="text-[12.5px] text-[var(--red)]">No hay operadores registrados. Regístralos en &quot;Expedientes&quot; como personal tipo Operador.</p>
              ) : (
                <select value={cOperador} onChange={(e) => setCOperador(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]">
                  {operadores.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Empresa</label>
              <select value={cEmpresa} onChange={(e) => setCEmpresa(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]">
                {OPCIONES_EMPRESA.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setCredencialAbierta(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Generar credencial
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
