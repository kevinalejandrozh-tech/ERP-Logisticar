"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import CampoMoneda from "@/components/CampoMoneda";
import { CONFIG_DEFAULT, NominaConfig, NominaPeriodo, fechaCorta, moneda, sumarDias } from "@/lib/nominaCalculo";
import { ahoraMx, semanaNomina } from "@/lib/asistenciaData";

type Empleado = {
  expediente_id: number;
  nombre: string;
  puesto: string | null;
  sueldo_ofertado: string | null;
  sueldo_semanal: number;
  sueldo_base: number;
  imss: number;
  caja_ahorro: number;
  fonacot: number;
  infonavit: number;
  incluir: boolean;
  notas: string | null;
  configurado: boolean;
};

const ESTILO_ESTADO: Record<string, string> = {
  Abierta: "bg-[#eef3fd] text-[var(--blue)]",
  Cerrada: "bg-[#fff6e0] text-[#a46b00]",
  Pagada: "bg-[#e7f6ee] text-[var(--green)]",
};

// Domingo de inicio de la semana de nómina actual (se paga y se corta el sábado).
function inicioSemanaActual(): string {
  return semanaNomina(ahoraMx().fecha).inicio;
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

export default function NominaPage() {
  const router = useRouter();
  const [pestana, setPestana] = useState<"semanas" | "sueldos">("semanas");
  const [periodos, setPeriodos] = useState<NominaPeriodo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [editados, setEditados] = useState<Record<number, Empleado>>({});
  const [config, setConfig] = useState<NominaConfig>(CONFIG_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const [modalSemana, setModalSemana] = useState(false);
  const [nuevaInicio, setNuevaInicio] = useState("");
  const [nuevaSemana, setNuevaSemana] = useState("");
  const [modalConfig, setModalConfig] = useState(false);
  const [cfgEdit, setCfgEdit] = useState<NominaConfig>(CONFIG_DEFAULT);
  const [guardando, setGuardando] = useState(false);

  // Sin setState antes del primer await (evita renders en cascada al montarse).
  const cargar = useCallback(async () => {
    try {
      const [p, e, c] = await Promise.all([
        pedir<{ periodos: NominaPeriodo[] }>("/api/nomina/periodos"),
        pedir<{ empleados: Empleado[] }>("/api/nomina/empleados"),
        pedir<{ config: NominaConfig }>("/api/nomina/config"),
      ]);
      setPeriodos(p.periodos);
      setEmpleados(e.empleados);
      setEditados({});
      setConfig(c.config);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la nómina.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirNuevaSemana = () => {
    const ultima = periodos[0];
    const inicio = ultima ? sumarDias(ultima.fecha_fin, 1) : inicioSemanaActual();
    const siguiente = semanaNomina(inicio).semana;
    setNuevaInicio(inicio);
    setNuevaSemana(String(siguiente));
    setModalSemana(true);
  };

  const crearSemana = async () => {
    setGuardando(true);
    try {
      const r = await pedir<{ id: number }>("/api/nomina/periodos", {
        method: "POST",
        body: JSON.stringify({ fecha_inicio: nuevaInicio, semana: Number(nuevaSemana) || undefined }),
      });
      router.push(`/personas/nomina/semana?id=${r.id}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo crear la semana.");
      setGuardando(false);
    }
  };

  const generarSemanas = async () => {
    if (!confirm("Se crearán las semanas faltantes desde la semana 1 del año hasta la semana en curso (domingo a sábado: se paga y se corta el sábado). Las existentes no se modifican. ¿Continuar?")) return;
    setGuardando(true);
    try {
      const r = await pedir<{ anio: number; hasta_semana: number; creadas: number }>("/api/nomina/periodos", { method: "POST", body: JSON.stringify({ generar: true }) });
      alert(r.creadas ? `Se crearon ${r.creadas} semana(s) de ${r.anio} (hasta la semana ${r.hasta_semana}).` : "Todas las semanas ya existían.");
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudieron generar las semanas.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarSemana = async (p: NominaPeriodo) => {
    if (!confirm(`¿Eliminar la semana ${p.semana} de ${p.anio}? Solo es posible si no tiene capturas.`)) return;
    try {
      await pedir(`/api/nomina/periodos?id=${p.id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const guardarConfig = async () => {
    setGuardando(true);
    try {
      const r = await pedir<{ config: NominaConfig }>("/api/nomina/config", { method: "PUT", body: JSON.stringify(cfgEdit) });
      setConfig(r.config);
      setModalConfig(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const editarEmpleado = (e: Empleado, cambios: Partial<Empleado>) => setEditados((prev) => ({ ...prev, [e.expediente_id]: { ...(prev[e.expediente_id] || e), ...cambios } }));

  const guardarEmpleado = async (e: Empleado) => {
    const id = e.expediente_id;
    try {
      await pedir("/api/nomina/empleados", { method: "PUT", body: JSON.stringify(e) });
      setEmpleados((prev) => prev.map((x) => (x.expediente_id === id ? { ...e, configurado: true } : x)));
      setEditados((prev) => {
        const copia = { ...prev };
        delete copia[id];
        return copia;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar el sueldo.");
    }
  };

  const pestanaCls = (activa: boolean) =>
    `px-4 py-2.5 text-[13.5px] font-medium border-b-2 -mb-px ${activa ? "border-[var(--navy)] text-[var(--navy)]" : "border-transparent text-[var(--gray-500)] hover:text-[var(--navy)]"}`;

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Nómina"
          subtitulo="Captura semanal, cálculo y recibos de pago del personal."
          backHref="/personas"
          backLabel="Personas"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
              <rect x="2" y="5" width="20" height="14" rx="2" />
              <circle cx="12" cy="12" r="2.8" />
              <path d="M6 9v.01M18 15v.01" />
            </svg>
          }
        />

        <div className="flex flex-wrap gap-2.5 mb-5">
          <button type="button" className="btn btn-primario" onClick={abrirNuevaSemana} disabled={cargando}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            Nueva semana
          </button>
          <Link href="/personas/nomina/dashboard" className="btn btn-secundario">Dashboard</Link>
          <button type="button" className="btn btn-secundario" onClick={generarSemanas} disabled={cargando || guardando}>
            Generar semanas del año
          </button>
          <button type="button" className="btn btn-secundario" onClick={() => { setCfgEdit(config); setModalConfig(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
            Configuración
          </button>
        </div>

        <div className="bg-white border border-[var(--gray-200)] rounded-lg">
          <div className="flex border-b border-[var(--gray-200)] px-2">
            <button type="button" className={pestanaCls(pestana === "semanas")} onClick={() => setPestana("semanas")}>Semanas</button>
            <button type="button" className={pestanaCls(pestana === "sueldos")} onClick={() => setPestana("sueldos")}>Sueldos del personal</button>
          </div>

          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : pestana === "semanas" ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[640px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Semana</th>
                    <th className="px-4 py-3 font-medium">Periodo</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium text-right">Total de personal</th>
                    <th className="px-4 py-3 font-medium text-right">Capturados</th>
                    <th className="px-4 py-3 font-medium text-right">Total neto</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {periodos.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[var(--gray-500)]">Aún no hay semanas. Crea la semana 1 con “Nueva semana”.</td></tr>
                  )}
                  {periodos.map((p) => (
                    <tr key={p.id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)]">
                      <td className="px-4 py-3 font-medium text-[var(--navy)]">Semana {p.semana} · {p.anio}</td>
                      <td className="px-4 py-3 text-[var(--gray-500)]">{fechaCorta(p.fecha_inicio)} – {fechaCorta(p.fecha_fin)}</td>
                      <td className="px-4 py-3"><span className={`inline-block rounded px-2 py-0.5 text-[11.5px] font-medium ${ESTILO_ESTADO[p.estado] || ""}`}>{p.estado}</span></td>
                      <td className="px-4 py-3 text-right">{p.total_personal ?? "—"}</td>
                      <td className="px-4 py-3 text-right">{p.empleados ?? 0}</td>
                      <td className="px-4 py-3 text-right font-medium">{moneda(p.total_neto ?? 0)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <Link href={`/personas/nomina/semana?id=${p.id}`} className="btn btn-secundario py-1.5">Abrir</Link>
                        {p.estado === "Abierta" && !p.empleados && (
                          <button type="button" onClick={() => eliminarSemana(p)} className="ml-2 text-[12.5px] text-[var(--red)] hover:underline">Eliminar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <p className="px-4 pt-4 text-[12.5px] text-[var(--gray-500)]">
                Resumen rápido. Los conceptos completos (IMSS, caja de ahorro, Fonacot, Infonavit, licencia federal y préstamos) se editan en el expediente de cada persona, sección Nómina.
              </p>
              <table className="w-full text-[13px] min-w-[720px] mt-2">
                <thead>
                  <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-4 py-3 font-medium">Puesto</th>
                    <th className="px-4 py-3 font-medium">Sueldo ofertado semanal</th>
                    <th className="px-4 py-3 font-medium">Sueldo base (BBVA)</th>
                    <th className="px-4 py-3 font-medium text-center">En nómina</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {empleados.map((e0) => {
                    const e = editados[e0.expediente_id] || e0;
                    const sucio = !!editados[e0.expediente_id];
                    return (
                      <tr key={e.expediente_id} className="border-t border-[var(--gray-200)]">
                        <td className="px-4 py-2.5 font-medium text-[var(--navy)]"><Link href={`/personas/expedientes/detalle?id=${e.expediente_id}`} className="hover:underline">{e.nombre}</Link></td>
                        <td className="px-4 py-2.5 text-[var(--gray-500)]">{e.puesto || "—"}</td>
                        <td className="px-4 py-2.5">
                          <CampoMoneda valor={e.sueldo_semanal} ariaLabel="Sueldo ofertado semanal" onCambio={(n) => editarEmpleado(e0, { sueldo_semanal: n })} className="max-w-[160px]" />
                          {!e0.configurado && !sucio && <span className="block text-[11px] text-[var(--amber)] mt-0.5">Sugerido, sin guardar</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <CampoMoneda valor={e.sueldo_base} ariaLabel="Sueldo base" onCambio={(n) => editarEmpleado(e0, { sueldo_base: n })} className="max-w-[150px]" />
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <input type="checkbox" checked={e.incluir} onChange={(ev) => editarEmpleado(e0, { incluir: ev.target.checked })} className="w-4 h-4 accent-[var(--navy)]" />
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button type="button" disabled={!sucio && e0.configurado} onClick={() => guardarEmpleado(e)} className="btn btn-primario py-1.5">
                            Guardar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {empleados.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay personal activo en Expedientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-[11.5px] text-[var(--gray-500)] mt-3 mb-8">
          Regla vigente: salario diario = sueldo semanal ÷ {config.dias_base} · {config.retardos_por_falta > 0 ? `${config.retardos_por_falta} retardos = 1 falta` : "los retardos no generan descuento"}.
          Recibo interno, no fiscal.
        </p>
      </div>

      {modalSemana && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-16 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[420px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] mb-4">Nueva semana de nómina</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Número de semana</label>
                <input type="number" min={1} max={53} value={nuevaSemana} onChange={(e) => setNuevaSemana(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Fecha de inicio</label>
                <input type="date" value={nuevaInicio} onChange={(e) => setNuevaInicio(e.target.value)} className={inputCls} />
              </div>
            </div>
            {nuevaInicio && <p className="text-[12.5px] text-[var(--gray-500)] mt-3">Periodo: {fechaCorta(nuevaInicio)} al {fechaCorta(sumarDias(nuevaInicio, 6))} · corte y pago en sábado</p>}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setModalSemana(false)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={guardando || !nuevaInicio} onClick={crearSemana}>{guardando ? "Creando…" : "Crear semana"}</button>
            </div>
          </div>
        </div>
      )}

      {modalConfig && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-16 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[460px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] mb-1">Configuración de nómina</h3>
            <p className="text-[12.5px] text-[var(--gray-500)] mb-4">Define cómo se descuentan faltas y retardos. Aplica a las capturas que se guarden después del cambio.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Días base (divisor)</label>
                <input type="number" min={1} max={31} step="0.5" value={cfgEdit.dias_base} onChange={(e) => setCfgEdit({ ...cfgEdit, dias_base: Number(e.target.value) })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Retardos por falta</label>
                <input type="number" min={0} value={cfgEdit.retardos_por_falta} onChange={(e) => setCfgEdit({ ...cfgEdit, retardos_por_falta: Number(e.target.value) })} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Empresa (encabezado del recibo)</label>
                <input type="text" value={cfgEdit.empresa} onChange={(e) => setCfgEdit({ ...cfgEdit, empresa: e.target.value })} className={inputCls} />
              </div>
            </div>
            <p className="text-[11.5px] text-[var(--gray-500)] mt-3">Ejemplo: con 7 días base, una falta descuenta sueldo ÷ 7. Con 0 retardos por falta, los retardos no descuentan.</p>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setModalConfig(false)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardarConfig}>{guardando ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
