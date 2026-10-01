"use client";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { exportarExcel } from "@/lib/exportExcel";
import { imprimirRecibos } from "@/lib/nominaRecibo";
import { CONFIG_DEFAULT, NominaCaptura, NominaConfig, NominaPeriodo, NominaRegistro, calcularTotales, fechaCorta, moneda, redondear } from "@/lib/nominaCalculo";

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const ESTILO_ESTADO: Record<string, string> = {
  Abierta: "bg-[#eef3fd] text-[var(--blue)]",
  Cerrada: "bg-[#fff6e0] text-[#a46b00]",
  Pagada: "bg-[#e7f6ee] text-[var(--green)]",
};

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white disabled:bg-[var(--gray-100)]";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

type CampoNum = { campo: keyof NominaCaptura; etiqueta: string; paso?: string };
const ASISTENCIA: CampoNum[] = [
  { campo: "dias_asistidos", etiqueta: "Días asistidos", paso: "0.5" },
  { campo: "faltas", etiqueta: "Faltas", paso: "0.5" },
  { campo: "retardos", etiqueta: "Retardos", paso: "1" },
];
const PERCEPCIONES: CampoNum[] = [
  { campo: "sueldo_semanal", etiqueta: "Sueldo ofertado (semanal)" },
  { campo: "bonos", etiqueta: "Bonos" },
  { campo: "otros_incentivos", etiqueta: "Otros incentivos" },
];
const DEDUCCIONES: CampoNum[] = [
  { campo: "licencia_federal", etiqueta: "Licencia federal" },
  { campo: "imss", etiqueta: "IMSS" },
  { campo: "caja_ahorro", etiqueta: "Caja de ahorro" },
  { campo: "prestamo", etiqueta: "Préstamo personal" },
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
  const [periodo, setPeriodo] = useState<NominaPeriodo | null>(null);
  const [config, setConfig] = useState<NominaConfig>(CONFIG_DEFAULT);
  const [registros, setRegistros] = useState<NominaRegistro[]>([]);
  const [cargando, setCargando] = useState(periodoId !== null);
  const [error, setError] = useState(periodoId ? "" : "No se indicó la semana.");
  const [busqueda, setBusqueda] = useState("");
  const [editando, setEditando] = useState<NominaRegistro | null>(null);
  const [guardando, setGuardando] = useState(false);

  // Sin setState antes del primer await (evita renders en cascada al montarse).
  const cargar = useCallback(async (id: number) => {
    try {
      const r = await pedir<{ periodo: NominaPeriodo; config: NominaConfig; registros: NominaRegistro[] }>(`/api/nomina/semana?id=${id}`);
      setError("");
      setPeriodo(r.periodo);
      setConfig(r.config);
      setRegistros(r.registros);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la semana.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (periodoId) cargar(periodoId);
  }, [periodoId, cargar]);

  const abierta = periodo?.estado === "Abierta";
  const guardados = registros.filter((r) => r.id !== null);
  const pendientes = registros.length - guardados.length;
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? registros.filter((r) => r.nombre.toLowerCase().includes(q) || (r.puesto || "").toLowerCase().includes(q)) : registros;
  }, [registros, busqueda]);
  const totales = useMemo(
    () => ({
      percepciones: redondear(guardados.reduce((a, r) => a + r.total_percepciones, 0)),
      deducciones: redondear(guardados.reduce((a, r) => a + r.total_deducciones, 0)),
      neto: redondear(guardados.reduce((a, r) => a + r.neto, 0)),
    }),
    [guardados]
  );

  const guardarRegistro = async (r: NominaRegistro) => {
    if (!periodoId) return;
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
    if (!confirm("¿Descartar la captura guardada? Se volverá a la propuesta automática.")) return;
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
    if (!lista.length || !confirm(`Se guardarán ${lista.length} propuesta(s) tal como aparecen. ¿Continuar?`)) return;
    setGuardando(true);
    try {
      for (const r of lista) await guardarRegistro(r);
      await cargar(periodoId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudieron guardar todas.");
      await cargar(periodoId);
    } finally {
      setGuardando(false);
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
    if (!periodo) return;
    if (!lista.length) {
      alert("Primero guarda la nómina de al menos un empleado.");
      return;
    }
    imprimirRecibos(lista, periodo, config);
  };

  const exportar = () => {
    if (!periodo) return;
    exportarExcel(`Nomina_S${String(periodo.semana).padStart(2, "0")}_${periodo.anio}.xlsx`, [
      {
        nombre: `Semana ${periodo.semana}`,
        filas: guardados.map((r) => ({
          Folio: r.folio,
          Nombre: r.nombre,
          Puesto: r.puesto || "",
          "Sueldo semanal": r.sueldo_semanal,
          "Días asistidos": r.dias_asistidos,
          Faltas: r.faltas,
          Retardos: r.retardos,
          Bonos: r.bonos,
          "Otros incentivos": r.otros_incentivos,
          "Total percepciones": r.total_percepciones,
          "Desc. faltas/retardos": r.descuento_faltas,
          "Licencia federal": r.licencia_federal,
          IMSS: r.imss,
          "Caja de ahorro": r.caja_ahorro,
          "Préstamo personal": r.prestamo,
          "Otros descuentos": r.otros_descuentos,
          "Total deducciones": r.total_deducciones,
          Neto: r.neto,
          Observaciones: r.observaciones,
        })),
      },
    ]);
  };

  const vista = editando ? { ...editando, ...calcularTotales(editando, config) } : null;
  const setCampo = (campo: keyof NominaCaptura, valor: string) =>
    setEditando((prev) => (prev ? { ...prev, [campo]: typeof prev[campo] === "number" ? (valor === "" ? 0 : Number(valor)) : valor } : prev));

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

        {periodo && !cargando && (
          <>
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span className={`rounded px-2.5 py-1 text-[12px] font-medium ${ESTILO_ESTADO[periodo.estado] || ""}`}>{periodo.estado}</span>
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

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {[
                { t: "Capturados", v: `${guardados.length} de ${registros.length}` },
                { t: "Total percepciones", v: moneda(totales.percepciones) },
                { t: "Total deducciones", v: moneda(totales.deducciones) },
                { t: "Total neto a pagar", v: moneda(totales.neto) },
              ].map((k) => (
                <div key={k.t} className="bg-white border border-[var(--gray-200)] rounded-lg px-4 py-3">
                  <p className="text-[11.5px] text-[var(--gray-500)] m-0">{k.t}</p>
                  <p className="text-[17px] font-medium text-[var(--navy)] m-0 mt-0.5">{k.v}</p>
                </div>
              ))}
            </div>

            <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8">
              <div className="p-3 border-b border-[var(--gray-200)]">
                <input type="search" placeholder="Buscar por nombre o puesto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} max-w-[320px]`} />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-[13px] min-w-[880px]">
                  <thead>
                    <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                      <th className="px-4 py-3 font-medium">Empleado</th>
                      <th className="px-4 py-3 font-medium text-right">Sueldo</th>
                      <th className="px-4 py-3 font-medium text-center">Asist. / Faltas / Ret.</th>
                      <th className="px-4 py-3 font-medium text-right">Percepciones</th>
                      <th className="px-4 py-3 font-medium text-right">Deducciones</th>
                      <th className="px-4 py-3 font-medium text-right">Neto</th>
                      <th className="px-4 py-3 font-medium">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibles.map((r) => (
                      <tr key={r.expediente_id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)]">
                        <td className="px-4 py-2.5">
                          <p className="m-0 font-medium text-[var(--navy)]">{r.nombre}</p>
                          <p className="m-0 text-[11.5px] text-[var(--gray-500)]">{r.puesto || "—"}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right">{moneda(r.sueldo_semanal)}</td>
                        <td className="px-4 py-2.5 text-center text-[var(--gray-500)]">{r.dias_asistidos} / {r.faltas} / {r.retardos}</td>
                        <td className="px-4 py-2.5 text-right">{moneda(r.total_percepciones)}</td>
                        <td className="px-4 py-2.5 text-right text-[var(--red)]">{r.total_deducciones ? `−${moneda(r.total_deducciones)}` : moneda(0)}</td>
                        <td className="px-4 py-2.5 text-right font-medium">{moneda(r.neto)}</td>
                        <td className="px-4 py-2.5">
                          {r.id !== null ? (
                            <span className="text-[11.5px] font-medium text-[var(--green)]">Guardado</span>
                          ) : (
                            <span className="text-[11.5px] font-medium text-[#a46b00]">Propuesta</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          <button type="button" className="btn btn-secundario py-1.5" onClick={() => setEditando({ ...r })}>{abierta ? "Capturar" : "Ver"}</button>
                          {r.id !== null && (
                            <button type="button" className="btn-enlace text-[12.5px] ml-3" onClick={() => recibos([r])}>Recibo</button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {visibles.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay personal para mostrar.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {editando && vista && periodo && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[760px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)]">
              <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{editando.nombre}</h3>
              <p className="text-[12.5px] text-[var(--gray-500)] m-0">{editando.puesto || "—"} · Semana {periodo.semana} · Folio {editando.folio}</p>
            </div>
            <div className="p-6 grid gap-5">
              <section>
                <h4 className="text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-2">Asistencia</h4>
                <div className="grid grid-cols-3 gap-3">{ASISTENCIA.map(campoNumero)}</div>
                <p className="text-[11.5px] text-[var(--gray-500)] mt-1.5">Precargado desde el módulo Asistencia (o Asistencia diaria); puedes ajustarlo.</p>
              </section>
              <section>
                <h4 className="text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-2">Percepciones</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{PERCEPCIONES.map(campoNumero)}</div>
                <div className="mt-3">
                  <label className={labelCls}>Detalle de bonos / incentivos</label>
                  <input type="text" disabled={!abierta} value={editando.incentivos_detalle} onChange={(e) => setCampo("incentivos_detalle", e.target.value)} placeholder="Ej. Bono de puntualidad, viaje extra" className={inputCls} />
                </div>
              </section>
              <section>
                <h4 className="text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-2">Deducciones</h4>
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
                  Salario diario {moneda(vista.salario_diario)} × {vista.faltas_equivalentes} día(s) equivalentes
                  {config.retardos_por_falta > 0 ? ` (${config.retardos_por_falta} retardos = 1 falta)` : ""}.
                </p>
              </section>
              <section>
                <label className={labelCls}>Observaciones</label>
                <textarea rows={2} disabled={!abierta} value={editando.observaciones} onChange={(e) => setCampo("observaciones", e.target.value)} className={inputCls} />
              </section>
              <div className="grid grid-cols-3 gap-3 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg p-4">
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Percepciones</p><p className="text-[15px] font-medium m-0">{moneda(vista.total_percepciones)}</p></div>
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Deducciones</p><p className="text-[15px] font-medium text-[var(--red)] m-0">−{moneda(vista.total_deducciones)}</p></div>
                <div><p className="text-[11.5px] text-[var(--gray-500)] m-0">Neto a pagar</p><p className="text-[18px] font-bold text-[var(--navy)] m-0">{moneda(vista.neto)}</p></div>
              </div>
              {vista.neto < 0 && <p className="text-[12.5px] text-[var(--red)] -mt-2">El neto es negativo; revisa las deducciones.</p>}
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              {abierta && editando.id !== null && (
                <button type="button" className="mr-auto text-[12.5px] text-[var(--red)] hover:underline" onClick={descartar}>Descartar captura</button>
              )}
              <button type="button" className="btn btn-secundario" onClick={() => setEditando(null)}>{abierta ? "Cancelar" : "Cerrar"}</button>
              {abierta && (
                <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardarEdicion}>{guardando ? "Guardando…" : "Guardar"}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
