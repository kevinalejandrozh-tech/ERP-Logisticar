"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { exportarExcel } from "@/lib/exportExcel";
import { imprimirRecibos } from "@/lib/nominaRecibo";
import {
  CONFIG_DEFAULT,
  CreditoEstado,
  DEFAULTS_EMPLEADO,
  NominaCaptura,
  NominaConfig,
  NominaPeriodo,
  NominaRegistro,
  calcularTotales,
  fechaCorta,
  moneda,
  redondear,
} from "@/lib/nominaCalculo";
import { AsistenciaRegistro, DIAS_CORTOS, ESTILO_TIPO, claveVisual, sumarDiasIso } from "@/lib/asistenciaData";

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

type Datos = {
  periodo: NominaPeriodo;
  config: NominaConfig;
  registros: NominaRegistro[];
  propuestas: Record<number, NominaCaptura>;
  asistencia: Record<number, AsistenciaRegistro[]>;
  creditos: Record<number, CreditoEstado[]>;
  caja: Record<number, number>;
  total_personal: number;
};

const ESTILO_ESTADO: Record<string, string> = {
  Abierta: "bg-[#eef3fd] text-[var(--blue)]",
  Cerrada: "bg-[#fff6e0] text-[#a46b00]",
  Pagada: "bg-[#e7f6ee] text-[var(--green)]",
};

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white disabled:bg-[var(--gray-100)]";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";
const h4Cls = "text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-2";

type CampoNum = { campo: keyof NominaCaptura; etiqueta: string; paso?: string };
const ASISTENCIA: CampoNum[] = [
  { campo: "dias_asistidos", etiqueta: "Días trabajados", paso: "0.5" },
  { campo: "faltas", etiqueta: "Faltas", paso: "0.5" },
  { campo: "retardos", etiqueta: "Retardos", paso: "1" },
];
const PERCEPCIONES: CampoNum[] = [
  { campo: "sueldo_semanal", etiqueta: "Sueldo ofertado (semanal)" },
  { campo: "bonos", etiqueta: "Bonos" },
  { campo: "otros_incentivos", etiqueta: "Otros incentivos" },
];
const DEDUCCIONES: CampoNum[] = [
  { campo: "imss", etiqueta: "IMSS" },
  { campo: "caja_ahorro", etiqueta: "Caja de ahorro" },
  { campo: "fonacot", etiqueta: "Fonacot" },
  { campo: "infonavit", etiqueta: "Infonavit" },
  { campo: "otros_descuentos", etiqueta: "Otros descuentos" },
];

export default function NominaSemanaPage() {
  return (
    <Suspense fallback={<p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>}>
      <SemanaNomina />
    </Suspense>
  );
}

function SemanaNomina() {
  const periodoId = Number(useSearchParams().get("id")) || null;
  const [d, setD] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(periodoId !== null);
  const [error, setError] = useState(periodoId ? "" : "No se indicó la semana.");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<NominaRegistro | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [baseSemana, setBaseSemana] = useState("");

  // Sin setState antes del primer await (evita renders en cascada al montarse).
  const cargar = useCallback(async (id: number) => {
    try {
      const r = await pedir<Datos>(`/api/nomina/semana?id=${id}`);
      setError("");
      setD(r);
      setBaseSemana(String(r.periodo.sueldo_base ?? DEFAULTS_EMPLEADO.sueldo_base));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la semana.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (periodoId) cargar(periodoId);
  }, [periodoId, cargar]);

  const periodo = d?.periodo || null;
  const config = d?.config || CONFIG_DEFAULT;
  const registros = useMemo(() => d?.registros || [], [d]);
  const abierta = periodo?.estado === "Abierta";
  const guardados = registros.filter((r) => r.id !== null);
  const pendientes = registros.length - guardados.length;
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? registros.filter((r) => r.nombre.toLowerCase().includes(q) || (r.puesto || "").toLowerCase().includes(q)) : registros;
  }, [registros, busqueda]);
  const suma = (k: keyof NominaRegistro) => redondear(guardados.reduce((a, r) => a + (Number(r[k]) || 0), 0));
  const dias = periodo ? Array.from({ length: 7 }, (_, i) => sumarDiasIso(periodo.fecha_inicio, i)) : [];

  const guardarRegistro = async (r: NominaRegistro) => {
    await pedir("/api/nomina/registros", { method: "PUT", body: JSON.stringify({ ...r, periodo_id: periodoId }) });
  };

  const guardarEdicion = async () => {
    if (!editando || !periodoId) return;
    setGuardando(true);
    try {
      await guardarRegistro(editando);
      setEditando(null);
      await cargar(periodoId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const descartar = async () => {
    if (!editando || !periodoId || editando.id === null) return;
    if (!confirm("¿Descartar la captura guardada? Se quitan también los abonos de créditos de esta semana.")) return;
    try {
      await pedir(`/api/nomina/registros?periodo_id=${periodoId}&expediente_id=${editando.expediente_id}`, { method: "DELETE" });
      setEditando(null);
      await cargar(periodoId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo descartar.");
    }
  };

  const guardarPendientes = async () => {
    if (!periodoId) return;
    const lista = registros.filter((r) => r.id === null);
    if (!lista.length || !confirm(`Se guardarán ${lista.length} propuesta(s) tal como aparecen (incluye abonos de créditos). ¿Continuar?`)) return;
    setGuardando(true);
    try {
      for (const r of lista) await guardarRegistro(r);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudieron guardar todas.");
    } finally {
      await cargar(periodoId);
      setGuardando(false);
    }
  };

  const aplicarBase = async (individual: boolean) => {
    if (!periodoId) return;
    const msg = individual
      ? "Cada persona usará su sueldo base individual (expediente). ¿Continuar?"
      : `Se aplicará ${moneda(Number(baseSemana) || 0)} como sueldo base (depósito BBVA) a todas las personas de esta semana, incluidas las capturas guardadas. ¿Continuar?`;
    if (!confirm(msg)) return;
    try {
      await pedir("/api/nomina/periodos", { method: "PATCH", body: JSON.stringify({ id: periodoId, sueldo_base: individual ? null : Number(baseSemana) || 0 }) });
      await cargar(periodoId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo aplicar.");
    }
  };

  const cambiarEstado = async (estado: "Abierta" | "Cerrada" | "Pagada") => {
    if (!periodoId) return;
    const mensajes = {
      Cerrada: pendientes ? `Hay ${pendientes} empleado(s) sin guardar que no se incluirán. ¿Cerrar la semana?` : "¿Cerrar la semana? Ya no se podrá editar.",
      Pagada: "¿Marcar la semana como pagada?",
      Abierta: "¿Reabrir la semana para editarla?",
    };
    if (!confirm(mensajes[estado])) return;
    try {
      await pedir("/api/nomina/periodos", { method: "PATCH", body: JSON.stringify({ id: periodoId, estado }) });
      await cargar(periodoId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  };

  const recibos = (lista: NominaRegistro[]) => {
    if (!periodo || !d) return;
    if (!lista.length) return alert("Primero guarda la nómina de al menos un empleado.");
    imprimirRecibos(lista, periodo, config, { creditos: d.creditos, caja: d.caja });
  };

  const exportar = () => {
    if (!periodo) return;
    exportarExcel(`Nomina_S${String(periodo.semana).padStart(2, "0")}_${periodo.anio}.xlsx`, [
      {
        nombre: `Semana ${periodo.semana}`,
        filas: guardados.map((r) => ({
          Folio: r.folio, Nombre: r.nombre, Puesto: r.puesto || "",
          "Sueldo ofertado": r.sueldo_semanal, "Días trabajados": r.dias_asistidos, Faltas: r.faltas, Retardos: r.retardos,
          Bonos: r.bonos, "Otros incentivos": r.otros_incentivos, "Total percepciones": r.total_percepciones,
          "Desc. faltas/retardos": r.descuento_faltas, IMSS: r.imss, "Caja de ahorro": r.caja_ahorro, Fonacot: r.fonacot, Infonavit: r.infonavit,
          "Licencia federal": r.licencia_federal, "Préstamo personal": r.prestamo, "Otros descuentos": r.otros_descuentos,
          "Total deducciones": r.total_deducciones, Neto: r.neto, "Depósito BBVA": r.deposito_bbva, "Depósito viáticos": r.deposito_viaticos,
          Observaciones: r.observaciones,
        })),
      },
    ]);
  };

  const vista = editando ? { ...editando, ...calcularTotales(editando, config) } : null;
  const setCampo = (campo: keyof NominaCaptura, valor: string) =>
    setEditando((prev) => (prev ? { ...prev, [campo]: typeof prev[campo] === "number" ? (valor === "" ? 0 : Number(valor)) : valor } : prev));
  const setAbono = (prestamoId: number, valor: string) =>
    setEditando((prev) => (prev ? { ...prev, creditos: prev.creditos.map((c) => (c.prestamo_id === prestamoId ? { ...c, abono: Number(valor) || 0 } : c)) } : prev));

  const recalcular = () => {
    if (!editando || !d) return;
    const p = d.propuestas[editando.expediente_id];
    if (!p) return alert("La persona ya no está activa; no hay datos de asistencia para recalcular.");
    setEditando({ ...editando, dias_asistidos: p.dias_asistidos, faltas: p.faltas, retardos: p.retardos, bonos_ruta: p.bonos_ruta, bonos: Math.max(editando.bonos, p.bonos_ruta) });
  };

  const abrir = (r: NominaRegistro) => {
    const base = { ...r, creditos: [...(r.creditos || [])] };
    // Créditos activos que aún no están en la captura (p. ej. creados después de guardar).
    for (const c of d?.creditos[r.expediente_id] || []) {
      if (!base.creditos.some((x) => x.prestamo_id === c.id) && c.estado === "Activo") base.creditos.push({ prestamo_id: c.id, concepto: c.concepto, abono: 0 });
    }
    setEditando(base);
  };

  const campoNumero = (c: CampoNum) =>
    editando && (
      <div key={c.campo}>
        <label className={labelCls}>{c.etiqueta}</label>
        <input type="number" min={0} step={c.paso || "0.01"} disabled={!abierta} value={editando[c.campo] as number} onChange={(e) => setCampo(c.campo, e.target.value)} className={inputCls} />
      </div>
    );

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo={periodo ? `Nómina · Semana ${periodo.semana} ${periodo.anio}` : "Nómina"}
          subtitulo={periodo ? `${fechaCorta(periodo.fecha_inicio)} al ${fechaCorta(periodo.fecha_fin)}` : "Captura semanal"}
          backHref="/personas/nomina"
          backLabel="Semanas"
        />

        {error && <p className="mb-4 text-[13px] text-[var(--red)]">{error}</p>}
        {cargando && <p className="text-[13px] text-[var(--gray-500)]">Cargando…</p>}

        {periodo && d && !cargando && (
          <>
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span className={`rounded px-2.5 py-1 text-[12px] font-medium ${ESTILO_ESTADO[periodo.estado] || ""}`}>{periodo.estado}</span>
              <div className="flex items-center gap-2 bg-white border border-[var(--gray-200)] rounded-lg px-3 py-1.5">
                <span className="text-[12.5px] text-[var(--gray-500)]">Sueldo base semanal (BBVA)</span>
                {abierta ? (
                  <>
                    <input type="number" min={0} step="0.01" value={baseSemana} onChange={(e) => setBaseSemana(e.target.value)} className={`${inputCls} w-[110px] py-1`} />
                    <button type="button" className="btn btn-primario py-1.5" onClick={() => aplicarBase(false)}>Aplicar a todos</button>
                    {periodo.sueldo_base !== null && periodo.sueldo_base !== undefined && (
                      <button type="button" className="btn-enlace text-[12px]" onClick={() => aplicarBase(true)}>Usar el individual</button>
                    )}
                  </>
                ) : (
                  <b className="text-[13px] text-[var(--navy)] font-medium">{periodo.sueldo_base != null ? moneda(periodo.sueldo_base) : "Individual"}</b>
                )}
              </div>
              <div className="flex-1" />
              {abierta && pendientes > 0 && (
                <button type="button" className="btn btn-secundario" disabled={guardando} onClick={guardarPendientes}>Guardar propuestas ({pendientes})</button>
              )}
              <button type="button" className="btn btn-secundario" onClick={exportar} disabled={!guardados.length}>Exportar Excel</button>
              <button type="button" className="btn btn-secundario" onClick={() => recibos(guardados)}>Recibos de la semana</button>
              {periodo.estado === "Abierta" && <button type="button" className="btn btn-primario" onClick={() => cambiarEstado("Cerrada")}>Cerrar semana</button>}
              {periodo.estado === "Cerrada" && (
                <>
                  <button type="button" className="btn btn-secundario" onClick={() => cambiarEstado("Abierta")}>Reabrir</button>
                  <button type="button" className="btn btn-primario" onClick={() => cambiarEstado("Pagada")}>Marcar como pagada</button>
                </>
              )}
              {periodo.estado === "Pagada" && <button type="button" className="btn btn-secundario" onClick={() => cambiarEstado("Abierta")}>Reabrir</button>}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
              {[
                { t: "Total de personal", v: String(d.total_personal) },
                { t: "Capturados", v: `${guardados.length} de ${registros.length}` },
                { t: "Total deducciones", v: moneda(suma("total_deducciones")) },
                { t: "Depósitos BBVA", v: moneda(suma("deposito_bbva")) },
                { t: "Depósitos de viáticos", v: moneda(suma("deposito_viaticos")) },
                { t: "Total neto a pagar", v: moneda(suma("neto")) },
              ].map((k) => (
                <div key={k.t} className="bg-white border border-[var(--gray-200)] rounded-lg px-4 py-3">
                  <p className="text-[11.5px] text-[var(--gray-500)] m-0">{k.t}</p>
                  <p className="text-[16px] font-medium text-[var(--navy)] m-0 mt-0.5">{k.v}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8">
              <div className="p-3 border-b border-[var(--gray-200)]">
                <input type="search" placeholder="Buscar por nombre o puesto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} max-w-[320px]`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[1120px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Empleado</th>
                      <th className="px-3 py-3 font-medium text-right">Sueldo ofertado</th>
                      <th className="px-3 py-3 font-medium text-center">Días / F / R</th>
                      <th className="px-3 py-3 font-medium text-right">Percepciones</th>
                      <th className="px-3 py-3 font-medium text-right">Deducciones</th>
                      <th className="px-3 py-3 font-medium text-right">Neto</th>
                      <th className="px-3 py-3 font-medium text-right">Depósito BBVA</th>
                      <th className="px-3 py-3 font-medium text-right">Depósito viáticos</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r) => (
                      <tr key={r.expediente_id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)]">
                        <td className="px-4 py-2.5">
                          <Link href={`/personas/expedientes/detalle?id=${r.expediente_id}`} className="m-0 font-medium text-[var(--navy)] hover:underline">{r.nombre}</Link>
                          <p className="m-0 text-[11.5px] text-[var(--gray-500)]">{r.puesto || "—"}</p>
                        </td>
                        <td className="px-3 py-2.5 text-right">{moneda(r.sueldo_semanal)}</td>
                        <td className="px-3 py-2.5 text-center text-[var(--gray-500)]">{r.dias_asistidos} / {r.faltas} / {r.retardos}</td>
                        <td className="px-3 py-2.5 text-right">{moneda(r.total_percepciones)}</td>
                        <td className="px-3 py-2.5 text-right text-[var(--red)]">{r.total_deducciones ? `−${moneda(r.total_deducciones)}` : moneda(0)}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{moneda(r.neto)}</td>
                        <td className="px-3 py-2.5 text-right">{moneda(r.deposito_bbva)}</td>
                        <td className="px-3 py-2.5 text-right">{moneda(r.deposito_viaticos)}</td>
                        <td className="px-3 py-2.5">
                          <span className={`text-[11.5px] font-medium ${r.id !== null ? "text-[var(--green)]" : "text-[#a46b00]"}`}>{r.id !== null ? "Guardado" : "Propuesta"}</span>
                        </td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button type="button" className="btn btn-secundario py-1.5" onClick={() => abrir(r)}>{abierta ? "Capturar" : "Ver"}</button>
                          {r.id !== null && <button type="button" className="btn-enlace text-[12.5px] ml-3" onClick={() => recibos([r])}>Recibo</button>}
                        </td>
                      </tr>
                    ))}
                    {visibles.length === 0 && <tr><td colSpan={10} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay personal para mostrar.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {editando && vista && periodo && d && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[860px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)] flex items-start justify-between gap-3">
              <div>
                <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{editando.nombre}</h3>
                <p className="text-[12.5px] text-[var(--gray-500)] m-0">{editando.puesto || "—"} · Semana {periodo.semana} · Folio {editando.folio}</p>
              </div>
              {abierta && <button type="button" className="btn btn-secundario py-1.5" onClick={recalcular}>Recalcular desde asistencia</button>}
            </div>
            <div className="p-6 grid gap-5">
              <section>
                <h4 className={h4Cls}>Asistencia de la semana</h4>
                <div className="grid grid-cols-7 gap-1.5">
                  {dias.map((f, i) => {
                    const reg = (d.asistencia[editando.expediente_id] || []).find((x) => x.fecha === f);
                    const e = reg ? ESTILO_TIPO[claveVisual(reg)] : null;
                    return (
                      <div key={f} className="rounded-md border p-1.5 min-h-[72px] text-[11px] leading-tight" style={e ? { background: e.fondo, color: e.texto, borderColor: e.borde } : { borderColor: "var(--gray-200)", color: "var(--gray-400)" }}>
                        <p className="m-0 font-medium">{DIAS_CORTOS[i]} {f.slice(8)}</p>
                        {reg ? (
                          <>
                            <p className="m-0">{claveVisual(reg)}</p>
                            {reg.entrada_ts && <p className="m-0 opacity-80">{reg.entrada_ts.slice(11)}–{reg.salida_ts ? reg.salida_ts.slice(11) : "--:--"}</p>}
                            {reg.tipo === "Viaje foráneo" && <p className="m-0 opacity-80">{[reg.estado_destino, reg.ruta].filter(Boolean).join(" · ")}</p>}
                            {reg.notas && <p className="m-0 opacity-70 italic">{reg.notas}</p>}
                          </>
                        ) : (
                          <p className="m-0">Sin registro</p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-3 gap-3 mt-3">{ASISTENCIA.map(campoNumero)}</div>
              </section>
              <section>
                <h4 className={h4Cls}>Percepciones</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{PERCEPCIONES.map(campoNumero)}</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Detalle de bonos / incentivos</label>
                    <input type="text" disabled={!abierta} value={editando.incentivos_detalle} onChange={(e) => setCampo("incentivos_detalle", e.target.value)} placeholder="Ej. Bono de ruta Monterrey, puntualidad" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Bonos por ruta (asistencia)</label>
                    <input type="text" disabled value={moneda(editando.bonos_ruta)} className={inputCls} />
                  </div>
                </div>
              </section>
              <section>
                <h4 className={h4Cls}>Deducciones</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Faltas y retardos</label>
                    <input type="text" disabled value={moneda(vista.descuento_faltas)} className={inputCls} />
                  </div>
                  {DEDUCCIONES.map(campoNumero)}
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Detalle de otros descuentos</label>
                  <input type="text" disabled={!abierta} value={editando.otros_descuentos_detalle} onChange={(e) => setCampo("otros_descuentos_detalle", e.target.value)} className={inputCls} />
                </div>
                <p className="text-[11.5px] text-[var(--gray-500)] mt-1.5">
                  Salario diario {moneda(vista.salario_diario)} × {vista.faltas_equivalentes} día(s) equivalentes{config.retardos_por_falta > 0 ? ` (${config.retardos_por_falta} retardos = 1 falta)` : ""}.
                </p>
              </section>
              {editando.creditos.length > 0 && (
                <section>
                  <h4 className={h4Cls}>Créditos (licencia federal y préstamos)</h4>
                  <div className="border border-[var(--gray-200)] rounded-lg divide-y divide-[var(--gray-200)]">
                    {editando.creditos.map((c) => {
                      const info = (d.creditos[editando.expediente_id] || []).find((x) => x.id === c.prestamo_id);
                      return (
                        <div key={c.prestamo_id} className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-3 p-3 items-center">
                          <div className="text-[12.5px]">
                            <p className="m-0 font-medium text-[var(--navy)]">{c.concepto}</p>
                            {info && (
                              <p className="m-0 text-[var(--gray-500)]">
                                Total {moneda(info.monto_total)} · inicio {fechaCorta(info.fecha_inicio)} · pactado {moneda(info.abono_semanal)}/sem · saldo antes de esta semana{" "}
                                {moneda(info.saldo_corte + info.abono_semana)}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className={labelCls}>Abono de esta semana</label>
                            <input type="number" min={0} step="0.01" disabled={!abierta} value={c.abono} onChange={(e) => setAbono(c.prestamo_id, e.target.value)} className={inputCls} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              <section className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-3">
                <div>
                  <label className={labelCls}>Observaciones</label>
                  <textarea rows={2} disabled={!abierta} value={editando.observaciones} onChange={(e) => setCampo("observaciones", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Sueldo base (depósito BBVA)</label>
                  <input type="number" min={0} step="0.01" disabled={!abierta} value={editando.sueldo_base} onChange={(e) => setCampo("sueldo_base", e.target.value)} className={inputCls} />
                </div>
              </section>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg p-4">
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Percepciones</p><p className="text-[15px] font-medium m-0">{moneda(vista.total_percepciones)}</p></div>
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Deducciones</p><p className="text-[15px] font-medium text-[var(--red)] m-0">−{moneda(vista.total_deducciones)}</p></div>
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Depósito BBVA</p><p className="text-[15px] font-medium m-0">{moneda(vista.deposito_bbva)}</p></div>
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Depósito viáticos</p><p className="text-[15px] font-medium m-0">{moneda(vista.deposito_viaticos)}</p></div>
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Neto a pagar</p><p className="text-[18px] font-bold text-[var(--navy)] m-0">{moneda(vista.neto)}</p></div>
              </div>
              {vista.neto < 0 && <p className="text-[12.5px] text-[var(--red)] -mt-2">El neto es negativo; revisa las deducciones.</p>}
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              {abierta && editando.id !== null && <button type="button" className="mr-auto text-[12.5px] text-[var(--red)] hover:underline" onClick={descartar}>Descartar captura</button>}
              <button type="button" className="btn btn-secundario" onClick={() => setEditando(null)}>{abierta ? "Cancelar" : "Cerrar"}</button>
              {abierta && <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardarEdicion}>{guardando ? "Guardando…" : "Guardar"}</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
