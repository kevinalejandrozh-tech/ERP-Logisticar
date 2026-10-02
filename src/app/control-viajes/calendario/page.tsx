"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import CampoMoneda from "@/components/CampoMoneda";
import { exportarExcel } from "@/lib/exportExcel";
import { ESTADOS_MX, ahoraMx, lunesDe, sumarDiasIso } from "@/lib/asistenciaData";
import { moneda } from "@/lib/nominaCalculo";
import { CAMPOS_VIAJE, GASTOS_VIAJE, GRUPOS_VIAJE, OPCIONES_TIPO_SERVICIO, Viaje, calcularEstatusViaje, esViajeLocal, etiquetaViaje } from "@/lib/viajesData";

type Unidad = { eco: string; unidad: string | null; placas: string | null };
type Persona = { id: number; nombre: string; puesto: string | null };
type Ruta = { nombre: string; estado_destino: string | null; bono: number; bonos_unidad: Record<string, number> };
type Edicion = { id: number | null; eco: string; fecha: string; datos: Record<string, string>; operador_id: number | null; ayudante_id: number | null };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const etiquetaDia = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const nombreDia = (iso: string) => DIAS[new Date(iso + "T00:00:00Z").getUTCDay()];
const diasEntre = (a: string, b: string) => Math.round((new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime()) / 86400000);
const MAX_DIAS = 62;
const ANCHO_DIA = 150; // ancho fijo de cada columna de día (las etiquetas no lo modifican)
const ANCHO_UNIDAD = 190;
const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const barraCls = "border border-[var(--gray-300)] rounded-md px-3 py-1.5 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

export default function CalendarioViajesPage() {
  const hoy = ahoraMx().fecha;
  const [desde, setDesde] = useState(lunesDe(hoy));
  const [hasta, setHasta] = useState(sumarDiasIso(lunesDe(hoy), 6));
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [gastoAbierto, setGastoAbierto] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const dias = useMemo(() => {
    const n = Math.max(1, Math.min(MAX_DIAS, diasEntre(desde, hasta) + 1));
    return Array.from({ length: n }, (_, i) => sumarDiasIso(desde, i));
  }, [desde, hasta]);
  const ultimo = dias[dias.length - 1];

  const cargar = useCallback(async (d: string, h: string) => {
    try {
      const r = await pedir<{ unidades: Unidad[]; viajes: Viaje[]; personas: Persona[]; rutas: Ruta[] }>(`/api/viajes-calendario?desde=${d}&hasta=${h}`);
      setError("");
      setUnidades(r.unidades);
      setViajes(r.viajes);
      setPersonas(r.personas);
      setRutas(r.rutas);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(desde, ultimo);
  }, [desde, ultimo, cargar]);

  // Cambia el rango respetando el máximo de días.
  const cambiarDesde = (v: string) => {
    if (!v) return;
    setDesde(v);
    if (hasta < v) setHasta(sumarDiasIso(v, 6));
    else if (diasEntre(v, hasta) >= MAX_DIAS) setHasta(sumarDiasIso(v, MAX_DIAS - 1));
  };
  const cambiarHasta = (v: string) => {
    if (!v) return;
    if (v < desde) setDesde(v);
    else if (diasEntre(desde, v) >= MAX_DIAS) setDesde(sumarDiasIso(v, -(MAX_DIAS - 1)));
    setHasta(v);
  };
  const mover = (sentido: 1 | -1) => {
    const n = dias.length;
    setDesde(sumarDiasIso(desde, sentido * n));
    setHasta(sumarDiasIso(ultimo, sentido * n));
  };
  const irHoy = () => {
    const n = dias.length;
    const ini = n === 7 ? lunesDe(hoy) : hoy;
    setDesde(ini);
    setHasta(sumarDiasIso(ini, n - 1));
  };

  const porCelda = useMemo(() => {
    const m = new Map<string, Viaje[]>();
    for (const v of viajes) {
      const k = `${v.eco}|${v.fecha}`;
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(v);
    }
    return m;
  }, [viajes]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return q ? unidades.filter((u) => `${u.eco} ${u.unidad || ""} ${u.placas || ""}`.toLowerCase().includes(q)) : unidades;
  }, [unidades, busqueda]);

  const nuevo = (eco: string, fecha: string) => {
    setGastoAbierto(null);
    setEdicion({ id: null, eco, fecha, datos: { ECO: eco, "TIPO DE SERVICIO": "FORANEO", "INICIO DE RUTA PROGRAMADO": `${fecha}T08:00` }, operador_id: null, ayudante_id: null });
  };
  const abrir = (v: Viaje) => {
    setGastoAbierto(null);
    setEdicion({ id: v.id, eco: v.eco, fecha: v.fecha, datos: { ...v.datos }, operador_id: v.operador_id, ayudante_id: v.ayudante_id });
  };
  const setDato = (k: string, v: string) => setEdicion((e) => (e ? { ...e, datos: { ...e.datos, [k]: v } } : e));

  const guardar = async () => {
    if (!edicion) return;
    setGuardando(true);
    try {
      const url = edicion.id ? `/api/viajes-calendario?id=${edicion.id}` : "/api/viajes-calendario";
      await pedir(url, { method: edicion.id ? "PUT" : "POST", body: JSON.stringify(edicion) });
      setEdicion(null);
      await cargar(desde, ultimo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!edicion?.id || !confirm("¿Eliminar este viaje? También se quitan los días de “Viaje foráneo” que generó en Asistencia.")) return;
    try {
      await pedir(`/api/viajes-calendario?id=${edicion.id}`, { method: "DELETE" });
      setEdicion(null);
      await cargar(desde, ultimo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const exportar = () =>
    exportarExcel(`Viajes_${desde}_a_${ultimo}.xlsx`, [
      { nombre: "Viajes", filas: viajes.map((v) => ({ FECHA: v.fecha, ...Object.fromEntries(CAMPOS_VIAJE.map((c) => [c.clave, v.datos[c.clave] || ""])) })) },
    ]);

  const estatus = edicion ? calcularEstatusViaje(edicion.datos) : { patio: "", almacen: "" };
  const rutaSel = edicion ? rutas.find((r) => r.nombre === edicion.datos["RUTA O DESTINO"]) : undefined;
  const bonoUnidad = rutaSel && edicion ? (rutaSel.bonos_unidad[edicion.eco] ?? rutaSel.bono) : null;

  const campo = (c: (typeof CAMPOS_VIAJE)[number]) => {
    if (!edicion) return null;
    const valor = edicion.datos[c.clave] || "";
    let control: React.ReactNode;
    if (c.tipo === "eco") {
      control = (
        <select value={edicion.eco} onChange={(e) => setEdicion({ ...edicion, eco: e.target.value, datos: { ...edicion.datos, ECO: e.target.value } })} className={inputCls}>
          {unidades.map((u) => <option key={u.eco} value={u.eco}>{u.eco}{u.unidad ? ` · ${u.unidad}` : ""}</option>)}
        </select>
      );
    } else if (c.tipo === "persona") {
      const k = c.clave === "OPERADOR" ? "operador_id" : "ayudante_id";
      control = (
        <select value={edicion[k] ?? ""} onChange={(e) => setEdicion({ ...edicion, [k]: e.target.value ? Number(e.target.value) : null })} className={inputCls}>
          <option value="">Sin asignar</option>
          {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      );
    } else if (c.tipo === "estado") {
      control = (
        <select value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inputCls}>
          <option value="">Selecciona</option>
          {ESTADOS_MX.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
      );
    } else if (c.tipo === "ruta") {
      control = (
        <>
          <input list="rutas-viaje" value={valor} onChange={(e) => {
            const r = rutas.find((x) => x.nombre === e.target.value);
            setEdicion({ ...edicion, datos: { ...edicion.datos, [c.clave]: e.target.value, ...(r?.estado_destino && !edicion.datos["ESTADO DESTINO"] ? { "ESTADO DESTINO": r.estado_destino } : {}) } });
          }} className={inputCls} placeholder="Elige o escribe" />
          <datalist id="rutas-viaje">{rutas.map((r) => <option key={r.nombre} value={r.nombre} />)}</datalist>
          {bonoUnidad !== null && (
            <p className="text-[11.5px] text-[var(--gray-500)] m-0 mt-1">
              {esViajeLocal(edicion.datos) ? "Viaje local: no genera bono por ruta." : <>Bono para {edicion.eco}: <b className="text-[var(--navy)] font-medium">{moneda(bonoUnidad)}</b></>}
            </p>
          )}
        </>
      );
    } else if (c.tipo === "calculado") {
      const v = c.clave === "ESTATUS PATIO" ? estatus.patio : estatus.almacen;
      control = (
        <div className={`${inputCls} bg-[var(--gray-100)] font-medium ${v === "Tarde" ? "text-[var(--red)]" : v ? "text-[var(--green)]" : "text-[var(--gray-400)]"}`}>
          {v || "Se calcula automáticamente"}
        </div>
      );
    } else {
      control = (
        <input type={c.tipo === "fecha_hora" ? "datetime-local" : c.tipo === "numero" ? "number" : "text"} min={c.tipo === "numero" ? 0 : undefined} value={valor} onChange={(e) => setDato(c.clave, e.target.value)} className={inputCls} />
      );
    }
    return (
      <div key={c.clave}>
        <label className={labelCls}>{c.etiqueta}</label>
        {control}
      </div>
    );
  };

  const anchoTabla = ANCHO_UNIDAD + dias.length * ANCHO_DIA;
  const gastoSel = GASTOS_VIAJE.find((g) => g.clave === gastoAbierto);

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Calendario de viajes"
          subtitulo="Programa y da seguimiento a los viajes por unidad. Los viajes foráneos quedan en Asistencia como “Viaje foráneo”."
          backHref="/control-viajes"
          backLabel="Control de Viajes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>}
        />
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8">
          <div className="flex flex-wrap items-center gap-2.5 p-3 border-b border-[var(--gray-200)]">
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Rango anterior" className="btn btn-secundario px-2.5 py-1.5" onClick={() => mover(-1)}>‹</button>
              <button type="button" className="btn btn-secundario py-1.5" onClick={irHoy}>Hoy</button>
              <button type="button" aria-label="Rango siguiente" className="btn btn-secundario px-2.5 py-1.5" onClick={() => mover(1)}>›</button>
            </div>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gray-500)]">
              Desde
              <input type="date" value={desde} onChange={(e) => cambiarDesde(e.target.value)} className={barraCls} />
            </label>
            <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--gray-500)]">
              Hasta
              <input type="date" value={ultimo} min={desde} max={sumarDiasIso(desde, MAX_DIAS - 1)} onChange={(e) => cambiarHasta(e.target.value)} className={barraCls} />
            </label>
            <p className="m-0 text-[13px] font-medium text-[var(--navy)]">{etiquetaDia(desde)} – {etiquetaDia(ultimo)} {ultimo.slice(0, 4)} · {dias.length} día(s)</p>
            <div className="flex-1" />
            <input type="search" placeholder="Buscar ECO, unidad o placas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${barraCls} w-[220px]`} />
            <button type="button" className="btn btn-secundario py-1.5" onClick={exportar} disabled={!viajes.length}>Exportar Excel</button>
          </div>
          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            // Desplazamiento en ambos sentidos: encabezados de días fijos arriba y columna "Unidad" fija a la izquierda.
            <div className="overflow-auto max-h-[calc(100vh-240px)] min-h-[320px]">
              <table className="text-[13px] border-separate border-spacing-0 table-fixed" style={{ width: anchoTabla }}>
                <colgroup>
                  <col style={{ width: ANCHO_UNIDAD }} />
                  {dias.map((d) => <col key={d} style={{ width: ANCHO_DIA }} />)}
                </colgroup>
                <thead>
                  <tr>
                    <th className="sticky left-0 top-0 z-30 bg-white text-left px-4 py-3 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide border-b border-r border-[var(--gray-200)]">Unidad</th>
                    {dias.map((d) => (
                      <th key={d} className={`sticky top-0 z-20 px-1.5 py-2.5 text-center font-medium border-b border-[var(--gray-200)] ${d === hoy ? "bg-[#f2f6ff] text-[var(--blue)]" : "bg-white text-[var(--navy)]"}`}>
                        <span className="block text-[12.5px]">{nombreDia(d)}</span>
                        <span className="block text-[11px] text-[var(--gray-500)] font-normal">{etiquetaDia(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((u) => (
                    <tr key={u.eco} className="group">
                      <td className="sticky left-0 z-10 bg-white group-hover:bg-[var(--gray-50)] px-4 py-2 border-b border-r border-[var(--gray-200)] align-top">
                        <p className="m-0 font-medium text-[var(--navy)]">{u.eco}</p>
                        <p className="m-0 text-[11.5px] text-[var(--gray-500)] truncate">{[u.unidad, u.placas].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      {dias.map((d) => (
                        <td key={d} className={`px-1.5 py-1.5 border-b border-[var(--gray-200)] align-top overflow-hidden ${d === hoy ? "bg-[#f7f9ff]" : "bg-white group-hover:bg-[var(--gray-50)]"}`}>
                          <div className="grid gap-1 min-w-0">
                            {(porCelda.get(`${u.eco}|${d}`) || []).map((v) => {
                              const et = etiquetaViaje(v.datos);
                              const local = esViajeLocal(v.datos);
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => abrir(v)}
                                  title={[et.linea1, et.linea2].filter(Boolean).join(" · ")}
                                  className={`w-full min-w-0 overflow-hidden text-center rounded-md border px-1.5 py-1 text-[11.5px] leading-tight hover:shadow-sm ${local ? "border-[#b9e5df] bg-[#e6f6f4] text-[#0f766e]" : "border-[#9ec2ff] bg-[#e8f1ff] text-[#1d4ed8]"}`}
                                >
                                  <span className="block font-medium truncate">{et.linea1}</span>
                                  {et.linea2 && <span className="block opacity-80 truncate">{et.linea2}</span>}
                                </button>
                              );
                            })}
                            <button type="button" onClick={() => nuevo(u.eco, d)} className="w-full h-[26px] rounded-md border border-dashed border-[var(--gray-200)] text-[var(--gray-400)] text-[12px] hover:border-[var(--blue)] hover:text-[var(--blue)]" aria-label={`Agregar viaje ${u.eco} ${d}`}>+</button>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {visibles.length === 0 && <tr><td colSpan={dias.length + 1} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay unidades. Agrégalas en la sección Unidades.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {edicion && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[900px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)] grid gap-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{edicion.id ? "Viaje" : "Nuevo viaje"} · {edicion.eco}</h3>
                  <p className="text-[12.5px] text-[var(--gray-500)] m-0">Se muestra en el calendario como Cuenta + Estado destino / Ruta + Embarque.</p>
                </div>
              </div>
              {/* Datos principales arriba: número de embarque, foráneo/local y fecha */}
              <div className="grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr] gap-3 items-end">
                <div>
                  <label className={labelCls}>No. embarque</label>
                  <input type="text" value={edicion.datos["No EMBARQUE"] || ""} onChange={(e) => setDato("No EMBARQUE", e.target.value)} className={`${inputCls} font-medium`} autoFocus={!edicion.id} />
                </div>
                <div>
                  <label className={labelCls}>Tipo de servicio</label>
                  <div className="grid grid-cols-2 rounded-md border border-[var(--gray-300)] overflow-hidden">
                    {OPCIONES_TIPO_SERVICIO.map((o) => {
                      const activo = (edicion.datos["TIPO DE SERVICIO"] || "FORANEO").toUpperCase() === o.valor;
                      return (
                        <button key={o.valor} type="button" onClick={() => setDato("TIPO DE SERVICIO", o.valor)} className={`py-2 text-[13px] font-medium ${activo ? "bg-[var(--navy)] text-white" : "bg-white text-[var(--navy)] hover:bg-[var(--gray-50)]"}`}>
                          {o.etiqueta}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Fecha del viaje</label>
                  <input type="date" value={edicion.fecha} onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {GASTOS_VIAJE.map((g) => {
                  const monto = Number(edicion.datos[g.clave]) || 0;
                  return (
                    <button key={g.clave} type="button" onClick={() => setGastoAbierto(gastoAbierto === g.clave ? null : g.clave)} className={`btn py-1.5 ${gastoAbierto === g.clave ? "btn-primario" : "btn-secundario"}`}>
                      {g.boton}
                      {monto > 0 && <span className={`text-[11.5px] rounded px-1.5 py-0.5 ${gastoAbierto === g.clave ? "bg-white/20" : "bg-[var(--blue-light)] text-[var(--blue)]"}`}>{moneda(monto)}</span>}
                    </button>
                  );
                })}
              </div>
              {gastoSel && (
                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-3 bg-[var(--gray-50)] border border-[var(--gray-200)] rounded-lg p-3">
                  <div>
                    <label className={labelCls}>{gastoSel.boton} · monto</label>
                    <CampoMoneda valor={Number(edicion.datos[gastoSel.clave]) || 0} onCambio={(n) => setDato(gastoSel.clave, n ? String(n) : "")} />
                  </div>
                  <div>
                    <label className={labelCls}>Detalle / comentario</label>
                    <input type="text" value={edicion.datos[`${gastoSel.clave} DETALLE`] || ""} onChange={(e) => setDato(`${gastoSel.clave} DETALLE`, e.target.value)} className={inputCls} placeholder="Ej. casetas México–Querétaro, folio de transferencia…" />
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 grid gap-5">
              {GRUPOS_VIAJE.map((g) => (
                <section key={g}>
                  <h4 className="text-[12px] font-medium text-[var(--gray-500)] uppercase tracking-wide mb-2">{g}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{CAMPOS_VIAJE.filter((c) => c.grupo === g).map(campo)}</div>
                </section>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              {edicion.id && <button type="button" className="mr-auto text-[12.5px] text-[var(--red)] hover:underline" onClick={eliminar}>Eliminar viaje</button>}
              <button type="button" className="btn btn-secundario" onClick={() => setEdicion(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
