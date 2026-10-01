"use client";
import { useCallback, useEffect, useState } from "react";
import { CONCEPTO_LICENCIA, CONCEPTO_PRESTAMO, CreditoEstado, fechaCorta, moneda } from "@/lib/nominaCalculo";

// Sección "Nómina" del expediente: conceptos semanales, caja de ahorro, licencia federal y préstamos personales.

type Empleado = {
  expediente_id: number;
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
type Abono = { id: number; tipo: "Semanal" | "Extraordinario"; importe: number; fecha: string; notas: string | null; semana: number | null; anio: number | null };
type Credito = CreditoEstado & { abonos: Abono[] };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";
const hoy = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" });

const CAMPOS: { k: keyof Empleado; t: string; ayuda?: string }[] = [
  { k: "sueldo_semanal", t: "Sueldo ofertado semanal" },
  { k: "sueldo_base", t: "Sueldo base semanal (depósito BBVA)", ayuda: "Por defecto $2,310" },
  { k: "imss", t: "IMSS semanal", ayuda: "Por defecto $75" },
  { k: "caja_ahorro", t: "Caja de ahorro semanal", ayuda: "Por defecto $100" },
  { k: "fonacot", t: "Fonacot semanal" },
  { k: "infonavit", t: "Infonavit semanal" },
];

export default function NominaExpediente({ expedienteId }: { expedienteId: number }) {
  const [emp, setEmp] = useState<Empleado | null>(null);
  const [caja, setCaja] = useState<{ semanas: number; acumulado: number } | null>(null);
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);
  const [nuevo, setNuevo] = useState<{ concepto: string; monto_total: string; abono_semanal: string; fecha_inicio: string; notas: string } | null>(null);
  const [extra, setExtra] = useState<{ credito: Credito; importe: string; fecha: string; notas: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([
        pedir<{ empleado: Empleado; caja: { semanas: number; acumulado: number } }>(`/api/nomina/empleados?expediente_id=${expedienteId}`),
        pedir<{ creditos: Credito[] }>(`/api/nomina/creditos?expediente_id=${expedienteId}`),
      ]);
      setEmp(e.empleado);
      setCaja(e.caja);
      setCreditos(c.creditos);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la nómina.");
    }
  }, [expedienteId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    if (!emp) return;
    setOcupado(true);
    try {
      await pedir("/api/nomina/empleados", { method: "PUT", body: JSON.stringify(emp) });
      setGuardado(true);
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  const crearCredito = async () => {
    if (!nuevo) return;
    setOcupado(true);
    try {
      await pedir("/api/nomina/creditos", { method: "POST", body: JSON.stringify({ ...nuevo, expediente_id: expedienteId }) });
      setNuevo(null);
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo registrar.");
    } finally {
      setOcupado(false);
    }
  };

  const editarAbono = async (c: Credito) => {
    const v = prompt(`Nuevo abono semanal para ${c.concepto}:`, String(c.abono_semanal));
    if (v === null) return;
    try {
      await pedir("/api/nomina/creditos", { method: "PATCH", body: JSON.stringify({ id: c.id, abono_semanal: Number(v) }) });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  };

  const cancelar = async (c: Credito) => {
    const tieneAbonos = c.abonos.length > 0;
    if (!confirm(tieneAbonos ? `¿Cancelar ${c.concepto}? Dejará de descontarse en nómina.` : `¿Eliminar ${c.concepto}?`)) return;
    try {
      if (tieneAbonos) await pedir("/api/nomina/creditos", { method: "PATCH", body: JSON.stringify({ id: c.id, cancelar: true }) });
      else await pedir(`/api/nomina/creditos?id=${c.id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo completar.");
    }
  };

  const registrarExtra = async () => {
    if (!extra) return;
    setOcupado(true);
    try {
      await pedir("/api/nomina/creditos/abono", { method: "POST", body: JSON.stringify({ prestamo_id: extra.credito.id, importe: Number(extra.importe), fecha: extra.fecha, notas: extra.notas }) });
      setExtra(null);
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo registrar el abono.");
    } finally {
      setOcupado(false);
    }
  };

  const quitarExtra = async (a: Abono) => {
    if (!confirm(`¿Eliminar el abono extraordinario de ${moneda(a.importe)}?`)) return;
    try {
      await pedir(`/api/nomina/creditos/abono?id=${a.id}`, { method: "DELETE" });
      await cargar();
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  if (error) return <p className="text-[13px] text-[var(--red)]">{error}</p>;
  if (!emp) return <p className="text-[13px] text-[var(--gray-500)]">Cargando…</p>;

  const bloqueCreditos = (concepto: string) => {
    const lista = creditos.filter((c) => c.concepto === concepto);
    return (
      <div className="border border-[var(--gray-200)] rounded-lg">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--gray-200)]">
          <p className="m-0 text-[13.5px] font-medium text-[var(--navy)]">{concepto === CONCEPTO_LICENCIA ? "Licencia federal" : "Préstamos personales"}</p>
          <button type="button" className="btn btn-secundario py-1 text-[12.5px]" onClick={() => setNuevo({ concepto, monto_total: "", abono_semanal: "", fecha_inicio: hoy(), notas: "" })}>
            + Registrar
          </button>
        </div>
        {lista.length === 0 && <p className="px-4 py-3 text-[12.5px] text-[var(--gray-500)] m-0">Sin registros.</p>}
        {lista.map((c) => (
          <div key={c.id} className="px-4 py-3 border-b border-[var(--gray-100)] last:border-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="text-[12.5px] text-[var(--gray-500)]">
                <p className="m-0 text-[13px] text-[var(--navy)] font-medium">
                  {concepto === CONCEPTO_LICENCIA ? "Monto total" : "Crédito autorizado"} {moneda(c.monto_total)} · {moneda(c.abono_semanal)}/semana
                  <span className={`ml-2 text-[11px] rounded px-1.5 py-0.5 ${c.estado === "Activo" ? "bg-[#eef3fd] text-[var(--blue)]" : c.estado === "Liquidado" ? "bg-[#e7f6ee] text-[var(--green)]" : "bg-[var(--gray-100)] text-[var(--gray-500)]"}`}>{c.estado}</span>
                </p>
                <p className="m-0">
                  Inicio de abonos {fechaCorta(c.fecha_inicio)} · Pagado {moneda(c.pagado)} en {c.pagos} pago(s) · Saldo <b className="text-[var(--navy)] font-medium">{moneda(c.saldo_corte)}</b>
                  {c.termino_semana && c.saldo_corte > 0 ? ` · Término estimado: ${c.termino_semana} (${fechaCorta(c.termino_estimado || "")})` : ""}
                </p>
                {c.notas && <p className="m-0 italic">{c.notas}</p>}
              </div>
              {c.estado === "Activo" && (
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" className="btn btn-secundario py-1 text-[12px]" onClick={() => setExtra({ credito: c, importe: "", fecha: hoy(), notas: "" })}>Abono extraordinario</button>
                  <button type="button" className="btn btn-secundario py-1 text-[12px]" onClick={() => editarAbono(c)}>Cambiar abono</button>
                  <button type="button" className="text-[12px] text-[var(--red)] hover:underline px-1" onClick={() => cancelar(c)}>{c.abonos.length ? "Cancelar" : "Eliminar"}</button>
                </div>
              )}
            </div>
            {c.abonos.length > 0 && (
              <details className="mt-1.5">
                <summary className="text-[12px] text-[var(--blue)] cursor-pointer">Ver abonos ({c.abonos.length})</summary>
                <ul className="list-none p-0 m-0 mt-1 text-[12px] text-[var(--gray-500)]">
                  {c.abonos.map((a) => (
                    <li key={a.id} className="flex items-center justify-between py-1 border-b border-[var(--gray-100)] last:border-0">
                      <span>
                        {fechaCorta(a.fecha)} · {a.tipo === "Semanal" ? `Nómina semana ${a.semana ?? "—"}` : "Extraordinario"}{a.notas ? ` · ${a.notas}` : ""}
                      </span>
                      <span className="flex items-center gap-2">
                        <b className="font-medium text-[var(--navy)]">{moneda(a.importe)}</b>
                        {a.tipo === "Extraordinario" && <button type="button" className="text-[var(--red)] hover:underline" onClick={() => quitarExtra(a)}>Quitar</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {CAMPOS.map((c) => (
          <div key={c.k}>
            <label className={labelCls}>{c.t}</label>
            <input type="number" min={0} step="0.01" value={emp[c.k] as number} onChange={(e) => { setEmp({ ...emp, [c.k]: Number(e.target.value) }); setGuardado(false); }} className={inputCls} />
            {c.ayuda && <p className="text-[11px] text-[var(--gray-400)] m-0 mt-0.5">{c.ayuda}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-[13px] text-[var(--text)]">
          <input type="checkbox" checked={emp.incluir} onChange={(e) => { setEmp({ ...emp, incluir: e.target.checked }); setGuardado(false); }} className="w-4 h-4 accent-[var(--navy)]" />
          Incluir en nómina
        </label>
        {caja && (
          <span className="text-[12.5px] text-[var(--gray-500)]">
            Caja de ahorro acumulada (estimada desde el ingreso): <b className="text-[var(--navy)] font-medium">{moneda(caja.acumulado)}</b> · {caja.semanas} semanas
          </span>
        )}
        <div className="flex-1" />
        {!emp.configurado && <span className="text-[11.5px] text-[#a46b00]">Valores por defecto, sin guardar</span>}
        <button type="button" className="btn btn-primario" disabled={ocupado} onClick={guardar}>{guardado ? "✓ Guardado" : "Guardar conceptos"}</button>
      </div>

      {bloqueCreditos(CONCEPTO_LICENCIA)}
      {bloqueCreditos(CONCEPTO_PRESTAMO)}

      {nuevo && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-16 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[440px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-4">{nuevo.concepto === CONCEPTO_LICENCIA ? "Licencia federal" : "Préstamo personal"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>{nuevo.concepto === CONCEPTO_LICENCIA ? "Monto total de la licencia" : "Crédito autorizado"}</label><input type="number" min={0} step="0.01" value={nuevo.monto_total} onChange={(e) => setNuevo({ ...nuevo, monto_total: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Abono semanal</label><input type="number" min={0} step="0.01" value={nuevo.abono_semanal} onChange={(e) => setNuevo({ ...nuevo, abono_semanal: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Inicio de abonos</label><input type="date" value={nuevo.fecha_inicio} onChange={(e) => setNuevo({ ...nuevo, fecha_inicio: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Notas</label><input type="text" value={nuevo.notas} onChange={(e) => setNuevo({ ...nuevo, notas: e.target.value })} className={inputCls} /></div>
            </div>
            {Number(nuevo.monto_total) > 0 && Number(nuevo.abono_semanal) > 0 && (
              <p className="text-[12.5px] text-[var(--gray-500)] mt-3">Se liquida en {Math.ceil(Number(nuevo.monto_total) / Number(nuevo.abono_semanal))} semanas.</p>
            )}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setNuevo(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado} onClick={crearCredito}>Registrar</button>
            </div>
          </div>
        </div>
      )}

      {extra && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-16 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[420px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-1">Abono extraordinario</h3>
            <p className="text-[12.5px] text-[var(--gray-500)] mb-4">{extra.credito.concepto} · saldo {moneda(extra.credito.saldo_corte)}. Se mostrará en el recibo de la semana de esa fecha.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Fecha</label><input type="date" value={extra.fecha} onChange={(e) => setExtra({ ...extra, fecha: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Importe</label><input type="number" min={0} step="0.01" value={extra.importe} onChange={(e) => setExtra({ ...extra, importe: e.target.value })} className={inputCls} /></div>
              <div className="col-span-2"><label className={labelCls}>Notas</label><input type="text" value={extra.notas} onChange={(e) => setExtra({ ...extra, notas: e.target.value })} className={inputCls} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setExtra(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado} onClick={registrarExtra}>Registrar abono</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
