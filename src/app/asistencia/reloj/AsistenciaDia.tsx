"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ESTILO_TIPO, claveVisual, horasTrabajadas, sumarDiasIso, type AsistenciaRegistro, type ClaveEstilo, type TipoAsistencia } from "@/lib/asistenciaData";

type Registro = {
  tipo: TipoAsistencia;
  hora_entrada: string | null;
  hora_salida: string | null;
  retardo: boolean;
  origen: AsistenciaRegistro["origen"];
  estado_salida: "Justificada" | "Anticipada" | null;
  notas: string | null;
  entrada_ts: string | null;
  salida_ts: string | null;
};
type Checada = { hora: string; metodo: string };
type Fila = { id: number; nombre: string; puesto: string | null; employee_no: string; horario: string; registro: Registro | null; checadas: Checada[] };
type Respuesta = {
  fecha: string;
  hoy: string;
  personal: Fila[];
  sin_expediente: { employee_no: string; nombre: string | null; hora: string; metodo: string }[];
  sync: { ok: boolean; nuevas: number; error: string | null } | null;
  reloj: { ultima_sincronizacion: string | null; ultimo_error: string | null } | null;
};

type Estado = "Presente" | "Retardo" | "En turno" | "Sin salida" | "Salida anticipada" | "Sin checada" | "Otro";
type Filtro = "todos" | "presentes" | "retardos" | "en_turno" | "sin_checada";

const inputCls = "border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const ESTILO_SIN: { fondo: string; texto: string; borde: string } = { fondo: "#fdecea", texto: "#b42318", borde: "#f5c2bc" };
const ESTILO_TURNO: { fondo: string; texto: string; borde: string } = { fondo: "#e6f6ee", texto: "#0f7a4a", borde: "#b6e3cb" };

function fechaLarga(iso: string) {
  const d = new Date(iso + "T12:00:00");
  return d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function evaluar(f: Fila, esHoy: boolean): { estado: Estado; etiqueta: string; estilo: { fondo: string; texto: string; borde: string } } {
  const r = f.registro;
  if (!r) {
    if (f.checadas.length) return { estado: "En turno", etiqueta: "Checada sin procesar", estilo: ESTILO_TURNO };
    return { estado: "Sin checada", etiqueta: "Sin checada", estilo: ESTILO_SIN };
  }
  if (r.tipo !== "Asistencia") {
    const clave = claveVisual(r) as ClaveEstilo;
    return { estado: "Otro", etiqueta: clave, estilo: ESTILO_TIPO[clave] };
  }
  if (!r.salida_ts && !r.hora_salida) {
    const base = esHoy ? "En turno" : "Sin salida";
    return { estado: esHoy ? "En turno" : "Sin salida", etiqueta: r.retardo ? `${base} · Retardo` : base, estilo: r.retardo ? ESTILO_TIPO.Retardo : esHoy ? ESTILO_TURNO : ESTILO_TIPO.Retardo };
  }
  const clave = claveVisual(r) as ClaveEstilo;
  if (r.estado_salida === "Anticipada") return { estado: "Salida anticipada", etiqueta: clave, estilo: ESTILO_TIPO[clave] };
  if (r.retardo) return { estado: "Retardo", etiqueta: "Retardo", estilo: ESTILO_TIPO.Retardo };
  return { estado: "Presente", etiqueta: clave === "Asistencia" ? "Asistencia" : clave, estilo: ESTILO_TIPO[clave] };
}

export default function AsistenciaDia() {
  const [fecha, setFecha] = useState("");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const cargar = useCallback(async (f: string, sincronizar = false) => {
    setCargando(true);
    setError("");
    try {
      const qs = new URLSearchParams();
      if (f) qs.set("fecha", f);
      if (sincronizar) qs.set("sincronizar", "1");
      const res = await fetch(`/api/asistencia/reloj/dia?${qs}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo cargar.");
      setDatos(d as Respuesta);
      if (!f) setFecha(d.fecha);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(fecha);
  }, [fecha, cargar]);

  // Hoy: se actualiza solo cada minuto.
  const esHoy = !!datos && datos.fecha === datos.hoy;
  useEffect(() => {
    if (!esHoy) return;
    const t = setInterval(() => cargar(fecha), 60_000);
    return () => clearInterval(t);
  }, [esHoy, fecha, cargar]);

  const filas = useMemo(() => (datos?.personal || []).map((f) => ({ ...f, ev: evaluar(f, esHoy) })), [datos, esHoy]);
  const conteo = useMemo(() => {
    const c = { presentes: 0, retardos: 0, en_turno: 0, sin_checada: 0 };
    for (const f of filas) {
      if (["Presente", "Retardo", "En turno", "Sin salida", "Salida anticipada"].includes(f.ev.estado)) c.presentes++;
      if (f.registro?.tipo === "Asistencia" && f.registro.retardo) c.retardos++;
      if (f.ev.estado === "En turno") c.en_turno++;
      if (f.ev.estado === "Sin checada") c.sin_checada++;
    }
    return c;
  }, [filas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (q && !f.nombre.toLowerCase().includes(q) && f.employee_no !== q) return false;
      if (filtro === "presentes") return ["Presente", "Retardo", "En turno", "Sin salida", "Salida anticipada"].includes(f.ev.estado);
      if (filtro === "retardos") return f.registro?.tipo === "Asistencia" && f.registro.retardo;
      if (filtro === "en_turno") return f.ev.estado === "En turno";
      if (filtro === "sin_checada") return f.ev.estado === "Sin checada";
      return true;
    });
  }, [filas, busqueda, filtro]);

  const ultima = datos?.reloj?.ultima_sincronizacion ? new Date(datos.reloj.ultima_sincronizacion).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : null;
  const errorSync = datos?.sync?.error || datos?.reloj?.ultimo_error || null;

  return (
    <div>
      {/* Fecha y sincronización */}
      <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4 p-3 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Día anterior" className="btn btn-secundario px-2.5 py-1.5" onClick={() => datos && setFecha(sumarDiasIso(datos.fecha, -1))}>‹</button>
          <button type="button" className="btn btn-secundario py-1.5" onClick={() => datos && setFecha(datos.hoy)}>Hoy</button>
          <button type="button" aria-label="Día siguiente" className="btn btn-secundario px-2.5 py-1.5" onClick={() => datos && setFecha(sumarDiasIso(datos.fecha, 1))}>›</button>
        </div>
        <input type="date" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className={inputCls} />
        {datos && <span className="text-[13.5px] font-medium text-[var(--navy)] capitalize">{fechaLarga(datos.fecha)}</span>}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[12px] text-[var(--gray-500)]">{ultima ? `Última lectura del reloj: ${ultima}` : "Aún sin lecturas del reloj"}</span>
          <button type="button" className="btn btn-secundario" disabled={cargando} onClick={() => cargar(fecha, true)}>
            {cargando ? "Leyendo reloj…" : "Sincronizar ahora"}
          </button>
        </div>
        {errorSync && <p className="w-full m-0 text-[12.5px] text-[var(--red)]">{errorSync}</p>}
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[
          { t: "Asistieron", v: conteo.presentes, f: "presentes" as Filtro },
          { t: esHoy ? "En turno ahora" : "Sin salida", v: esHoy ? conteo.en_turno : filas.filter((f) => f.ev.estado === "Sin salida").length, f: "en_turno" as Filtro },
          { t: "Retardos", v: conteo.retardos, f: "retardos" as Filtro, alerta: conteo.retardos > 0 },
          { t: "Sin checada", v: conteo.sin_checada, f: "sin_checada" as Filtro, alerta: conteo.sin_checada > 0 },
        ].map((k) => (
          <button
            key={k.t}
            type="button"
            onClick={() => setFiltro(filtro === k.f ? "todos" : k.f)}
            className={`text-left bg-white border rounded-lg p-3.5 ${filtro === k.f ? "border-[var(--navy)]" : "border-[var(--gray-200)]"}`}
          >
            <p className="m-0 text-[11.5px] uppercase tracking-wide text-[var(--gray-500)]">{k.t}</p>
            <p className={`m-0 mt-1 text-[22px] font-semibold ${k.alerta ? "text-[#b42318]" : "text-[var(--navy)]"}`}>{k.v}</p>
          </button>
        ))}
      </div>

      {error && <p className="mb-3 text-[13px] text-[var(--red)]">{error}</p>}

      <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4">
        <div className="p-3 border-b border-[var(--gray-200)] flex flex-wrap gap-2.5 items-center">
          <input type="search" placeholder="Buscar por nombre o número" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} w-full max-w-[300px]`} />
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} className={`${inputCls} max-w-[220px]`}>
            <option value="todos">Todos</option>
            <option value="presentes">Asistieron</option>
            <option value="en_turno">En turno</option>
            <option value="retardos">Retardos</option>
            <option value="sin_checada">Sin checada</option>
          </select>
          <span className="text-[12px] text-[var(--gray-500)]">1ª checada = entrada · última checada = salida</span>
        </div>
        {cargando && !datos ? (
          <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[960px]">
              <thead>
                <tr className="text-left text-[11.5px] text-[var(--gray-500)] uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Nombre</th>
                  <th className="px-3 py-3 font-medium">Horario</th>
                  <th className="px-3 py-3 font-medium">Entrada</th>
                  <th className="px-3 py-3 font-medium">Salida</th>
                  <th className="px-3 py-3 font-medium">Horas</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  <th className="px-3 py-3 font-medium">Checadas del reloj</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => {
                  const r = f.registro;
                  const esAsistencia = r?.tipo === "Asistencia";
                  const horas = esAsistencia && r?.entrada_ts && r?.salida_ts ? horasTrabajadas(r.entrada_ts, r.salida_ts) : null;
                  return (
                    <tr key={f.id} className="border-t border-[var(--gray-200)] hover:bg-[var(--gray-50)] align-top">
                      <td className="px-4 py-2.5">
                        <Link href={`/personas/expedientes/detalle?id=${f.id}`} className="font-medium text-[var(--navy)] hover:underline">{f.nombre}</Link>
                        <p className="m-0 text-[11.5px] text-[var(--gray-500)]">No. {f.employee_no} · {f.puesto || "—"}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--gray-500)] whitespace-nowrap">{f.horario}</td>
                      <td className={`px-3 py-2.5 font-medium whitespace-nowrap ${esAsistencia && r?.retardo ? "text-[#8a5a00]" : "text-[var(--navy)]"}`}>{esAsistencia ? r?.hora_entrada || "—" : "—"}</td>
                      <td className="px-3 py-2.5 font-medium text-[var(--navy)] whitespace-nowrap">{esAsistencia ? r?.hora_salida || "—" : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">{horas != null ? `${horas} h` : "—"}</td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block rounded-md border px-2 py-0.5 text-[12px] whitespace-nowrap" style={{ background: f.ev.estilo.fondo, color: f.ev.estilo.texto, borderColor: f.ev.estilo.borde }}>
                          {f.ev.etiqueta}
                        </span>
                        {r && r.origen !== "Biométrico" && <p className="m-0 mt-1 text-[11px] text-[var(--gray-500)]">Origen: {r.origen}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        {f.checadas.length ? (
                          <div className="flex flex-wrap gap-1.5">
                            {f.checadas.map((c, i) => (
                              <span key={i} className="inline-block rounded border border-[var(--gray-200)] bg-[var(--gray-50)] px-1.5 py-0.5 text-[11.5px] whitespace-nowrap">
                                {c.hora.slice(0, 5)} · {c.metodo}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[var(--gray-500)]">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!visibles.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-6 text-center text-[var(--gray-500)]">Sin resultados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!!datos?.sin_expediente.length && (
        <div className="bg-white border border-[#f3d79a] rounded-lg mb-4 p-4">
          <p className="m-0 mb-2 text-[13px] font-medium text-[#8a5a00]">Checadas de usuarios del reloj sin expediente</p>
          <div className="flex flex-wrap gap-1.5">
            {datos.sin_expediente.map((c, i) => (
              <span key={i} className="inline-block rounded border border-[var(--gray-200)] px-1.5 py-0.5 text-[12px]">
                No. {c.employee_no} {c.nombre ? `· ${c.nombre}` : ""} · {c.hora.slice(0, 5)} · {c.metodo}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mb-8 text-[12px] text-[var(--gray-500)]">
        Las checadas se leen del reloj automáticamente cada minuto. Los días capturados a mano o con vacaciones, viaje, permiso o falta no se modifican; sus checadas aparecen igual en la última columna.
      </p>
    </div>
  );
}
