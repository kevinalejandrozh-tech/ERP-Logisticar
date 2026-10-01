"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { fechaCorta, moneda, redondear } from "@/lib/nominaCalculo";

type Dia = { fecha: string; origen: string; notas: string | null };
type Ajuste = {
  dias_derecho: number | null;
  dias_pago: number | null;
  porcentaje_prima: number;
  salario_diario: number | null;
  monto_final: number | null;
  saldo_favor: number;
  saldo_pendiente: number;
  comentarios: string;
};
type Persona = {
  id: number;
  nombre: string;
  puesto: string | null;
  fecha_ingreso: string;
  anios: number;
  periodo_desde: string;
  periodo_hasta: string;
  dias_ley: number;
  sueldo_base: number;
  programados: Dia[];
  adelantos: Dia[];
  ajuste: Ajuste | null;
};

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

// Cálculo por persona (Ley Federal del Trabajo):
// - Días disponibles = días por antigüedad − programados − tomados por adelantado.
// - Días a pagar = días por antigüedad − tomados por adelantado (editable).
// - Pago = salario diario × días a pagar; prima = pago × % (mínimo de ley 25 %).
function calcular(p: Persona) {
  const a = p.ajuste;
  const derecho = a?.dias_derecho ?? p.dias_ley;
  const disponibles = Math.max(0, derecho - p.programados.length - p.adelantos.length);
  const diasPago = a?.dias_pago ?? Math.max(0, derecho - p.adelantos.length);
  const salarioDiario = a?.salario_diario ?? redondear(p.sueldo_base / 7);
  const pct = a?.porcentaje_prima ?? 25;
  const pagoDias = redondear(salarioDiario * diasPago);
  const prima = redondear(pagoDias * (pct / 100));
  const calculado = redondear(pagoDias + prima + (a?.saldo_favor || 0) - (a?.saldo_pendiente || 0));
  return { derecho, disponibles, diasPago, salarioDiario, pct, pagoDias, prima, calculado, total: a?.monto_final ?? calculado };
}

export default function VacacionesPage() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [programar, setProgramar] = useState<{ p: Persona; desde: string; hasta: string; excluir_domingos: boolean; notas: string } | null>(null);
  const [ajustar, setAjustar] = useState<{ p: Persona; a: Ajuste } | null>(null);
  const [detalle, setDetalle] = useState<Persona | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const r = await pedir<{ personas: Persona[] }>("/api/asistencia/vacaciones");
      setPersonas(r.personas);
      setError("");
      return r.personas;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
      return [];
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? personas.filter((p) => p.nombre.toLowerCase().includes(q)) : personas;
  }, [personas, busqueda]);

  const guardarProgramacion = async () => {
    if (!programar) return;
    setOcupado(true);
    try {
      const r = await pedir<{ creados: number; omitidos: number }>("/api/asistencia/vacaciones", {
        method: "POST",
        body: JSON.stringify({ expediente_id: programar.p.id, desde: programar.desde, hasta: programar.hasta, excluir_domingos: programar.excluir_domingos, notas: programar.notas }),
      });
      alert(`Se programaron ${r.creados} día(s).${r.omitidos ? ` ${r.omitidos} día(s) ya tenían otro registro en Asistencia y se respetaron.` : ""}`);
      setProgramar(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo programar.");
    } finally {
      setOcupado(false);
    }
  };

  const guardarAjuste = async () => {
    if (!ajustar) return;
    setOcupado(true);
    try {
      await pedir("/api/asistencia/vacaciones", { method: "PUT", body: JSON.stringify({ ...ajustar.a, expediente_id: ajustar.p.id, anio_servicio: ajustar.p.anios }) });
      setAjustar(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  const quitarDia = async (p: Persona, fecha: string) => {
    if (!confirm(`¿Quitar el día programado ${fechaCorta(fecha)}?`)) return;
    try {
      await pedir(`/api/asistencia/vacaciones?expediente_id=${p.id}&fecha=${fecha}`, { method: "DELETE" });
      const nuevas = await cargar();
      setDetalle(nuevas.find((x) => x.id === p.id) || null);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo quitar.");
    }
  };

  const numero = (v: string) => (v === "" ? null : Number(v));

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader titulo="Vacaciones" subtitulo="Programación, días disponibles y prima vacacional del personal con 1 año o más de antigüedad." backHref="/asistencia" backLabel="Asistencia" />

        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4 p-4 text-[12.5px] text-[var(--gray-500)] grid gap-1">
          <p className="m-0"><b className="text-[var(--navy)] font-medium">Días por ley:</b> 1 año = 12 · 2 = 14 · 3 = 16 · 4 = 18 · 5 = 20 · 6 a 10 = 22 · 11 a 15 = 24 · 16 a 20 = 26 (21 a 25 = 28 · 26 a 30 = 30).</p>
          <p className="m-0"><b className="text-[var(--navy)] font-medium">Prima vacacional:</b> salario diario × días a pagar × % (mínimo 25 %), adicional al pago de los días. Los días tomados por adelantado (marcados en Asistencia sin programar) se descuentan del pago.</p>
        </div>

        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8">
          <div className="p-3 border-b border-[var(--gray-200)]">
            <input type="search" placeholder="Buscar por nombre" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} max-w-[300px]`} />
          </div>
          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[1100px]">
                <thead>
                  <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                    <th className="px-4 py-3 font-medium">Nombre</th>
                    <th className="px-3 py-3 font-medium">Antigüedad</th>
                    <th className="px-3 py-3 font-medium">Periodo vigente</th>
                    <th className="px-3 py-3 font-medium text-center">Días ley</th>
                    <th className="px-3 py-3 font-medium text-center">Programados</th>
                    <th className="px-3 py-3 font-medium text-center">Adelantos</th>
                    <th className="px-3 py-3 font-medium text-center">Disponibles</th>
                    <th className="px-3 py-3 font-medium text-right">Pago días</th>
                    <th className="px-3 py-3 font-medium text-right">Prima</th>
                    <th className="px-3 py-3 font-medium text-right">Total</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => {
                    const c = calcular(p);
                    return (
                      <tr key={p.id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)]">
                        <td className="px-4 py-2.5">
                          <Link href={`/personas/expedientes/detalle?id=${p.id}`} className="font-medium text-[var(--navy)] hover:underline">{p.nombre}</Link>
                          <p className="m-0 text-[11.5px] text-[var(--gray-500)]">Ingreso {fechaCorta(p.fecha_ingreso)}</p>
                        </td>
                        <td className="px-3 py-2.5">{p.anios} año(s)</td>
                        <td className="px-3 py-2.5 text-[var(--gray-500)]">{fechaCorta(p.periodo_desde)} – {fechaCorta(p.periodo_hasta)}</td>
                        <td className="px-3 py-2.5 text-center">{c.derecho}{p.ajuste?.dias_derecho != null && <span className="text-[10px] text-[#a46b00]"> *</span>}</td>
                        <td className="px-3 py-2.5 text-center">{p.programados.length}</td>
                        <td className={`px-3 py-2.5 text-center ${p.adelantos.length ? "text-[#8a5a00] font-medium" : ""}`}>{p.adelantos.length}</td>
                        <td className="px-3 py-2.5 text-center font-medium text-[var(--navy)]">{c.disponibles}</td>
                        <td className="px-3 py-2.5 text-right">{moneda(c.pagoDias)}<span className="block text-[11px] text-[var(--gray-500)]">{c.diasPago} d × {moneda(c.salarioDiario)}</span></td>
                        <td className="px-3 py-2.5 text-right">{moneda(c.prima)}<span className="block text-[11px] text-[var(--gray-500)]">{c.pct} %</span></td>
                        <td className="px-3 py-2.5 text-right font-medium">{moneda(c.total)}{p.ajuste?.monto_final != null && <span className="block text-[11px] text-[#a46b00]">Ajustado</span>}</td>
                        <td className="px-3 py-2.5 text-right whitespace-nowrap">
                          <button type="button" className="btn btn-primario py-1.5" onClick={() => setProgramar({ p, desde: "", hasta: "", excluir_domingos: true, notas: "" })}>Programar</button>
                          <button type="button" className="btn btn-secundario py-1.5 ml-1.5" onClick={() => setAjustar({ p, a: p.ajuste || { dias_derecho: null, dias_pago: null, porcentaje_prima: 25, salario_diario: null, monto_final: null, saldo_favor: 0, saldo_pendiente: 0, comentarios: "" } })}>Ajustar</button>
                          <button type="button" className="btn-enlace text-[12.5px] ml-2" onClick={() => setDetalle(p)}>Detalle</button>
                        </td>
                      </tr>
                    );
                  })}
                  {visibles.length === 0 && <tr><td colSpan={11} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay personal activo con 1 año o más de antigüedad (revisa la fecha de ingreso en Expedientes).</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {programar && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-16 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[440px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-1">Programar vacaciones</h3>
            <p className="text-[12.5px] text-[var(--gray-500)] mb-4">{programar.p.nombre} · disponibles: {calcular(programar.p).disponibles} día(s)</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Desde</label><input type="date" value={programar.desde} onChange={(e) => setProgramar({ ...programar, desde: e.target.value, hasta: programar.hasta || e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Hasta</label><input type="date" min={programar.desde} value={programar.hasta} onChange={(e) => setProgramar({ ...programar, hasta: e.target.value })} className={inputCls} /></div>
              <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={programar.excluir_domingos} onChange={(e) => setProgramar({ ...programar, excluir_domingos: e.target.checked })} className="w-4 h-4 accent-[var(--navy)]" />No contar domingos</label>
              <div className="col-span-2"><label className={labelCls}>Notas</label><input type="text" value={programar.notas} onChange={(e) => setProgramar({ ...programar, notas: e.target.value })} placeholder="Ej. Autorizadas por Dirección" className={inputCls} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setProgramar(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado || !programar.desde || !programar.hasta} onClick={guardarProgramacion}>Programar</button>
            </div>
          </div>
        </div>
      )}

      {ajustar && (() => {
        const c = calcular({ ...ajustar.p, ajuste: { ...ajustar.a, monto_final: null } });
        const a = ajustar.a;
        const set = (k: keyof Ajuste, v: string) => setAjustar({ ...ajustar, a: { ...a, [k]: k === "comentarios" ? v : numero(v) ?? (k === "saldo_favor" || k === "saldo_pendiente" ? 0 : k === "porcentaje_prima" ? 25 : null) } });
        return (
          <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50 px-4">
            <div className="bg-white rounded-lg w-full max-w-[560px] p-6 shadow-xl">
              <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-1">Ajustes de vacaciones y prima</h3>
              <p className="text-[12.5px] text-[var(--gray-500)] mb-4">{ajustar.p.nombre} · {ajustar.p.anios} año(s) de servicio. Deja vacío para usar el cálculo automático.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className={labelCls}>Días por antigüedad</label><input type="number" min={0} placeholder={String(ajustar.p.dias_ley)} value={a.dias_derecho ?? ""} onChange={(e) => set("dias_derecho", e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Días a pagar</label><input type="number" min={0} placeholder={String(c.diasPago)} value={a.dias_pago ?? ""} onChange={(e) => set("dias_pago", e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>% prima vacacional</label><input type="number" min={0} max={200} value={a.porcentaje_prima} onChange={(e) => set("porcentaje_prima", e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Salario diario</label><input type="number" min={0} step="0.01" placeholder={String(c.salarioDiario)} value={a.salario_diario ?? ""} onChange={(e) => set("salario_diario", e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Saldo a favor</label><input type="number" min={0} step="0.01" value={a.saldo_favor} onChange={(e) => set("saldo_favor", e.target.value)} className={inputCls} /></div>
                <div><label className={labelCls}>Saldo pendiente</label><input type="number" min={0} step="0.01" value={a.saldo_pendiente} onChange={(e) => set("saldo_pendiente", e.target.value)} className={inputCls} /></div>
                <div className="col-span-2 sm:col-span-3"><label className={labelCls}>Monto final (opcional, reemplaza el calculado)</label><input type="number" min={0} step="0.01" placeholder={String(c.calculado)} value={a.monto_final ?? ""} onChange={(e) => set("monto_final", e.target.value)} className={inputCls} /></div>
                <div className="col-span-2 sm:col-span-3"><label className={labelCls}>Comentarios</label><textarea rows={2} value={a.comentarios} onChange={(e) => set("comentarios", e.target.value)} className={inputCls} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg p-3 mt-4 text-[12.5px]">
                <div><p className="m-0 text-[var(--gray-500)]">Pago de días</p><p className="m-0 font-medium">{moneda(c.pagoDias)}</p></div>
                <div><p className="m-0 text-[var(--gray-500)]">Prima ({c.pct} %)</p><p className="m-0 font-medium">{moneda(c.prima)}</p></div>
                <div><p className="m-0 text-[var(--gray-500)]">Calculado</p><p className="m-0 font-bold text-[var(--navy)]">{moneda(c.calculado)}</p></div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" className="btn btn-secundario" onClick={() => setAjustar(null)}>Cancelar</button>
                <button type="button" className="btn btn-primario" disabled={ocupado} onClick={guardarAjuste}>Guardar</button>
              </div>
            </div>
          </div>
        );
      })()}

      {detalle && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-12 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[520px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-1">{detalle.nombre}</h3>
            <p className="text-[12.5px] text-[var(--gray-500)] mb-4">Periodo {fechaCorta(detalle.periodo_desde)} – {fechaCorta(detalle.periodo_hasta)}</p>
            <h4 className="text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-1.5">Programados ({detalle.programados.length})</h4>
            <ul className="list-none p-0 m-0 mb-4 text-[13px]">
              {detalle.programados.map((d) => (
                <li key={d.fecha} className="flex justify-between py-1 border-b border-[var(--gray-100)]">
                  <span>{fechaCorta(d.fecha)}{d.notas ? ` · ${d.notas}` : ""}</span>
                  <button type="button" className="text-[12px] text-[var(--red)] hover:underline" onClick={() => quitarDia(detalle, d.fecha)}>Quitar</button>
                </li>
              ))}
              {!detalle.programados.length && <li className="text-[var(--gray-500)]">Sin días programados.</li>}
            </ul>
            <h4 className="text-[12px] font-medium text-[#8a5a00] uppercase tracking-wide mb-1.5">Tomados por adelantado ({detalle.adelantos.length})</h4>
            <ul className="list-none p-0 m-0 text-[13px]">
              {detalle.adelantos.map((d) => <li key={d.fecha} className="py-1 border-b border-[var(--gray-100)]">{fechaCorta(d.fecha)}{d.notas ? ` · ${d.notas}` : ""}</li>)}
              {!detalle.adelantos.length && <li className="text-[var(--gray-500)]">Ninguno.</li>}
            </ul>
            {detalle.ajuste?.comentarios && <p className="text-[12.5px] text-[var(--gray-500)] mt-4"><b>Comentarios:</b> {detalle.ajuste.comentarios}</p>}
            <div className="flex justify-end mt-6"><button type="button" className="btn btn-secundario" onClick={() => setDetalle(null)}>Cerrar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
