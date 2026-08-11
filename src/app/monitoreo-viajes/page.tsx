"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";
import { UNIDADES } from "@/lib/unidadesData";
import { construirGrupos, CAMPOS_TABLA_PRINCIPAL } from "@/lib/monitoreoData";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
type Viaje = { id: number } & Record<string, string>;

function mostrarFechaHora(v?: string) {
  if (!v) return "—";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  return d.toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatearDuracion(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const dias = Math.floor(totalMin / 1440);
  const horas = Math.floor((totalMin % 1440) / 60);
  const min = totalMin % 60;
  const partes: string[] = [];
  if (dias > 0) partes.push(`${dias}d`);
  if (dias > 0 || horas > 0) partes.push(`${horas}h`);
  partes.push(`${min}m`);
  return partes.join(" ");
}

function calcularIndicador(real?: string, planeado?: string): { texto: string; clase: string } {
  if (!real || !planeado) return { texto: "—", clase: "bg-[var(--gray-100)] text-[var(--gray-400)]" };
  const dReal = new Date(real).getTime();
  const dPlan = new Date(planeado).getTime();
  if (isNaN(dReal) || isNaN(dPlan)) return { texto: "—", clase: "bg-[var(--gray-100)] text-[var(--gray-400)]" };
  if (dReal <= dPlan) return { texto: "ON TIME", clase: "bg-[var(--green)] text-white" };
  return { texto: `TARDE ${formatearDuracion(dReal - dPlan)}`, clase: "bg-[var(--red)] text-white" };
}

function calcularTiempoRuta(inicio?: string, fin?: string): string {
  if (!inicio || !fin) return "—";
  const dI = new Date(inicio).getTime();
  const dF = new Date(fin).getTime();
  if (isNaN(dI) || isNaN(dF) || dF < dI) return "—";
  return formatearDuracion(dF - dI);
}

export default function MonitoreoViajesPage() {
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [operadores, setOperadores] = useState<string[]>([]);
  const ecosUnidad = useMemo(() => UNIDADES.map((u) => u.eco), []);
  const grupos = useMemo(() => construirGrupos(operadores, ecosUnidad), [operadores, ecosUnidad]);

  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const res = await fetch("/api/viajes/list", { cache: "no-store" });
      const data = await res.json();
      setViajes(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    } finally {
      setCargando(false);
    }
  };
  const cargarOperadores = async () => {
    try {
      const res = await fetch("/api/operadores/list", { cache: "no-store" });
      const data = await res.json();
      setOperadores((data.registros || []).map((o: { nombre: string }) => o.nombre));
    } catch {
      // el campo sigue funcionando con lista vacia
    }
  };

  useEffect(() => {
    cargar();
    cargarOperadores();
    const id = setInterval(cargar, 20000);
    return () => clearInterval(id);
  }, []);

  const campo = (v: Record<string, string>, key: string) => (c: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setValores((prev) => ({ ...prev, [key]: c.target.value }));

  const abrirNuevo = () => {
    setEditandoId(null);
    setValores({});
    setFormAbierto(true);
  };
  const abrirEditar = (v: Viaje) => {
    setEditandoId(v.id);
    const { id, ...resto } = v;
    setValores(resto as Record<string, string>);
    setFormAbierto(true);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      if (editandoId !== null) {
        const res = await fetch("/api/viajes/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editandoId, campos: valores }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al guardar.");
      } else {
        const res = await fetch("/api/viajes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(valores),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al guardar.");
      }
      setFormAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al guardar el viaje.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarViaje = async (id: number) => {
    if (!confirm("¿Eliminar este viaje? Esta acción no se puede deshacer.")) return;
    setViajes((prev) => prev.filter((v) => v.id !== id));
    try {
      await fetch("/api/viajes/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargar();
    }
  };

  const actualizarCampoRapido = async (id: number, key: string, valor: string) => {
    setViajes((prev) => prev.map((v) => (v.id === id ? { ...v, [key]: valor } : v)));
    try {
      await fetch("/api/viajes/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, campos: { [key]: valor } }),
      });
    } catch {
      await cargar();
    }
  };

  const exportar = () => {
    exportarExcel(`Viajes_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Viajes",
        filas: viajes.map((v) => {
          const fila: Record<string, string> = { ID: String(v.id) };
          grupos.forEach((g) => g.campos.forEach((c) => (fila[c.label] = v[c.key] || "")));
          return fila;
        }),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Monitoreo de viajes y rutas"
          subtitulo="Consulta el monitoreo en tiempo real de viajes y rutas."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-6">
          <button type="button" onClick={abrirNuevo} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Nuevo viaje
          </button>
        </div>

        {/* Resumen con indicadores */}
        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-5">
          <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0 mb-4">Resumen de monitoreo</h3>
          <div className="overflow-x-auto">
            <table className="border-collapse min-w-max w-full">
              <thead>
                <tr>
                  {["Operador", "ECO. Unidad", "Estado/Destino", "Carga planeada c/cliente", "Cita carga patio", "Tiros", "Arribo a patio", "Arribo almacén carga", "Inicio de ruta", "Indicador asistencia", "Indicador carga c/cliente", "Termino de servicio", "Tiempo en ruta", "Detalles"].map((c) => (
                    <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viajes.map((v) => {
                  const indAsistencia = calcularIndicador(v.horaArriboPatio, v.citaCargaPatio);
                  const indCarga = calcularIndicador(v.arriboAlmacenCarga, v.cargaPlaneadaCliente);
                  const tiempoRuta = calcularTiempoRuta(v.inicioRuta, v.terminoServicio);
                  return (
                    <tr key={v.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.operador || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.ecoUnidad || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.estadoDestino || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{mostrarFechaHora(v.cargaPlaneadaCliente)}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{mostrarFechaHora(v.citaCargaPatio)}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{v.tiros || "—"}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{mostrarFechaHora(v.horaArriboPatio)}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{mostrarFechaHora(v.arriboAlmacenCarga)}</td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{mostrarFechaHora(v.inicioRuta)}</td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className={`text-[9.5px] font-bold uppercase px-2 py-1 rounded-full ${indAsistencia.clase}`}>{indAsistencia.texto}</span>
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <span className={`text-[9.5px] font-bold uppercase px-2 py-1 rounded-full ${indCarga.clase}`}>{indCarga.texto}</span>
                      </td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <input
                          type="datetime-local"
                          value={v.terminoServicio || ""}
                          onChange={(e) => actualizarCampoRapido(v.id, "terminoServicio", e.target.value)}
                          className="border border-[var(--gray-200)] rounded-md px-1.5 py-1 text-[11px]"
                        />
                      </td>
                      <td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{tiempoRuta}</td>
                      <td className="px-2.5 py-2.5 whitespace-nowrap">
                        <Link href={`/monitoreo-viajes/detalle?id=${v.id}`} className="inline-flex items-center gap-1 text-[11.5px] text-[var(--blue)] font-semibold no-underline" title="Detalles de viaje">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                          Detalles
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!cargando && viajes.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin viajes registrados.</div>}
          </div>
        </div>

        {/* Tabla completa de viajes */}
        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Viajes registrados</h3>
            {!cargando && viajes.length > 0 && (
              <button type="button" onClick={exportar} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Exportar Excel
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse min-w-max w-full">
              <thead>
                <tr>
                  {CAMPOS_TABLA_PRINCIPAL.map((c) => (
                    <th key={c.key} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  <th className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {viajes.map((v) => (
                  <tr key={v.id} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
                    {CAMPOS_TABLA_PRINCIPAL.map((c) => (
                      <td key={c.key} onClick={() => abrirEditar(v)} className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap cursor-pointer">
                        {c.key.toLowerCase().includes("cita") || c.key.toLowerCase().includes("carga") || c.key.toLowerCase().includes("arribo") || c.key.toLowerCase().includes("termino")
                          ? mostrarFechaHora(v[c.key])
                          : v[c.key] || "—"}
                      </td>
                    ))}
                    <td className="px-2.5 py-2.5 whitespace-nowrap">
                      <span onClick={() => eliminarViaje(v.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar viaje">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!cargando && viajes.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin viajes registrados. Usa &quot;Nuevo viaje&quot; para crear el primero.</div>}
          </div>
        </div>

        <PageFooter />
      </div>

      {formAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[900px] max-w-[96%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[88vh] overflow-y-auto">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-5">{editandoId !== null ? "Editar viaje" : "Nuevo viaje"}</h3>

            {grupos.map((g) => (
              <div key={g.titulo} className="mb-5">
                <h4 className="text-[12px] font-bold text-[var(--blue)] uppercase tracking-wide mb-2.5">{g.titulo}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
                  {g.campos.map((c) => (
                    <div key={c.key}>
                      <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">{c.label}</label>
                      {c.tipo === "datetime" && (
                        <input type="datetime-local" value={valores[c.key] || ""} onChange={campo(valores, c.key)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
                      )}
                      {c.tipo === "text" && (
                        <input value={valores[c.key] || ""} onChange={campo(valores, c.key)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
                      )}
                      {c.tipo === "number" && (
                        <input type="number" value={valores[c.key] || ""} onChange={campo(valores, c.key)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
                      )}
                      {c.tipo === "select" && (
                        <select value={valores[c.key] || ""} onChange={campo(valores, c.key)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]">
                          <option value="">Selecciona...</option>
                          {c.opciones?.map((op) => (
                            <option key={op} value={op}>
                              {op}
                            </option>
                          ))}
                        </select>
                      )}
                      {c.tipo === "datalist" && (
                        <>
                          <datalist id={`dl-${c.key}`}>
                            {c.opciones?.map((op) => (
                              <option key={op} value={op} />
                            ))}
                          </datalist>
                          <input value={valores[c.key] || ""} onChange={campo(valores, c.key)} list={`dl-${c.key}`} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="flex gap-2.5 justify-end mt-2">
              <button type="button" onClick={() => setFormAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
