"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { exportarExcel } from "@/lib/exportExcel";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type RegistroUnidad = Record<string, string>;
type CambioAceite = {
  id: number;
  eco: string;
  unidad: string;
  fechaUltimoCambio: string;
  kmUltimoCambio: string;
  kmActual: string;
  servicioRealizado: boolean;
};

const KM_INTERVALO_CAMBIO = 18000;
const OPCIONES_INDICADOR_ACEITE = ["Urgente", "Se programa para la siguiente semana", "Servicio realizado"];
function etiquetaCorta(etiqueta: string) {
  return etiqueta === "Se programa para la siguiente semana" ? "Próximo" : etiqueta;
}

export default function CambiosAceitePage() {
  const [cambiosAceite, setCambiosAceite] = useState<CambioAceite[]>([]);
  const [cargandoAceite, setCargandoAceite] = useState(true);
  const [unidadesRegistradas, setUnidadesRegistradas] = useState<RegistroUnidad[]>([]);

  const cargarCambiosAceite = async () => {
    try {
      const res = await fetch("/api/cambios-aceite/list", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setCambiosAceite(data.registros || []);
    } catch {
      // se reintenta al volver a la pestaña
    } finally {
      setCargandoAceite(false);
    }
  };
  const cargarUnidades = async () => {
    try {
      const res = await fetch("/api/unidades/list", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setUnidadesRegistradas(data.registros || []);
    } catch {
      // se reintenta al volver a la pestaña
    }
  };

  useEffect(() => {
    cargarCambiosAceite();
    cargarUnidades();
  }, []);
  useRefrescarAlEnfocar(() => {
    cargarCambiosAceite();
    cargarUnidades();
  });

  const unidadInfo = (eco: string) => unidadesRegistradas.find((u) => u["ECO"] === eco);

  const agregarCambioAceite = async () => {
    try {
      const res = await fetch("/api/cambios-aceite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear el registro.");
      setCambiosAceite((prev) => [{ id: data.id, eco: "", unidad: "", fechaUltimoCambio: "", kmUltimoCambio: "", kmActual: "", servicioRealizado: false }, ...prev]);
    } catch (err: any) {
      alert(err.message || "No se pudo agregar el registro.");
    }
  };
  const actualizarAceiteLocal = (id: number, campo: keyof CambioAceite, valor: string) => {
    setCambiosAceite((prev) => prev.map((c) => (c.id === id ? { ...c, [campo]: valor } : c)));
  };
  const guardarAceiteCampo = (id: number, campo: string, valor: string) => {
    fetch("/api/cambios-aceite/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, [campo]: valor }) }).catch(() => cargarCambiosAceite());
  };
  const cambiarEcoAceite = (id: number, eco: string) => {
    const unidad = unidadInfo(eco)?.["Unidad"] || "";
    setCambiosAceite((prev) => prev.map((c) => (c.id === id ? { ...c, eco, unidad } : c)));
    fetch("/api/cambios-aceite/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, eco, unidad }) }).catch(() => cargarCambiosAceite());
  };
  const eliminarCambioAceite = async (id: number) => {
    if (!confirm("¿Eliminar este registro de cambio de aceite?")) return;
    setCambiosAceite((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch("/api/cambios-aceite/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarCambiosAceite();
    }
  };
  const calcularAceite = (c: CambioAceite) => {
    const kmUltimo = parseFloat(c.kmUltimoCambio);
    const kmActual = parseFloat(c.kmActual);
    const kmSiguiente = isNaN(kmUltimo) ? null : kmUltimo + KM_INTERVALO_CAMBIO;
    let porcentaje: number | null = null;
    if (!isNaN(kmUltimo) && !isNaN(kmActual)) {
      porcentaje = Math.max(0, ((kmActual - kmUltimo) * 100) / KM_INTERVALO_CAMBIO);
    }
    let etiqueta = "";
    if (c.servicioRealizado) etiqueta = "Servicio realizado";
    else if (porcentaje !== null) {
      if (porcentaje > 85) etiqueta = "Urgente";
      else if (porcentaje >= 70) etiqueta = "Se programa para la siguiente semana";
    }
    return { kmSiguiente, porcentaje, etiqueta };
  };

  // Marcar/desmarcar "Servicio realizado": al marcar, KM actual pasa a ser el nuevo KM ultimo cambio
  // y la fecha de hoy pasa a Fecha de ultimo cambio; KM actual queda libre para el siguiente ciclo.
  const toggleServicioRealizado = async (c: CambioAceite) => {
    const marcando = !c.servicioRealizado;
    if (marcando) {
      const clave = prompt("Ingresa la contraseña para marcar el servicio como realizado:");
      if (clave === null) return;
      if (clave !== "4321") {
        alert("Contraseña incorrecta.");
        return;
      }
      const hoy = new Date().toISOString().slice(0, 10);
      const nuevoKmUltimo = c.kmActual || c.kmUltimoCambio;
      setCambiosAceite((prev) => prev.map((x) => (x.id === c.id ? { ...x, servicioRealizado: true, kmUltimoCambio: nuevoKmUltimo, fechaUltimoCambio: hoy, kmActual: "" } : x)));
      try {
        await fetch("/api/cambios-aceite/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: c.id, servicioRealizado: true, kmUltimoCambio: nuevoKmUltimo, fechaUltimoCambio: hoy, kmActual: "" }),
        });
      } catch {
        await cargarCambiosAceite();
      }
    } else {
      setCambiosAceite((prev) => prev.map((x) => (x.id === c.id ? { ...x, servicioRealizado: false } : x)));
      try {
        await fetch("/api/cambios-aceite/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, servicioRealizado: false }) });
      } catch {
        await cargarCambiosAceite();
      }
    }
  };
  const quitarSeleccionAceite = async () => {
    const marcados = cambiosAceite.filter((c) => c.servicioRealizado);
    if (marcados.length === 0) return;
    setCambiosAceite((prev) => prev.map((c) => (c.servicioRealizado ? { ...c, servicioRealizado: false } : c)));
    try {
      await Promise.all(marcados.map((c) => fetch("/api/cambios-aceite/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id, servicioRealizado: false }) })));
    } catch {
      await cargarCambiosAceite();
    }
  };

  const [filasDesbloqueadasAceite, setFilasDesbloqueadasAceite] = useState<Set<number>>(new Set());
  const toggleBloqueoAceite = (id: number) => {
    setFilasDesbloqueadasAceite((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  const [filtrosIndicadorAceite, setFiltrosIndicadorAceite] = useState<Set<string>>(new Set());
  const toggleFiltroIndicadorAceite = (valor: string) => {
    setFiltrosIndicadorAceite((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(valor)) nuevo.delete(valor);
      else nuevo.add(valor);
      return nuevo;
    });
  };
  const cambiosAceiteFiltrados = useMemo(() => {
    if (filtrosIndicadorAceite.size === 0) return cambiosAceite;
    return cambiosAceite.filter((c) => filtrosIndicadorAceite.has(calcularAceite(c).etiqueta));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cambiosAceite, filtrosIndicadorAceite]);

  const exportarCambiosAceite = () => {
    exportarExcel(`Cambios_de_aceite_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Cambios de aceite",
        filas: cambiosAceite.map((c) => {
          const { kmSiguiente, porcentaje, etiqueta } = calcularAceite(c);
          return {
            ECO: c.eco,
            Unidad: c.unidad,
            "Fecha último cambio": c.fechaUltimoCambio,
            "KM último cambio": c.kmUltimoCambio,
            "KM actual": c.kmActual,
            "KM próximo": kmSiguiente ?? "",
            "%": porcentaje === null ? "" : porcentaje.toFixed(1),
            Indicador: etiquetaCorta(etiqueta),
            Realizado: c.servicioRealizado ? "Sí" : "No",
          };
        }),
      },
    ]);
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Cambios de aceite"
          subtitulo="Da seguimiento a los cambios de aceite por unidad y su próximo vencimiento."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M12 2l7 12a7 7 0 11-14 0l7-12z" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" onClick={agregarCambioAceite} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                + Agregar
              </button>
              <button type="button" onClick={quitarSeleccionAceite} className="flex items-center gap-1.5 bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                Quitar selección
              </button>
            </div>
            {!cargandoAceite && cambiosAceite.length > 0 && (
              <button type="button" onClick={exportarCambiosAceite} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Exportar Excel
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-[10.5px] font-bold text-[var(--gray-400)] uppercase">Filtrar por indicador:</span>
            {OPCIONES_INDICADOR_ACEITE.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => toggleFiltroIndicadorAceite(op)}
                className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${filtrosIndicadorAceite.has(op) ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
              >
                {etiquetaCorta(op)}
              </button>
            ))}
            {filtrosIndicadorAceite.size > 0 && (
              <button type="button" onClick={() => setFiltrosIndicadorAceite(new Set())} className="text-[11px] text-[var(--red)] font-semibold px-1.5">
                Limpiar
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="border-collapse min-w-max w-full">
              <thead>
                <tr>
                  {["", "ECO. Unidad", "Unidad", "Fecha último cambio", "KM último cambio", "KM próximo cambio", "KM actual", "% recorrido", "Indicador", "Realizado", "Acciones"].map((c, i) => (
                    <th key={i} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cambiosAceiteFiltrados.map((c) => {
                  const { kmSiguiente, porcentaje, etiqueta } = calcularAceite(c);
                  const urgente = !c.servicioRealizado && porcentaje !== null && porcentaje > 85;
                  const colorBarra = porcentaje === null ? "#9aa1b0" : porcentaje > 85 ? "var(--red)" : porcentaje >= 70 ? "var(--amber)" : "var(--green)";
                  const desbloqueado = filasDesbloqueadasAceite.has(c.id);
                  const estiloFila = c.servicioRealizado ? { backgroundColor: "rgba(33,168,102,0.12)" } : urgente ? { backgroundColor: "rgba(226,65,44,0.12)" } : undefined;
                  return (
                    <tr key={c.id} className="border-b border-[var(--gray-200)]" style={estiloFila}>
                      <td className="px-2 py-2 whitespace-nowrap">
                        <span onClick={() => toggleBloqueoAceite(c.id)} className="cursor-pointer text-[var(--gray-400)]" title={desbloqueado ? "Bloquear edición" : "Desbloquear edición"}>
                          {desbloqueado ? (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 019.9-1" /></svg>
                          ) : (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                          )}
                        </span>
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <select disabled={!desbloqueado} value={c.eco} onChange={(e) => cambiarEcoAceite(c.id, e.target.value)} className="border border-[var(--gray-200)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)] rounded px-1.5 py-1 text-[12px] w-[100px]">
                          <option value=""></option>
                          {unidadesRegistradas.map((u) => (
                            <option key={u["ECO"]} value={u["ECO"]}>
                              {u["ECO"]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{c.unidad || "—"}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          disabled={!desbloqueado}
                          value={c.fechaUltimoCambio}
                          onChange={(e) => actualizarAceiteLocal(c.id, "fechaUltimoCambio", e.target.value)}
                          onBlur={(e) => guardarAceiteCampo(c.id, "fechaUltimoCambio", e.target.value)}
                          className="border border-[var(--gray-200)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)] rounded px-1.5 py-1 text-[12px]"
                        />
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          disabled={!desbloqueado}
                          value={c.kmUltimoCambio}
                          onChange={(e) => actualizarAceiteLocal(c.id, "kmUltimoCambio", e.target.value)}
                          onBlur={(e) => guardarAceiteCampo(c.id, "kmUltimoCambio", e.target.value)}
                          placeholder="0"
                          className="border border-[var(--gray-200)] disabled:bg-[var(--gray-100)] disabled:text-[var(--gray-400)] rounded px-1.5 py-1 text-[12px] w-[85px]"
                        />
                      </td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{kmSiguiente !== null ? kmSiguiente.toLocaleString("es-MX") : "—"}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <input
                          type="number"
                          value={c.kmActual}
                          onChange={(e) => actualizarAceiteLocal(c.id, "kmActual", e.target.value)}
                          onBlur={(e) => guardarAceiteCampo(c.id, "kmActual", e.target.value)}
                          placeholder="0"
                          className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-[85px]"
                        />
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        {porcentaje === null ? (
                          "—"
                        ) : (
                          <div className="flex items-center gap-2 w-[140px]">
                            <div className="flex-1 h-2.5 rounded-full bg-[var(--gray-200)] overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.min(100, porcentaje)}%`, backgroundColor: colorBarra }} />
                            </div>
                            <span className="text-[11px] font-semibold text-[var(--navy)] whitespace-nowrap">{porcentaje.toFixed(1)}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        {etiqueta && (
                          <span className={`text-[9.5px] font-bold uppercase px-2 py-1 rounded-full ${c.servicioRealizado ? "bg-[var(--green)] text-white" : urgente ? "bg-[var(--red)] text-white" : "bg-[var(--amber)] text-[#52350a]"}`}>
                            {etiquetaCorta(etiqueta)}
                          </span>
                        )}
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap text-center">
                        <input type="checkbox" checked={c.servicioRealizado} onChange={() => toggleServicioRealizado(c)} className="w-4 h-4 accent-[var(--green)] cursor-pointer" title="Marcar servicio realizado" />
                      </td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span onClick={() => eliminarCambioAceite(c.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar registro">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!cargandoAceite && cambiosAceiteFiltrados.length === 0 && (
              <div className="text-center text-[var(--gray-400)] text-[13px] py-8">
                {cambiosAceite.length === 0 ? <>Sin registros. Usa &quot;+ Agregar&quot; para crear el primero.</> : "Ningún registro coincide con el filtro."}
              </div>
            )}
          </div>
        </div>

        <PageFooter />
      </div>
    </div>
  );
}
