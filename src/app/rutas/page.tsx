"use client";
import { useCallback, useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { ESTADOS_MX } from "@/lib/asistenciaData";
import { moneda } from "@/lib/nominaCalculo";
import CampoMoneda from "@/components/CampoMoneda";
import Link from "next/link";
import { TIPOS_UNIDAD_CASETA } from "@/lib/catalogosRutaData";

type BonoUnidad = { eco: string; bono: number };
type Unidad = { eco: string; unidad: string | null };
type Ruta = {
  id: number; nombre: string; estado_destino: string | null; bono: number; activa: boolean; notas: string | null; bonos_unidad: BonoUnidad[];
  origen: string | null; destino: string | null; km: number | null; horas_ida: number | null; horas_regreso_vacio: number | null; horas_regreso_devolucion: number | null;
  casetas: number[]; resguardos: number[]; alimentos: number[]; gasolineras: number[];
};
type Edicion = {
  id: number | null; nombre: string; estado_destino: string; bono: string; activa: boolean; notas: string; bonos_unidad: BonoUnidad[];
  origen: string; destino: string; km: string; horas_ida: string; horas_regreso_vacio: string; horas_regreso_devolucion: string;
  casetas: number[]; resguardos: number[]; alimentos: number[]; gasolineras: number[];
};
type ItemCat = { id: number; nombre: string; datos: Record<string, unknown>; activo: boolean };
type Catalogos = { casetas: ItemCat[]; resguardos: ItemCat[]; alimentos: ItemCat[]; gasolineras: ItemCat[] };
const VACIA: Edicion = { id: null, nombre: "", estado_destino: "", bono: "0", activa: true, notas: "", bonos_unidad: [], origen: "", destino: "", km: "", horas_ida: "", horas_regreso_vacio: "", horas_regreso_devolucion: "", casetas: [], resguardos: [], alimentos: [], gasolineras: [] };
const hrs = (v: number | null) => (v == null ? "—" : `${v} h`);

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

// Catálogo de rutas y bono por ruta. Al asignar la ruta a un viaje foráneo, el bono se suma en la nómina de la semana.
export default function RutasPage() {
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [cats, setCats] = useState<Catalogos>({ casetas: [], resguardos: [], alimentos: [], gasolineras: [] });

  // Catálogos de ruta (solo activos) para elegir casetas y lugares permitidos.
  useEffect(() => {
    (["casetas", "resguardos", "alimentos", "gasolineras"] as const).forEach((t) =>
      fetch(`/api/catalogos-ruta?tipo=${t}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => d.ok && setCats((p) => ({ ...p, [t]: (d.registros || []).filter((x: ItemCat) => x.activo) })))
        .catch(() => {})
    );
  }, []);

  const cargar = useCallback(async () => {
    try {
      const r = await pedir<{ rutas: Ruta[]; unidades: Unidad[] }>("/api/rutas");
      setRutas(r.rutas);
      setUnidades(r.unidades || []);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las rutas.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardar = async () => {
    if (!edicion) return;
    setOcupado(true);
    try {
      const body = JSON.stringify({ ...edicion, bono: Number(edicion.bono) || 0 });
      await pedir("/api/rutas", { method: edicion.id ? "PUT" : "POST", body });
      setEdicion(null);
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  };

  const eliminar = async (r: Ruta) => {
    if (!confirm(`¿Eliminar la ruta “${r.nombre}”? Los viajes que ya la tienen conservan el nombre.`)) return;
    try {
      await pedir(`/api/rutas?id=${r.id}`, { method: "DELETE" });
      await cargar();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Rutas"
          subtitulo="Catálogo de rutas y bono por ruta (según la unidad) para viajes foráneos."
          backHref="/control-viajes"
          backLabel="Control de Viajes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M8.5 19H17a3.5 3.5 0 000-7H7a3.5 3.5 0 010-7h8.5" /></svg>}
        />
        <div className="flex mb-4">
          <button type="button" className="btn btn-primario" onClick={() => setEdicion({ ...VACIA })}>+ Nueva ruta</button>
          <Link href="/catalogos-ruta" className="btn btn-secundario ml-3 no-underline">Catálogos de ruta</Link>
        </div>
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8 overflow-x-auto">
          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            <table className="w-full text-[13px] min-w-[900px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Ruta o destino</th>
                  <th className="px-4 py-3 font-medium">Estado destino</th>
                  <th className="px-4 py-3 font-medium">Origen → destino</th>
                  <th className="px-4 py-3 font-medium">Tiempos (ida · reg. vacío · reg. dev.)</th>
                  <th className="px-4 py-3 font-medium text-center">Casetas</th>
                  <th className="px-4 py-3 font-medium text-right">Bono general</th>
                  <th className="px-4 py-3 font-medium">Bono por unidad</th>
                  <th className="px-4 py-3 font-medium">Estatus</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rutas.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)]">
                    <td className="px-4 py-2.5 font-medium text-[var(--navy)]">{r.nombre}{r.notas && <span className="block text-[11.5px] font-normal text-[var(--gray-500)]">{r.notas}</span>}</td>
                    <td className="px-4 py-2.5 text-[var(--gray-500)]">{r.estado_destino || "—"}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[var(--gray-500)]">{[r.origen, r.destino].filter(Boolean).join(" → ") || "—"}{r.km != null && <span className="block">{r.km} km</span>}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[var(--gray-500)]">{hrs(r.horas_ida)} · {hrs(r.horas_regreso_vacio)} · {hrs(r.horas_regreso_devolucion)}</td>
                    <td className="px-4 py-2.5 text-center text-[12.5px]">{r.casetas?.length || 0}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{moneda(r.bono)}</td>
                    <td className="px-4 py-2.5 text-[12px] text-[var(--gray-500)]">
                      {r.bonos_unidad?.length ? r.bonos_unidad.map((b) => `${b.eco} ${moneda(b.bono)}`).join(" · ") : "Todas usan el general"}
                    </td>
                    <td className="px-4 py-2.5"><span className={`text-[11.5px] font-medium ${r.activa ? "text-[var(--green)]" : "text-[var(--gray-500)]"}`}>{r.activa ? "Activa" : "Inactiva"}</span></td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <button type="button" className="btn btn-secundario py-1.5" onClick={() => setEdicion({ id: r.id, nombre: r.nombre, estado_destino: r.estado_destino || "", bono: String(r.bono), activa: r.activa, notas: r.notas || "", bonos_unidad: [...(r.bonos_unidad || [])], origen: r.origen || "", destino: r.destino || "", km: r.km == null ? "" : String(r.km), horas_ida: r.horas_ida == null ? "" : String(r.horas_ida), horas_regreso_vacio: r.horas_regreso_vacio == null ? "" : String(r.horas_regreso_vacio), horas_regreso_devolucion: r.horas_regreso_devolucion == null ? "" : String(r.horas_regreso_devolucion), casetas: [...(r.casetas || [])], resguardos: [...(r.resguardos || [])], alimentos: [...(r.alimentos || [])], gasolineras: [...(r.gasolineras || [])] })}>Editar</button>
                      <button type="button" className="ml-3 text-[12.5px] text-[var(--red)] hover:underline" onClick={() => eliminar(r)}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {rutas.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-[var(--gray-500)]">Aún no hay rutas. Agrega la primera con “Nueva ruta”.</td></tr>}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {edicion && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-16 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[760px] p-6 shadow-xl max-h-[calc(100vh-4rem)] overflow-y-auto">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-4">{edicion.id ? "Editar ruta" : "Nueva ruta"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2"><label className={labelCls}>Ruta o destino</label><input type="text" value={edicion.nombre} onChange={(e) => setEdicion({ ...edicion, nombre: e.target.value })} placeholder="Ej. CDMX – Monterrey" className={inputCls} /></div>
              <div>
                <label className={labelCls}>Estado destino</label>
                <select value={edicion.estado_destino} onChange={(e) => setEdicion({ ...edicion, estado_destino: e.target.value })} className={inputCls}>
                  <option value="">Selecciona</option>
                  {ESTADOS_MX.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Bono general</label><CampoMoneda valor={Number(edicion.bono) || 0} onCambio={(n) => setEdicion({ ...edicion, bono: String(n) })} /></div>
              <div className="col-span-2 border border-[var(--gray-200)] rounded-lg p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div>
                    <p className="m-0 text-[13px] font-medium text-[var(--navy)]">Bono por unidad</p>
                    <p className="m-0 text-[11.5px] text-[var(--gray-500)]">El monto varía según la unidad. Si la unidad no está aquí, se usa el bono general.</p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secundario py-1 text-[12.5px] shrink-0"
                    disabled={unidades.every((u) => edicion.bonos_unidad.some((b) => b.eco === u.eco))}
                    onClick={() => {
                      const libre = unidades.find((u) => !edicion.bonos_unidad.some((b) => b.eco === u.eco));
                      if (libre) setEdicion({ ...edicion, bonos_unidad: [...edicion.bonos_unidad, { eco: libre.eco, bono: Number(edicion.bono) || 0 }] });
                    }}
                  >
                    + Seleccionar unidad
                  </button>
                </div>
                {edicion.bonos_unidad.length === 0 && <p className="m-0 text-[12px] text-[var(--gray-400)]">Sin bonos por unidad.</p>}
                <div className="grid gap-2">
                  {edicion.bonos_unidad.map((b, i) => (
                    <div key={i} className="grid grid-cols-[1fr_150px_auto] gap-2 items-center">
                      <select
                        value={b.eco}
                        onChange={(e) => setEdicion({ ...edicion, bonos_unidad: edicion.bonos_unidad.map((x, j) => (j === i ? { ...x, eco: e.target.value } : x)) })}
                        className={inputCls}
                        aria-label="Unidad"
                      >
                        {unidades
                          .filter((u) => u.eco === b.eco || !edicion.bonos_unidad.some((x) => x.eco === u.eco))
                          .map((u) => <option key={u.eco} value={u.eco}>{u.eco}{u.unidad ? ` · ${u.unidad}` : ""}</option>)}
                      </select>
                      <CampoMoneda valor={b.bono} ariaLabel={`Bono ${b.eco}`} onCambio={(n) => setEdicion({ ...edicion, bonos_unidad: edicion.bonos_unidad.map((x, j) => (j === i ? { ...x, bono: n } : x)) })} />
                      <button type="button" className="text-[12px] text-[var(--red)] hover:underline px-1" onClick={() => setEdicion({ ...edicion, bonos_unidad: edicion.bonos_unidad.filter((_, j) => j !== i) })}>Quitar</button>
                    </div>
                  ))}
                </div>
              </div>
              <div><label className={labelCls}>Origen</label><input type="text" value={edicion.origen} onChange={(e) => setEdicion({ ...edicion, origen: e.target.value })} placeholder="Ej. Cuautitlán Izcalli" className={inputCls} /></div>
              <div><label className={labelCls}>Destino</label><input type="text" value={edicion.destino} onChange={(e) => setEdicion({ ...edicion, destino: e.target.value })} placeholder="Ej. Monterrey, N.L." className={inputCls} /></div>
              <div className="col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><label className={labelCls}>Kilómetros</label><input type="number" min={0} value={edicion.km} onChange={(e) => setEdicion({ ...edicion, km: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Ida (horas)</label><input type="number" min={0} step="0.25" value={edicion.horas_ida} onChange={(e) => setEdicion({ ...edicion, horas_ida: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Regreso vacío (h)</label><input type="number" min={0} step="0.25" value={edicion.horas_regreso_vacio} onChange={(e) => setEdicion({ ...edicion, horas_regreso_vacio: e.target.value })} className={inputCls} /></div>
                <div><label className={labelCls}>Regreso c/ devolución (h)</label><input type="number" min={0} step="0.25" value={edicion.horas_regreso_devolucion} onChange={(e) => setEdicion({ ...edicion, horas_regreso_devolucion: e.target.value })} className={inputCls} /></div>
              </div>

              <div className="col-span-2 border border-[var(--gray-200)] rounded-lg p-3">
                <p className="m-0 text-[13px] font-medium text-[var(--navy)]">Casetas de la ruta (en orden)</p>
                <p className="m-0 mb-2 text-[11.5px] text-[var(--gray-500)]">El costo por tipo de unidad y la forma de pago (efectivo o PASE) vienen del catálogo de casetas.</p>
                {edicion.casetas.map((cid, i) => {
                  const c = cats.casetas.find((x) => x.id === cid);
                  return (
                    <div key={`${cid}-${i}`} className="flex items-center gap-2 py-1 text-[12.5px]">
                      <span className="w-5 text-[var(--gray-500)]">{i + 1}.</span>
                      <span className="flex-1">{c ? c.nombre : `(caseta eliminada #${cid})`} {c && <span className="text-[11px] text-[var(--gray-500)]">· {String(c.datos.metodo_pago || "")}</span>}</span>
                      <button type="button" className="btn btn-secundario px-2 py-0.5" disabled={i === 0} onClick={() => { const n = [...edicion.casetas]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setEdicion({ ...edicion, casetas: n }); }}>↑</button>
                      <button type="button" className="btn btn-secundario px-2 py-0.5" disabled={i === edicion.casetas.length - 1} onClick={() => { const n = [...edicion.casetas]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; setEdicion({ ...edicion, casetas: n }); }}>↓</button>
                      <button type="button" className="text-[var(--red)] px-1" onClick={() => setEdicion({ ...edicion, casetas: edicion.casetas.filter((_, k) => k !== i) })}>✕</button>
                    </div>
                  );
                })}
                <select value="" onChange={(e) => e.target.value && setEdicion({ ...edicion, casetas: [...edicion.casetas, Number(e.target.value)] })} className={`${inputCls} mt-1`}>
                  <option value="">+ Agregar caseta…</option>
                  {cats.casetas.filter((c) => !edicion.casetas.includes(c.id)).map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.datos.estado ? ` · ${c.datos.estado}` : ""}</option>)}
                </select>
                {edicion.casetas.length > 0 && (
                  <table className="w-full mt-3 text-[12px]">
                    <thead><tr className="text-left text-[var(--gray-500)]"><th className="py-1 font-medium">Tipo de unidad</th><th className="py-1 font-medium text-right">Efectivo</th><th className="py-1 font-medium text-right">PASE</th></tr></thead>
                    <tbody>
                      {TIPOS_UNIDAD_CASETA.map((t) => {
                        const suma = (metodo: string) => edicion.casetas.reduce((a, cid) => {
                          const c = cats.casetas.find((x) => x.id === cid);
                          return c && c.datos.metodo_pago === metodo ? a + (Number((c.datos.costos as Record<string, number> | undefined)?.[t]) || 0) : a;
                        }, 0);
                        return <tr key={t} className="border-t border-[var(--gray-100)]"><td className="py-1">{t}</td><td className="py-1 text-right">{moneda(suma("Efectivo"))}</td><td className="py-1 text-right">{moneda(suma("PASE"))}</td></tr>;
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {([
                ["resguardos", "Resguardos permitidos"],
                ["alimentos", "Proveedores de alimentos permitidos"],
                ["gasolineras", "Gasolineras permitidas"],
              ] as const).map(([clave, titulo]) => (
                <div key={clave} className="col-span-2 border border-[var(--gray-200)] rounded-lg p-3">
                  <p className="m-0 mb-1.5 text-[13px] font-medium text-[var(--navy)]">{titulo}</p>
                  {cats[clave].length === 0 ? (
                    <p className="m-0 text-[12px] text-[var(--gray-400)]">Aún no hay registros en este catálogo.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 max-h-[140px] overflow-y-auto">
                      {cats[clave].map((c) => (
                        <label key={c.id} className="flex items-center gap-2 text-[12.5px]">
                          <input type="checkbox" checked={edicion[clave].includes(c.id)} onChange={(e) => setEdicion({ ...edicion, [clave]: e.target.checked ? [...edicion[clave], c.id] : edicion[clave].filter((x) => x !== c.id) })} />
                          <span>{c.nombre}{c.datos.estado ? <span className="text-[var(--gray-500)]"> · {String(c.datos.estado)}</span> : null}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <div className="col-span-2"><label className={labelCls}>Notas</label><input type="text" value={edicion.notas} onChange={(e) => setEdicion({ ...edicion, notas: e.target.value })} className={inputCls} /></div>
              <label className="col-span-2 flex items-center gap-2 text-[13px]"><input type="checkbox" checked={edicion.activa} onChange={(e) => setEdicion({ ...edicion, activa: e.target.checked })} className="w-4 h-4 accent-[var(--navy)]" />Ruta activa</label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="btn btn-secundario" onClick={() => setEdicion(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={ocupado || !edicion.nombre.trim()} onClick={guardar}>Guardar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
