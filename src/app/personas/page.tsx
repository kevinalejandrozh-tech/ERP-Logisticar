"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import MenuCard from "@/components/MenuCard";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const OPCIONES_EMPRESA = ["Logisticar", "Fleetlogis"];

export default function PersonasPage() {
  const [credencialAbierta, setCredencialAbierta] = useState(false);
  const [operadores, setOperadores] = useState<string[]>([]);
  const [cOperador, setCOperador] = useState("");
  const [cEmpresa, setCEmpresa] = useState(OPCIONES_EMPRESA[0]);

  useEffect(() => {
    fetch("/api/operadores/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOperadores((data.registros || []).map((o: { nombre: string }) => o.nombre)))
      .catch(() => {
        // si falla, el select queda vacío y se puede reintentar cerrando y abriendo el formulario
      });
  }, []);

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
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-5">
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>}
              titulo="Registrar asistencia"
              descripcion="Registra entradas, salidas y asistencia del personal."
            />
            <MenuCard
              href="/personas/mochilas-covid"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>}
              titulo="Mochilas Covid"
              descripcion="Administra la asignación y revisión de mochilas Covid."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 8h.01M9 12h.01M9 16h.01M13 8h2M13 12h2M13 16h2" /></svg>}
              titulo="Asignación de radios"
              descripcion="Gestiona la asignación de radios de comunicación."
            />
            <MenuCard
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
              titulo="Expedientes"
              descripcion="Consulta y administra los expedientes del personal."
            />
            <MenuCard
              href="/personas/operadores"
              icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /><path d="M19 8v6M22 11h-6" /></svg>}
              titulo="Agregar / Administrar personas"
              descripcion="Da de alta o edita la información del personal."
            />
          </div>
        </div>
        <PageFooter />
      </div>

      {credencialAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Crear credencial</h3>

            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre del operador</label>
              {operadores.length === 0 ? (
                <p className="text-[12.5px] text-[var(--red)]">No hay operadores registrados. Agrégalos en &quot;Agregar / Administrar personas&quot;.</p>
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
