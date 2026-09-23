"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const DIAS_VISIBLES = 14;
const PASO_NAVEGACION = 7;

type PersonaAsistencia = { id: number; nombre: string; puesto: string | null; porcentaje: number; inasistencias: number; marcas: Record<string, boolean> };

function formatoISO(d: Date) {
  return d.toISOString().slice(0, 10);
}
function sumarDias(iso: string, dias: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return formatoISO(d);
}
function etiquetaDia(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return { dia: d.toLocaleDateString("es-MX", { day: "2-digit", timeZone: "UTC" }), mes: d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }), sem: d.toLocaleDateString("es-MX", { weekday: "short", timeZone: "UTC" }) };
}

export default function AsistenciaDiariaPage() {
  const [inicioVentana, setInicioVentana] = useState(() => sumarDias(formatoISO(new Date()), -(DIAS_VISIBLES - 1)));
  const [personas, setPersonas] = useState<PersonaAsistencia[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  const dias = useMemo(() => Array.from({ length: DIAS_VISIBLES }, (_, i) => sumarDias(inicioVentana, i)), [inicioVentana]);
  const hoy = formatoISO(new Date());
  const finVentana = dias[dias.length - 1];

  const cargar = () => {
    setCargando(true);
    fetch(`/api/asistencia-diaria?desde=${inicioVentana}&hasta=${finVentana}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPersonas(d.personas || []))
      .catch(() => setPersonas([]))
      .finally(() => setCargando(false));
  };
  useEffect(cargar, [inicioVentana]);

  const alternar = async (personaId: number, fecha: string, valorActual: boolean) => {
    const nuevo = !valorActual;
    setPersonas((prev) => prev.map((p) => (p.id === personaId ? { ...p, marcas: { ...p.marcas, [fecha]: nuevo } } : p)));
    try {
      const res = await fetch("/api/asistencia-diaria", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expediente_id: personaId, fecha, presente: nuevo }) });
      if (!res.ok) throw new Error();
      cargar(); // refresca % e inasistencias, que dependen del historial completo
    } catch {
      alert("No se pudo guardar la asistencia.");
      cargar();
    }
  };

  const personasFiltradas = busqueda.trim() ? personas.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase())) : personas;

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 pb-10">
        <PageHeader
          titulo="Asistencia diaria"
          subtitulo="Marca la asistencia de cada persona por día."
          backHref="/personas/expedientes"
          backLabel="Expedientes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px] max-w-[320px]">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.2" className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
              </svg>
              <input type="text" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar nombre..." className="w-full border border-[var(--gray-200)] rounded-lg pl-9 pr-3 py-2.5 text-[13px]" />
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setInicioVentana((v) => sumarDias(v, -PASO_NAVEGACION))} className="w-9 h-9 rounded-lg border border-[var(--gray-200)] flex items-center justify-center text-[var(--navy)]" title="Días anteriores">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M15 6l-6 6 6 6" /></svg>
              </button>
              <span className="text-[12.5px] font-bold text-[var(--navy)] whitespace-nowrap">
                {etiquetaDia(inicioVentana).dia} {etiquetaDia(inicioVentana).mes} — {etiquetaDia(finVentana).dia} {etiquetaDia(finVentana).mes}
              </span>
              <button type="button" onClick={() => setInicioVentana((v) => sumarDias(v, PASO_NAVEGACION))} className="w-9 h-9 rounded-lg border border-[var(--gray-200)] flex items-center justify-center text-[var(--navy)]" title="Días siguientes">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M9 6l6 6-6 6" /></svg>
              </button>
              <button
                type="button"
                onClick={() => setInicioVentana(sumarDias(formatoISO(new Date()), -(DIAS_VISIBLES - 1)))}
                className="text-[11.5px] font-bold text-[var(--blue)] ml-1"
              >
                Hoy
              </button>
            </div>
          </div>

          {cargando && <p className="text-center text-[13px] text-[var(--gray-400)] py-10">Cargando...</p>}
          {!cargando && personasFiltradas.length === 0 && <p className="text-center text-[13px] text-[var(--gray-400)] py-10">No hay personas para mostrar.</p>}

          {!cargando && personasFiltradas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-[var(--navy)] text-white text-left text-[10.5px] uppercase tracking-wide px-3 py-2.5 min-w-[240px] z-10">Nombre</th>
                    {dias.map((f) => {
                      const et = etiquetaDia(f);
                      const esHoy = f === hoy;
                      return (
                        <th key={f} className={`text-center text-[9.5px] uppercase px-1.5 py-2 min-w-[42px] ${esHoy ? "bg-[var(--blue)] text-white" : "bg-[var(--gray-100)] text-[var(--gray-400)]"}`}>
                          <div className="leading-tight">
                            <div>{et.sem}</div>
                            <div className="font-bold text-[11px]">{et.dia}</div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {personasFiltradas.map((p) => (
                    <tr key={p.id} className="border-b border-[var(--gray-100)]">
                      <td className="sticky left-0 bg-white text-left px-3 py-2 min-w-[240px] border-r border-[var(--gray-200)]">
                        <div className="flex items-center gap-2">
                          <span className={`text-[12px] font-bold shrink-0 ${p.porcentaje >= 90 ? "text-[var(--green)]" : p.porcentaje >= 70 ? "text-[var(--amber)]" : "text-[var(--red)]"}`}>{p.porcentaje}%</span>
                          {p.inasistencias > 0 && <span className="text-[10.5px] font-bold text-[var(--red)] shrink-0">-{p.inasistencias}</span>}
                          <span className="text-[12.5px] font-semibold text-[var(--navy)] truncate">{p.nombre}</span>
                        </div>
                      </td>
                      {dias.map((f) => {
                        const marcado = !!p.marcas[f];
                        const esFuturo = f > hoy;
                        return (
                          <td key={f} className="text-center px-1 py-2">
                            <input
                              type="checkbox"
                              checked={marcado}
                              disabled={esFuturo}
                              onChange={() => alternar(p.id, f, marcado)}
                              className="w-4 h-4 accent-[var(--green)] disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
