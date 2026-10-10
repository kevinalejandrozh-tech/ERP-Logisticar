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
  entrada_ts: string | null;
  salida_ts: string | null;
};
type Dia = { registro: Registro | null; checadas: number };
type Fila = { id: number; nombre: string; puesto: string | null; employee_no: string; horario: string; dias: Record<string, Dia> };
type Respuesta = { desde: string; hasta: string; hoy: string; personal: Fila[] };

const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const etiqueta = (iso: string) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`;
const inputCls = "border border-[var(--gray-300)] rounded-md px-3 py-2 text-[13.5px] bg-white";
const ESTILO_SIN = { fondo: "#fdecea", texto: "#b42318", borde: "#f5c2bc" };
const ESTILO_TURNO = { fondo: "#e6f6ee", texto: "#0f7a4a", borde: "#b6e3cb" };

function celda(d: Dia, fecha: string, hoy: string) {
  const r = d.registro;
  if (!r) {
    if (d.checadas) return { texto: "Checada", sub: `${d.checadas} checada(s)`, estilo: ESTILO_TURNO };
    if (fecha > hoy) return null;
    return { texto: "Sin checada", sub: "", estilo: ESTILO_SIN };
  }
  if (r.tipo !== "Asistencia") {
    const c = claveVisual(r) as ClaveEstilo;
    return { texto: c, sub: d.checadas ? `${d.checadas} checada(s)` : "", estilo: ESTILO_TIPO[c] };
  }
  const c = claveVisual(r) as ClaveEstilo;
  const horario = `${r.hora_entrada || "—"} – ${r.hora_salida || (fecha === hoy ? "en turno" : "sin salida")}`;
  const etiquetaEstado = !r.hora_salida && fecha !== hoy ? "Sin salida" : c === "Asistencia" ? "" : c;
  return { texto: horario, sub: etiquetaEstado, estilo: !r.hora_salida && fecha === hoy && !r.retardo ? ESTILO_TURNO : ESTILO_TIPO[c] };
}

export default function AsistenciaSemana() {
  const [fecha, setFecha] = useState("");
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");

  const cargar = useCallback(async (f: string) => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch(`/api/asistencia/reloj/semana${f ? `?fecha=${f}` : ""}`, { cache: "no-store" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo cargar.");
      setDatos(d as Respuesta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar(fecha);
  }, [fecha, cargar]);

  const dias = useMemo(() => (datos ? Array.from({ length: 7 }, (_, i) => sumarDiasIso(datos.desde, i)) : []), [datos]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (datos?.personal || [])
      .filter((p) => !q || p.nombre.toLowerCase().includes(q) || p.employee_no === q)
      .map((p) => {
        let horas = 0;
        let asistencias = 0;
        let retardos = 0;
        let faltas = 0;
        for (const d of dias) {
          const r = p.dias[d]?.registro;
          if (r?.tipo === "Asistencia") {
            asistencias++;
            if (r.retardo) retardos++;
            horas += horasTrabajadas(r.entrada_ts, r.salida_ts);
          } else if (r?.tipo === "Falta" || (!r && !p.dias[d]?.checadas && datos && d < datos.hoy)) faltas++;
        }
        return { ...p, horas: Math.round(horas * 100) / 100, asistencias, retardos, faltas };
      });
  }, [datos, dias, busqueda]);

  return (
    <div>
      <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4 p-3 flex flex-wrap items-center gap-2.5">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Semana anterior" className="btn btn-secundario px-2.5 py-1.5" onClick={() => datos && setFecha(sumarDiasIso(datos.desde, -7))}>‹</button>
          <button type="button" className="btn btn-secundario py-1.5" onClick={() => datos && setFecha(datos.hoy)}>Esta semana</button>
          <button type="button" aria-label="Semana siguiente" className="btn btn-secundario px-2.5 py-1.5" onClick={() => datos && setFecha(sumarDiasIso(datos.desde, 7))}>›</button>
        </div>
        <input type="date" value={fecha || datos?.desde || ""} onChange={(e) => e.target.value && setFecha(e.target.value)} className={inputCls} title="Elige cualquier día de la semana" />
        {datos && (
          <span className="text-[13.5px] font-medium text-[var(--navy)]">
            Lunes {etiqueta(datos.desde)} – Domingo {etiqueta(datos.hasta)} {datos.hasta.slice(0, 4)}
          </span>
        )}
        <input type="search" placeholder="Buscar por nombre o número" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${inputCls} ml-auto w-full max-w-[280px]`} />
      </div>

      {error && <p className="mb-3 text-[13px] text-[var(--red)]">{error}</p>}

      <div className="bg-white border border-[var(--gray-200)] rounded-lg mb-4">
        {cargando && !datos ? (
          <p className="p-6 text-[13px] text-[var(--gray-500)]">Cargando…</p>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-260px)] min-h-[300px]">
            <table className="text-[12.5px] border-separate border-spacing-0 min-w-[1180px] w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-30 bg-white text-left px-4 py-2.5 text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide border-b border-r border-[var(--gray-200)] min-w-[230px]">Nombre</th>
                  {dias.map((d, i) => (
                    <th key={d} className={`sticky top-0 z-20 px-2 py-2.5 text-center font-medium border-b border-[var(--gray-200)] min-w-[118px] ${d === datos?.hoy ? "bg-[#f2f6ff] text-[var(--blue)]" : "bg-white text-[var(--navy)]"}`}>
                      <span className="block text-[11.5px] uppercase tracking-wide">{DIAS_CORTOS[i]}</span>
                      <span className="block text-[12px] font-normal">{etiqueta(d)}</span>
                    </th>
                  ))}
                  <th className="sticky top-0 z-20 bg-white px-3 py-2.5 text-center text-[11.5px] font-medium text-[var(--gray-500)] uppercase tracking-wide border-b border-l border-[var(--gray-200)] min-w-[150px]">Resumen</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((p) => (
                  <tr key={p.id} className="group">
                    <td className="sticky left-0 z-10 bg-white group-hover:bg-[var(--gray-50)] px-4 py-2 border-b border-r border-[var(--gray-200)] align-top">
                      <Link href={`/personas/expedientes/detalle?id=${p.id}`} className="font-medium text-[var(--navy)] hover:underline">{p.nombre}</Link>
                      <p className="m-0 text-[11px] text-[var(--gray-500)]">No. {p.employee_no} · {p.horario}</p>
                    </td>
                    {dias.map((d) => {
                      const c = datos ? celda(p.dias[d] || { registro: null, checadas: 0 }, d, datos.hoy) : null;
                      return (
                        <td key={d} className={`px-1.5 py-1.5 border-b border-[var(--gray-200)] align-top ${d === datos?.hoy ? "bg-[#f7f9ff]" : "bg-white group-hover:bg-[var(--gray-50)]"}`}>
                          {c && (
                            <div className="rounded-md border px-1.5 py-1 text-center leading-tight" style={{ background: c.estilo.fondo, color: c.estilo.texto, borderColor: c.estilo.borde }}>
                              <span className="block font-medium whitespace-nowrap">{c.texto}</span>
                              {c.sub && <span className="block text-[10.5px] opacity-80 whitespace-nowrap">{c.sub}</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 border-b border-l border-[var(--gray-200)] align-top bg-white group-hover:bg-[var(--gray-50)] text-[12px] whitespace-nowrap">
                      <span className="block font-medium text-[var(--navy)]">{p.asistencias} día(s) · {p.horas} h</span>
                      <span className="block text-[11px] text-[var(--gray-500)]">
                        {p.retardos ? <span className="text-[#8a5a00]">{p.retardos} retardo(s)</span> : "Sin retardos"}
                        {p.faltas ? <span className="text-[#b42318]"> · {p.faltas} sin checada</span> : ""}
                      </span>
                    </td>
                  </tr>
                ))}
                {!filas.length && (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-[var(--gray-500)]">Sin resultados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="mb-8 text-[12px] text-[var(--gray-500)]">Cada día muestra entrada – salida tomadas del reloj (o el tipo capturado: vacaciones, viaje, permiso, falta). Las horas suman solo días con entrada y salida.</p>
    </div>
  );
}
