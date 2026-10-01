"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { exportarExcel } from "@/lib/exportExcel";
import { ESTADOS_MX, ahoraMx, lunesDe, semanaIso, sumarDiasIso } from "@/lib/asistenciaData";
import { CAMPOS_VIAJE, GRUPOS_VIAJE, Viaje, etiquetaViaje } from "@/lib/viajesData";

type Unidad = { eco: string; unidad: string | null; placas: string | null };
type Persona = { id: number; nombre: string; puesto: string | null };
type Ruta = { nombre: string; estado_destino: string | null; bono: number };
type Edicion = { id: number | null; eco: string; fecha: string; datos: Record<string, string>; operador_id: number | null; ayudante_id: number | null };

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const etiquetaDia = (iso: string) => `${MESES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

export default function CalendarioViajesPage() {
  const hoy = ahoraMx().fecha;
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDiasIso(lunes, i)), [lunes]);
  const domingo = dias[6];
  const { semana } = semanaIso(lunes);

  const cargar = useCallback(async (desde: string, hasta: string) => {
    try {
      const r = await pedir<{ unidades: Unidad[]; viajes: Viaje[]; personas: Persona[]; rutas: Ruta[] }>(`/api/viajes-calendario?desde=${desde}&hasta=${hasta}`);
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
    cargar(lunes, domingo);
  }, [lunes, domingo, cargar]);

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

  const nuevo = (eco: string, fecha: string) =>
    setEdicion({ id: null, eco, fecha, datos: { ECO: eco, "INICIO DE RUTA PROGRAMADO": `${fecha}T08:00` }, operador_id: null, ayudante_id: null });
  const abrir = (v: Viaje) => setEdicion({ id: v.id, eco: v.eco, fecha: v.fecha, datos: { ...v.datos }, operador_id: v.operador_id, ayudante_id: v.ayudante_id });
  const setDato = (k: string, v: string) => setEdicion((e) => (e ? { ...e, datos: { ...e.datos, [k]: v } } : e));

  const guardar = async () => {
    if (!edicion) return;
    setGuardando(true);
    try {
      const url = edicion.id ? `/api/viajes-calendario?id=${edicion.id}` : "/api/viajes-calendario";
      await pedir(url, { method: edicion.id ? "PUT" : "POST", body: JSON.stringify(edicion) });
      setEdicion(null);
      await cargar(lunes, domingo);
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
      await cargar(lunes, domingo);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo eliminar.");
    }
  };

  const exportar = () =>
    exportarExcel(`Viajes_S${String(semana).padStart(2, "0")}_${lunes.slice(0, 4)}.xlsx`, [
      { nombre: `Semana ${semana}`, filas: viajes.map((v) => ({ FECHA: v.fecha, ...Object.fromEntries(CAMPOS_VIAJE.map((c) => [c.clave, v.datos[c.clave] || ""])) })) },
    ]);

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
        </>
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

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Calendario de viajes"
          subtitulo="Programa y da seguimiento a los viajes por unidad. El operador y el ayudante quedan en Asistencia como “Viaje foráneo”."
          backHref="/control-viajes"
          backLabel="Control de Viajes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="1" y="6" width="14" height="10" rx="1" /><path d="M15 9h4l3 3v4h-7" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></svg>}
        />
        <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-8">
          <div className="flex flex-wrap items-center gap-2.5 p-3 border-b border-[var(--gray-200)]">
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Semana anterior" className="btn btn-secundario px-2.5 py-1.5" onClick={() => setLunes(sumarDiasIso(lunes, -7))}>‹</button>
              <button type="button" className="btn btn-secundario py-1.5" onClick={() => setLunes(lunesDe(hoy))}>Hoy</button>
              <button type="button" aria-label="Semana siguiente" className="btn btn-secundario px-2.5 py-1.5" onClick={() => setLunes(sumarDiasIso(lunes, 7))}>›</button>
            </div>
            <p className="m-0 text-[14px] font-medium text-[var(--navy)]">Semana {semana} · {etiquetaDia(lunes)} – {etiquetaDia(domingo)} {domingo.slice(0, 4)}</p>
            <input type="date" value={lunes} onChange={(e) => e.target.value && setLunes(lunesDe(e.target.value))} className={`${inputCls} w-auto py-1.5`} aria-label="Ir a fecha" />
            <div className="flex-1" />
            <input type="search" placeholder="Buscar ECO, unidad o placas" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} w-[220px] py-1.5`} />
            <button type="button" className="btn btn-secundario py-1.5" onClick={exportar} disabled={!viajes.length}>Exportar Excel</button>
          </div>
          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[1120px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white text-left px-4 py-3 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide w-[190px]">Unidad</th>
                    {dias.map((d, i) => (
                      <th key={d} className={`px-1.5 py-2.5 text-center font-medium ${d === hoy ? "text-[var(--blue)]" : "text-[var(--navy)]"}`}>
                        <span className="block text-[12.5px]">{["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}</span>
                        <span className="block text-[11px] text-[var(--gray-500)] font-normal">{etiquetaDia(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((u) => (
                    <tr key={u.eco} className="hover:bg-[var(--gray-50)]">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 border-t border-[var(--gray-200)] align-top">
                        <p className="m-0 font-medium text-[var(--navy)]">{u.eco}</p>
                        <p className="m-0 text-[11.5px] text-[var(--gray-500)]">{[u.unidad, u.placas].filter(Boolean).join(" · ") || "—"}</p>
                      </td>
                      {dias.map((d) => (
                        <td key={d} className={`px-1.5 py-1.5 border-t border-[var(--gray-200)] align-top ${d === hoy ? "bg-[#f7f9ff]" : ""}`}>
                          <div className="grid gap-1">
                            {(porCelda.get(`${u.eco}|${d}`) || []).map((v) => {
                              const et = etiquetaViaje(v.datos);
                              return (
                                <button key={v.id} type="button" onClick={() => abrir(v)} className="w-full text-left rounded-md border border-[#9ec2ff] bg-[#e8f1ff] text-[#1d4ed8] px-1.5 py-1 text-[11.5px] leading-tight hover:shadow-sm">
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
                  {visibles.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay unidades. Agrégalas en la sección Unidades.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {edicion && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[900px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)] flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[200px]">
                <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{edicion.id ? "Viaje" : "Nuevo viaje"} · {edicion.eco}</h3>
                <p className="text-[12.5px] text-[var(--gray-500)] m-0">Se muestra en el calendario como Cuenta + Estado destino / Ruta + Embarque.</p>
              </div>
              <div>
                <label className={labelCls}>Fecha del viaje</label>
                <input type="date" value={edicion.fecha} onChange={(e) => setEdicion({ ...edicion, fecha: e.target.value })} className={inputCls} />
              </div>
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
