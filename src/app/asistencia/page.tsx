"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { exportarExcel } from "@/lib/exportExcel";
import {
  ASISTENCIA_CONFIG_DEFAULT,
  AsistenciaConfig,
  AsistenciaEmpleado,
  AsistenciaRegistro,
  ClaveEstilo,
  DIAS_CORTOS,
  ESTADOS_MX,
  ESTILO_TIPO,
  TIPOS_ASISTENCIA,
  TIPOS_TRABAJADOS,
  TipoAsistencia,
  ahoraMx,
  claveVisual,
  evaluarJornada,
  horarioDe,
  horasTrabajadas,
  lunesDe,
  minutos,
  semanaIso,
  sumarDiasIso,
} from "@/lib/asistenciaData";

type Ruta = { nombre: string; estado_destino: string | null; bono: number };

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- debe coincidir con la declaración global de otros módulos
    QRious: any;
  }
}
function cargarQRious(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.QRious) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el generador de QR."));
    document.body.appendChild(s);
  });
}

async function pedir<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Ocurrió un error.");
  return data as T;
}

const MESES = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"];
const inputCls = "w-full border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const labelCls = "block text-[12px] font-medium text-[var(--text)] mb-1";

type Edicion = {
  empleado: AsistenciaEmpleado;
  fecha: string;
  existente: boolean;
  origen: string | null;
  tipo: TipoAsistencia;
  entrada_ts: string;
  salida_ts: string;
  fecha_hasta: string;
  notas: string;
  estado_destino: string;
  ruta: string;
};

function formatoHoras(h: number): string {
  const total = Math.round(h * 60);
  return `${Math.floor(total / 60)} h ${String(total % 60).padStart(2, "0")} min`;
}

function etiquetaDia(iso: string) {
  return `${MESES[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8, 10))}`;
}

function Celda({ reg, esFuturo, onClick }: { reg?: AsistenciaRegistro; esFuturo: boolean; onClick: () => void }) {
  if (!reg) {
    return (
      <button type="button" onClick={onClick} className="w-full h-[38px] rounded-md border border-dashed border-[var(--gray-200)] text-[var(--gray-400)] text-[12px] hover:border-[var(--blue)] hover:text-[var(--blue)]">
        {esFuturo ? "+" : "Sin registro"}
      </button>
    );
  }
  const clave = claveVisual(reg);
  const e = ESTILO_TIPO[clave];
  const horas = horasTrabajadas(reg.entrada_ts, reg.salida_ts);
  const cruza = reg.entrada_ts && reg.salida_ts && reg.salida_ts.slice(0, 10) !== reg.entrada_ts.slice(0, 10);
  return (
    <button type="button" onClick={onClick} title={reg.notas || undefined} className="w-full min-h-[38px] rounded-md border px-1.5 py-1 text-[12px] leading-tight hover:shadow-sm" style={{ background: e.fondo, color: e.texto, borderColor: e.borde }}>
      {reg.tipo === "Asistencia" ? (
        <>
          <span className="font-medium">{reg.hora_entrada || "--:--"} | {reg.hora_salida || "--:--"}{cruza ? " +1" : ""}</span>
          <span className="block text-[10.5px] opacity-80">{clave}{horas ? ` · ${horas} h` : ""}{reg.origen === "QR" ? " · QR" : ""}</span>
        </>
      ) : reg.tipo === "Viaje foráneo" ? (
        <>
          <span className="font-medium">Viaje foráneo</span>
          <span className="block text-[10.5px] opacity-80 truncate">{[reg.estado_destino, reg.ruta].filter(Boolean).join(" · ") || "Sin destino"}</span>
        </>
      ) : (
        <span className="font-medium">{clave}</span>
      )}
    </button>
  );
}

export default function AsistenciaPage() {
  const hoy = ahoraMx().fecha;
  const [lunes, setLunes] = useState(lunesDe(hoy));
  const [empleados, setEmpleados] = useState<AsistenciaEmpleado[]>([]);
  const [registros, setRegistros] = useState<AsistenciaRegistro[]>([]);
  const [rutas, setRutas] = useState<Ruta[]>([]);
  const [config, setConfig] = useState<AsistenciaConfig>(ASISTENCIA_CONFIG_DEFAULT);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [area, setArea] = useState("");
  const [edicion, setEdicion] = useState<Edicion | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [modalQr, setModalQr] = useState(false);
  const [qr, setQr] = useState("");
  const [modalConfig, setModalConfig] = useState(false);
  const [cfgEdit, setCfgEdit] = useState<AsistenciaConfig>(ASISTENCIA_CONFIG_DEFAULT);

  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => sumarDiasIso(lunes, i)), [lunes]);
  const domingo = dias[6];
  const { semana, anio } = semanaIso(lunes);

  const cargar = useCallback(async (desde: string, hasta: string) => {
    try {
      const r = await pedir<{ config: AsistenciaConfig; empleados: AsistenciaEmpleado[]; registros: AsistenciaRegistro[]; rutas: Ruta[] }>(`/api/asistencia?desde=${desde}&hasta=${hasta}`);
      setError("");
      setConfig(r.config);
      setEmpleados(r.empleados);
      setRegistros(r.registros);
      setRutas(r.rutas || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar la asistencia.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(lunes, domingo);
  }, [lunes, domingo, cargar]);

  const mapa = useMemo(() => {
    const m = new Map<string, AsistenciaRegistro>();
    for (const r of registros) m.set(`${r.expediente_id}|${r.fecha}`, r);
    return m;
  }, [registros]);

  const areas = useMemo(() => Array.from(new Set(empleados.map((e) => (e.area || "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, "es")), [empleados]);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return empleados.filter((e) => (!area || (e.area || "").trim() === area) && (!q || e.nombre.toLowerCase().includes(q) || (e.puesto || "").toLowerCase().includes(q)));
  }, [empleados, busqueda, area]);

  // Total de horas en servicio de la semana por persona.
  const horasPorPersona = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of registros) m.set(r.expediente_id, (m.get(r.expediente_id) || 0) + horasTrabajadas(r.entrada_ts, r.salida_ts));
    return m;
  }, [registros]);

  const resumen = useMemo(() => {
    const ids = new Set(visibles.map((e) => e.id));
    const r = registros.filter((x) => ids.has(x.expediente_id));
    return {
      asistencias: r.filter((x) => TIPOS_TRABAJADOS.includes(x.tipo)).length,
      retardos: r.filter((x) => x.tipo === "Asistencia" && x.retardo).length,
      faltas: r.filter((x) => x.tipo === "Falta").length,
      justificadas: r.filter((x) => ["Vacaciones", "Descanso", "Permiso", "Incapacidad"].includes(x.tipo)).length,
    };
  }, [registros, visibles]);

  const abrirCelda = (empleado: AsistenciaEmpleado, fecha: string) => {
    const r = mapa.get(`${empleado.id}|${fecha}`);
    const h = horarioDe(empleado, config);
    const salidaDia = (minutos(h.hora_salida) ?? 0) <= (minutos(h.hora_entrada) ?? 0) ? sumarDiasIso(fecha, 1) : fecha;
    setEdicion({
      empleado,
      fecha,
      existente: !!r,
      origen: r?.origen || null,
      tipo: r?.tipo || "Asistencia",
      entrada_ts: r?.entrada_ts || `${fecha}T${h.hora_entrada}`,
      salida_ts: r ? r.salida_ts || "" : `${salidaDia}T${h.hora_salida}`,
      fecha_hasta: fecha,
      notas: r?.notas || "",
      estado_destino: r?.estado_destino || "",
      ruta: r?.ruta || "",
    });
  };

  const guardar = async () => {
    if (!edicion) return;
    setGuardando(true);
    try {
      const conHoras = edicion.tipo === "Asistencia" || edicion.tipo === "Viaje foráneo";
      await pedir("/api/asistencia", {
        method: "PUT",
        body: JSON.stringify({
          expediente_id: edicion.empleado.id,
          fecha: edicion.fecha,
          fecha_hasta: edicion.tipo === "Asistencia" ? edicion.fecha : edicion.fecha_hasta,
          tipo: edicion.tipo,
          entrada_ts: conHoras ? edicion.entrada_ts : "",
          salida_ts: conHoras ? edicion.salida_ts : "",
          estado_destino: edicion.estado_destino,
          ruta: edicion.ruta,
          notas: edicion.notas,
        }),
      });
      setEdicion(null);
      await cargar(lunes, domingo);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!edicion || !confirm("¿Eliminar este registro?")) return;
    try {
      await pedir(`/api/asistencia?expediente_id=${edicion.empleado.id}&fecha=${edicion.fecha}`, { method: "DELETE" });
      setEdicion(null);
      await cargar(lunes, domingo);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  };

  const linkRegistro = () => `${window.location.origin}/asistencia/registro`;
  const abrirQr = () => {
    setModalQr(true);
    cargarQRious()
      .then(() => setQr(new window.QRious({ value: linkRegistro(), size: 320, level: "M" }).toDataURL()))
      .catch(() => setQr(""));
  };
  const imprimirQr = () => {
    const v = window.open("", "_blank", "width=700,height=800");
    if (!v || !qr) return;
    v.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>QR de asistencia</title>
<style>body{font-family:Roboto,"Segoe UI",Arial,sans-serif;text-align:center;color:#16215c;margin:0;padding:40px}
h1{font-weight:500;font-size:26px;margin:0 0 6px}p{color:#4b5563;margin:0 0 24px;font-size:15px}img{width:340px;height:340px}
.pie{margin-top:24px;font-size:13px;color:#6b7280}button{margin-top:24px;background:#16215c;color:#fff;border:0;border-radius:6px;padding:10px 22px;font-size:14px}
@media print{button{display:none}}</style></head><body>
<h1>Registro de asistencia</h1><p>Escanea con tu celular, selecciona tu nombre y listo.<br/>Primer escaneo del día: entrada · siguiente: salida.</p>
<img src="${qr}" alt="QR"/><div class="pie">Transportes Logisticar</div>
<button onclick="window.print()">Imprimir</button></body></html>`);
    v.document.close();
  };

  const exportar = () => {
    exportarExcel(`Asistencia_S${String(semana).padStart(2, "0")}_${anio}.xlsx`, [
      {
        nombre: `Semana ${semana}`,
        filas: visibles.map((e) => {
          const fila: Record<string, unknown> = { Nombre: e.nombre, Puesto: e.puesto || "", Área: e.area || "" };
          dias.forEach((d, i) => {
            const r = mapa.get(`${e.id}|${d}`);
            fila[`${DIAS_CORTOS[i]} ${d.slice(8)}`] = !r
              ? ""
              : r.tipo === "Asistencia"
                ? `${r.hora_entrada || ""}-${r.hora_salida || ""} ${claveVisual(r)}`
                : r.tipo === "Viaje foráneo"
                  ? `Viaje: ${[r.estado_destino, r.ruta].filter(Boolean).join(" / ")}`
                  : claveVisual(r);
          });
          fila["Horas en servicio"] = Math.round((horasPorPersona.get(e.id) || 0) * 100) / 100;
          return fila;
        }),
      },
    ]);
  };

  const guardarConfig = async () => {
    setGuardando(true);
    try {
      const r = await pedir<{ config: AsistenciaConfig }>("/api/asistencia/config", { method: "PUT", body: JSON.stringify(cfgEdit) });
      setConfig(r.config);
      setModalConfig(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
        <PageHeader
          titulo="Asistencia"
          subtitulo="Calendario semanal, registro por QR, vacaciones, descansos, permisos y faltas."
          backHref="/"
          backLabel="Menú principal"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M8 15l2.5 2.5L16 13" /></svg>
          }
        />

        <div className="flex flex-wrap items-center gap-2.5 mb-4">
          <button type="button" className="btn btn-primario" onClick={abrirQr}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3" /></svg>
            Código QR de registro
          </button>
          <Link href="/asistencia/vacaciones" className="btn btn-secundario">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v2M5.6 5.6l1.4 1.4M3 12h2M18.4 5.6 17 7M21 12h-2" /><circle cx="12" cy="12" r="4" /><path d="M4 20h16" /></svg>
            Vacaciones
          </Link>
          <Link href="/asistencia/reloj" className="btn btn-secundario">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="2" width="12" height="20" rx="2" /><circle cx="12" cy="14" r="3" /><path d="M10 6h4" /></svg>
            Reloj checador
          </Link>
          <button type="button" className="btn btn-secundario" onClick={exportar} disabled={cargando}>Exportar Excel</button>
          <button type="button" className="btn btn-secundario" onClick={() => { setCfgEdit(config); setModalConfig(true); }}>Horario y tolerancia</button>
        </div>

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
            <input type="search" placeholder="Buscar nombre o puesto" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} w-[220px] py-1.5`} />
            <select value={area} onChange={(e) => setArea(e.target.value)} className={`${inputCls} w-auto py-1.5`}>
              <option value="">Todas las áreas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-1 px-4 py-2.5 border-b border-[var(--gray-200)] text-[12.5px] text-[var(--gray-500)]">
            <span>Asistencias: <b className="text-[var(--navy)] font-medium">{resumen.asistencias}</b></span>
            <span>Retardos: <b className="text-[var(--navy)] font-medium">{resumen.retardos}</b></span>
            <span>Faltas: <b className="text-[var(--navy)] font-medium">{resumen.faltas}</b></span>
            <span>Ausencias justificadas: <b className="text-[var(--navy)] font-medium">{resumen.justificadas}</b></span>
            <span className="ml-auto">Entrada {config.hora_entrada} · tolerancia {config.tolerancia_min} min</span>
          </div>

          {error && <p className="m-4 text-[13px] text-[var(--red)]">{error}</p>}
          {cargando ? (
            <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[1040px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 bg-white text-left px-4 py-3 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide w-[260px]">Nombre · horas en servicio</th>
                    {dias.map((d, i) => (
                      <th key={d} className={`px-1.5 py-2.5 text-center font-medium ${d === hoy ? "text-[var(--blue)]" : "text-[var(--navy)]"}`}>
                        <span className="block text-[12.5px]">{["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"][i]}</span>
                        <span className="block text-[11px] text-[var(--gray-500)] font-normal">{etiquetaDia(d)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e) => (
                    <tr key={e.id} className="hover:bg-[var(--gray-50)]">
                      <td className="sticky left-0 z-10 bg-white px-4 py-2 border-t border-[var(--gray-200)]">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <Link href={`/personas/expedientes/detalle?id=${e.id}`} className="font-medium text-[var(--navy)] leading-tight hover:underline">{e.nombre}</Link>
                            <p className="m-0 text-[11.5px] text-[var(--gray-500)]">{[e.puesto, e.area].filter(Boolean).join(" · ") || "—"}</p>
                          </div>
                          <span className="shrink-0 rounded bg-[var(--gray-100)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--navy)]" title="Horas en servicio de la semana">
                            {Math.round((horasPorPersona.get(e.id) || 0) * 10) / 10} h
                          </span>
                        </div>
                      </td>
                      {dias.map((d) => (
                        <td key={d} className={`px-1.5 py-2 border-t border-[var(--gray-200)] ${d === hoy ? "bg-[#f7f9ff]" : ""}`}>
                          <Celda reg={mapa.get(`${e.id}|${d}`)} esFuturo={d > hoy} onClick={() => abrirCelda(e, d)} />
                        </td>
                      ))}
                    </tr>
                  ))}
                  {visibles.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-8 text-center text-[var(--gray-500)]">No hay personal para mostrar.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex flex-wrap gap-2 px-4 py-3 border-t border-[var(--gray-200)]">
            {(["Asistencia", "Retardo", "Salida justificada", "Salida anticipada", ...TIPOS_ASISTENCIA.filter((t) => t !== "Asistencia"), "Vacaciones adelanto"] as ClaveEstilo[]).map((t) => (
              <span key={t} className="rounded px-2 py-0.5 text-[11.5px] border" style={{ background: ESTILO_TIPO[t].fondo, color: ESTILO_TIPO[t].texto, borderColor: ESTILO_TIPO[t].borde }}>{t}</span>
            ))}
          </div>
        </div>
      </div>

      {edicion && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-12 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[560px] shadow-xl">
            <div className="px-6 py-4 border-b border-[var(--gray-200)]">
              <h3 className="text-[17px] font-medium text-[var(--navy)] m-0">{edicion.empleado.nombre}</h3>
              <p className="text-[12.5px] text-[var(--gray-500)] m-0">{etiquetaDia(edicion.fecha)} {edicion.fecha.slice(0, 4)}</p>
            </div>
            <div className="p-6 grid gap-4">
              <div>
                <label className={labelCls}>Tipo de registro</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {TIPOS_ASISTENCIA.map((t) => (
                    <button key={t} type="button" onClick={() => setEdicion({ ...edicion, tipo: t })}
                      className="rounded-md border px-2 py-2 text-[12.5px] font-medium"
                      style={edicion.tipo === t ? { background: ESTILO_TIPO[t].fondo, color: ESTILO_TIPO[t].texto, borderColor: ESTILO_TIPO[t].texto } : { borderColor: "var(--gray-300)", color: "var(--gray-500)" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {(edicion.tipo === "Asistencia" || edicion.tipo === "Viaje foráneo") && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div><label className={labelCls}>Fecha y hora de ingreso{edicion.tipo === "Viaje foráneo" ? " (opcional)" : ""}</label><input type="datetime-local" value={edicion.entrada_ts} onChange={(e) => setEdicion({ ...edicion, entrada_ts: e.target.value })} className={inputCls} /></div>
                  <div><label className={labelCls}>Fecha y hora de salida</label><input type="datetime-local" value={edicion.salida_ts} min={edicion.entrada_ts} onChange={(e) => setEdicion({ ...edicion, salida_ts: e.target.value })} className={inputCls} /></div>
                </div>
              )}
              {edicion.tipo === "Asistencia" && edicion.entrada_ts && (() => {
                const h = horarioDe(edicion.empleado, config);
                const ev = evaluarJornada(edicion.entrada_ts, edicion.salida_ts || null, h);
                const clave = claveVisual({ tipo: "Asistencia", retardo: ev.retardo, estado_salida: ev.estado_salida, origen: "Manual" });
                const e = ESTILO_TIPO[clave];
                const horas = horasTrabajadas(edicion.entrada_ts, edicion.salida_ts || null);
                return (
                  <p className="m-0 text-[12.5px] rounded-md border px-3 py-2" style={{ background: e.fondo, color: e.texto, borderColor: e.borde }}>
                    Se registrará como <b className="font-medium">{clave}</b>{horas ? ` · ${formatoHoras(horas)} en servicio` : ""} · horario {h.hora_entrada}–{h.hora_salida}
                  </p>
                );
              })()}
              {edicion.tipo === "Viaje foráneo" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Ruta o destino</label>
                    <input list="rutas-asistencia" value={edicion.ruta} onChange={(e) => {
                      const ruta = rutas.find((x) => x.nombre === e.target.value);
                      setEdicion({ ...edicion, ruta: e.target.value, estado_destino: ruta?.estado_destino || edicion.estado_destino });
                    }} className={inputCls} placeholder="Elige o escribe" />
                    <datalist id="rutas-asistencia">{rutas.map((r) => <option key={r.nombre} value={r.nombre}>{r.bono ? `Bono ${r.bono}` : ""}</option>)}</datalist>
                  </div>
                  <div>
                    <label className={labelCls}>Estado destino</label>
                    <select value={edicion.estado_destino} onChange={(e) => setEdicion({ ...edicion, estado_destino: e.target.value })} className={inputCls}>
                      <option value="">Selecciona</option>
                      {ESTADOS_MX.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                  {edicion.origen === "Viaje" && <p className="sm:col-span-2 m-0 text-[11.5px] text-[var(--gray-500)]">Asignado desde Control de viajes.</p>}
                </div>
              )}
              {edicion.tipo !== "Asistencia" && (
                <div>
                  <label className={labelCls}>Aplicar hasta (opcional, varios días)</label>
                  <input type="date" min={edicion.fecha} max={sumarDiasIso(edicion.fecha, 30)} value={edicion.fecha_hasta} onChange={(e) => setEdicion({ ...edicion, fecha_hasta: e.target.value || edicion.fecha })} className={inputCls} />
                  {edicion.tipo === "Vacaciones" && <p className="m-0 mt-1 text-[11.5px] text-[#8a5a00]">Las vacaciones capturadas aquí se marcan como “adelanto”. Para programarlas usa el botón Vacaciones.</p>}
                </div>
              )}
              <div><label className={labelCls}>Notas</label><input type="text" value={edicion.notas} onChange={(e) => setEdicion({ ...edicion, notas: e.target.value })} placeholder="Ej. Vacaciones autorizadas por RH" className={inputCls} /></div>
            </div>
            <div className="px-6 py-4 border-t border-[var(--gray-200)] flex flex-wrap justify-end gap-2">
              {edicion.existente && <button type="button" className="mr-auto text-[12.5px] text-[var(--red)] hover:underline" onClick={eliminar}>Eliminar registro</button>}
              <button type="button" className="btn btn-secundario" onClick={() => setEdicion(null)}>Cancelar</button>
              <button type="button" className="btn btn-primario" disabled={guardando} onClick={guardar}>{guardando ? "Guardando…" : "Guardar"}</button>
            </div>
          </div>
        </div>
      )}

      {modalQr && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-12 overflow-y-auto z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[420px] p-6 shadow-xl text-center">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-1">Código QR de asistencia</h3>
            <p className="text-[12.5px] text-[var(--gray-500)] mb-4">Colócalo en la entrada. Cada persona escanea, elige su nombre y se registra su hora. Primer escaneo del día = entrada; el siguiente = salida.</p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR de registro de asistencia" className="w-[240px] h-[240px] mx-auto border border-[var(--gray-200)] rounded-lg p-2" />
            ) : (
              <div className="w-[240px] h-[240px] mx-auto border border-[var(--gray-200)] rounded-lg flex items-center justify-center text-[12px] text-[var(--gray-500)]">Generando QR…</div>
            )}
            <div className="bg-[var(--gray-100)] rounded-md px-3 py-2 text-[11.5px] break-all text-[var(--navy)] mt-3">{linkRegistro()}</div>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              <button type="button" className="btn btn-primario" onClick={imprimirQr} disabled={!qr}>Imprimir cartel</button>
              {qr && <a className="btn btn-secundario" href={qr} download="QR_Asistencia.png">Descargar QR</a>}
              <button type="button" className="btn btn-secundario" onClick={() => setModalQr(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {modalConfig && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-12 z-50 px-4">
          <div className="bg-white rounded-lg w-full max-w-[440px] p-6 shadow-xl">
            <h3 className="text-[17px] font-medium text-[var(--navy)] m-0 mb-1">Horario y tolerancia</h3>
            <p className="text-[12.5px] text-[var(--gray-500)] mb-4">Se usa para marcar retardos. Aplica a los registros nuevos.</p>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={labelCls}>Hora de entrada</label><input type="time" value={cfgEdit.hora_entrada} onChange={(e) => setCfgEdit({ ...cfgEdit, hora_entrada: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Hora de salida</label><input type="time" value={cfgEdit.hora_salida} onChange={(e) => setCfgEdit({ ...cfgEdit, hora_salida: e.target.value })} className={inputCls} /></div>
              <div><label className={labelCls}>Tolerancia (min)</label><input type="number" min={0} max={240} value={cfgEdit.tolerancia_min} onChange={(e) => setCfgEdit({ ...cfgEdit, tolerancia_min: Number(e.target.value) })} className={inputCls} /></div>
              <div><label className={labelCls}>Espera entre escaneos (min)</label><input type="number" min={0} max={120} value={cfgEdit.minutos_entre_registros} onChange={(e) => setCfgEdit({ ...cfgEdit, minutos_entre_registros: Number(e.target.value) })} className={inputCls} /></div>
            </div>
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
