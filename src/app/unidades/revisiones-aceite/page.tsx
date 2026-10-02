"use client";
import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { exportarExcel } from "@/lib/exportExcel";
import { useSesion } from "@/lib/useSesion";

// Intervalo fijo entre cambios de aceite (km). Debe coincidir con el backend
// (src/app/api/unidades/aceite/route.ts) — se duplica a propósito, siguiendo la
// convención ya usada en el proyecto para constantes de validación.
const INTERVALO_KM_ACEITE = 18000;

type RegistroAceite = {
  eco: string;
  unidad: string;
  kmUltimoCambio: number | null;
  fechaUltimoCambio: string | null;
  kmProximoCambio: number | null;
  kmActual: number | null;
};

type Semaforo = "verde" | "amarillo" | "urgente";

function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

function escaparHtml(texto: string) {
  return texto.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function formatoFecha(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function formatoKm(km: number | null) {
  return km == null ? "—" : `${km.toLocaleString("es-MX")} km`;
}

// Progreso entre el último cambio y el próximo cambio. Si el KM actual excede el próximo
// cambio (unidad vencida) el progreso se muestra en 100% pero el semáforo sigue en "urgente".
function calcularProgreso(reg: RegistroAceite): { porcentaje: number; semaforo: Semaforo } | null {
  if (reg.kmUltimoCambio == null || reg.kmProximoCambio == null || reg.kmActual == null) return null;
  const rango = reg.kmProximoCambio - reg.kmUltimoCambio;
  if (rango <= 0) return null;
  const avance = reg.kmActual - reg.kmUltimoCambio;
  const porcentajeReal = (avance / rango) * 100;
  const porcentaje = Math.max(0, Math.min(100, porcentajeReal));
  let semaforo: Semaforo = "verde";
  if (porcentajeReal >= 85) semaforo = "urgente";
  else if (porcentajeReal >= 70) semaforo = "amarillo";
  return { porcentaje, semaforo };
}

const ESTILO_SEMAFORO: Record<Semaforo, { barra: string; chip: string; etiqueta: string }> = {
  verde: { barra: "bg-[var(--green)]", chip: "bg-[#dcf5e8] text-[#137a4a]", etiqueta: "Bien" },
  amarillo: { barra: "bg-[var(--amber)]", chip: "bg-[#fdf1d6] text-[#9a6a00]", etiqueta: "Próximo" },
  urgente: { barra: "bg-[var(--red)]", chip: "bg-[#fde4e0] text-[var(--red)]", etiqueta: "Urgente" },
};

// Genera el PDF de la tabla completa en una ventana nueva (mismo patrón que la impresión
// del checklist de revisión: HTML autocontenido + @media print + window.print()).
function descargarPdfAceite(registros: RegistroAceite[]) {
  const ventana = window.open("", "_blank", "width=1000,height=750");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const hoy = new Date().toLocaleDateString("es-MX", { year: "numeric", month: "2-digit", day: "2-digit" });

  const filasHtml = registros
    .map((reg) => {
      const progreso = calcularProgreso(reg);
      const chip = progreso
        ? `<span class="chip chip-${progreso.semaforo}">${ESTILO_SEMAFORO[progreso.semaforo].etiqueta} · ${Math.round(progreso.porcentaje)}%</span>`
        : `<span class="chip chip-vacio">Sin datos</span>`;
      return `<tr>
        <td>${escaparHtml(reg.eco)}</td>
        <td>${escaparHtml(reg.unidad || "—")}</td>
        <td>${formatoKm(reg.kmUltimoCambio)}</td>
        <td>${escaparHtml(formatoFecha(reg.fechaUltimoCambio))}</td>
        <td>${formatoKm(reg.kmProximoCambio)}</td>
        <td>${formatoKm(reg.kmActual)}</td>
        <td>${chip}</td>
      </tr>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Revisiones de Aceite</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #f4f5f8; color: #1c1c1c; }
  .hoja { max-width: 1000px; margin: 24px auto; background: #fff; padding: 28px 34px; }
  .cab { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e8ee; padding-bottom: 16px; gap: 12px; }
  .cab .marca { display: flex; align-items: center; gap: 10px; }
  .cab .marca img { width: 36px; height: 36px; object-fit: contain; }
  .cab .marca span { font-size: 16px; font-weight: bold; color: #16215c; text-transform: uppercase; letter-spacing: 0.03em; }
  .cab .fecha { color: #2f6fed; font-size: 12.5px; font-weight: 500; }
  h1.titulo { text-align: center; font-size: 16px; text-transform: uppercase; letter-spacing: 0.06em; color: #16215c; margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
  thead th { background: #16215c; color: #fff; text-align: left; padding: 7px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; }
  tbody td { padding: 6px 10px; border-bottom: 1px solid #e5e8ee; }
  tbody tr:nth-child(even) { background: #f4f5f8; }
  .chip { display: inline-block; border-radius: 6px; padding: 2px 8px; font-size: 10.5px; font-weight: bold; }
  .chip-verde { background: #dcf5e8; color: #137a4a; }
  .chip-amarillo { background: #fdf1d6; color: #9a6a00; }
  .chip-urgente { background: #fde4e0; color: #e2412c; }
  .chip-vacio { background: #f4f5f8; color: #9aa1b0; }
  .barra { text-align: center; padding: 18px 0 6px; }
  .barra button { padding: 10px 26px; font-size: 13px; font-weight: bold; background: #16215c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  @media print {
    body { background: #fff; }
    .hoja { margin: 0; max-width: none; padding: 0; }
    .barra { display: none; }
  }
</style>
</head>
<body>
<div class="hoja">
  <div class="cab">
    <div class="marca">
      <img src="/logo-icono.png" alt="Transportes Logisticar" />
      <span>Transportes Logisticar</span>
    </div>
    <p class="fecha">${escaparHtml(hoy)}</p>
  </div>
  <h1 class="titulo">Revisiones de Aceite por Unidad</h1>
  <table>
    <thead>
      <tr>
        <th>ECO</th>
        <th>Unidad</th>
        <th>KM Último Cambio</th>
        <th>Fecha Último Cambio</th>
        <th>KM Próximo Cambio</th>
        <th>KM Actual</th>
        <th>Progreso</th>
      </tr>
    </thead>
    <tbody>${filasHtml}</tbody>
  </table>
</div>
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });</script>
</body>
</html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

export default function RevisionesAceitePage() {
  const sesion = useSesion();
  const soloConsulta = sesion.rol === "supervisor_tms";

  const [registros, setRegistros] = useState<RegistroAceite[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Captura en memoria, sin guardar hasta presionar "Guardar información" (permite editar
  // varias unidades y enviarlas juntas, sin recargar la página en cada campo).
  const [ediciones, setEdiciones] = useState<Record<string, string>>({}); // `${eco}::${campo}` -> valor en captura

  const cargar = async () => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/unidades/aceite", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "No se pudo cargar la información.");
      setRegistros(data.registros || []);
    } catch (err) {
      setError(mensajeError(err, "No se pudo cargar la información."));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const totalPendientes = Object.keys(ediciones).length;

  // Guarda de golpe el KM Último Cambio de todas las unidades editadas. KM Actual no se
  // captura aquí: se recupera de la última revisión registrada en el módulo de Unidades.
  const guardarTodo = async () => {
    if (totalPendientes === 0 || guardando) return;

    const porEco = new Map<string, number>();
    for (const [clave, valorTexto] of Object.entries(ediciones) as [string, string][]) {
      const valor = valorTexto.trim();
      if (!valor) continue;
      const [eco] = clave.split("::");
      const numero = Number(valor);
      if (!Number.isInteger(numero) || numero <= 0) {
        setError(`El valor capturado para ${eco} debe ser un número entero positivo (no negativo, no cero).`);
        return;
      }
      porEco.set(eco, numero);
    }

    setGuardando(true);
    setError("");
    try {
      const resultados = await Promise.all(
        Array.from(porEco.entries()).map(async ([eco, kmUltimoCambio]) => {
          const res = await fetch("/api/unidades/aceite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eco, kmUltimoCambio }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data?.error ? `${eco}: ${data.error}` : `No se pudo guardar ${eco}.`);
          return eco;
        })
      );
      setEdiciones((prev) => {
        const copia = { ...prev };
        for (const eco of resultados) {
          delete copia[`${eco}::kmUltimoCambio`];
        }
        return copia;
      });
      await cargar();
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar la información."));
    } finally {
      setGuardando(false);
    }
  };

  const exportarExcelAceite = () => {
    const filas = registros.map((reg) => {
      const progreso = calcularProgreso(reg);
      return {
        ECO: reg.eco,
        Unidad: reg.unidad || "",
        "KM Último Cambio": reg.kmUltimoCambio ?? "",
        "Fecha Último Cambio": formatoFecha(reg.fechaUltimoCambio),
        "KM Próximo Cambio": reg.kmProximoCambio ?? "",
        "KM Actual": reg.kmActual ?? "",
        "Progreso (%)": progreso ? Math.round(progreso.porcentaje) : "",
        Estado: progreso ? ESTILO_SEMAFORO[progreso.semaforo].etiqueta : "Sin datos",
      };
    });
    exportarExcel(`revisiones-aceite-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ nombre: "Revisiones de Aceite", filas }]);
  };

  const totalUrgentes = useMemo(
    () => registros.filter((r) => calcularProgreso(r)?.semaforo === "urgente").length,
    [registros]
  );

  return (
    <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 py-4 md:py-6">
      <PageHeader
        titulo="Revisiones de Aceite"
        subtitulo="Control de cambios de aceite por unidad"
        backHref="/unidades"
        backLabel="Unidades"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] text-[var(--gray-400)]">
            {registros.length} unidad{registros.length === 1 ? "" : "es"}
            {totalUrgentes > 0 ? ` · ${totalUrgentes} urgente${totalUrgentes === 1 ? "" : "s"}` : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={exportarExcelAceite}
            className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[var(--gray-100)]"
          >
            Exportar Excel
          </button>
          <button
            type="button"
            onClick={() => descargarPdfAceite(registros)}
            className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-3.5 py-2.5 text-[12.5px] font-bold"
          >
            Exportar PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#fde4e0] text-[var(--red)] text-[12.5px] font-semibold rounded-lg px-4 py-2.5 mb-4">{error}</div>
      )}

      <div className="bg-white rounded-[18px] shadow-[0_1px_3px_rgba(22,33,92,0.06)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[var(--navy)] text-white text-[11.5px] font-bold uppercase tracking-wide">
                <th className="text-left px-4 py-3">ECO</th>
                <th className="text-left px-4 py-3">Unidad</th>
                <th className="text-left px-4 py-3">KM Último Cambio</th>
                <th className="text-left px-4 py-3">Fecha Último Cambio</th>
                <th className="text-left px-4 py-3">KM Próximo Cambio</th>
                <th className="text-left px-4 py-3">KM Actual</th>
                <th className="text-left px-4 py-3 min-w-[180px]">Progreso Actual</th>
              </tr>
            </thead>
            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan={7} className="text-center text-[var(--gray-400)] text-[12.5px] py-8">
                    Cargando unidades...
                  </td>
                </tr>
              ) : registros.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center text-[var(--gray-400)] text-[12.5px] py-8">
                    Aún no hay unidades registradas.
                  </td>
                </tr>
              ) : (
                registros.map((reg) => {
                  const progreso = calcularProgreso(reg);
                  const claveKmUltimo = `${reg.eco}::kmUltimoCambio`;
                  return (
                    <tr key={reg.eco} className="border-b border-[var(--gray-200)] last:border-b-0">
                      <td className="px-4 py-3 text-[12.5px] font-bold text-[var(--navy)] whitespace-nowrap">{reg.eco}</td>
                      <td className="px-4 py-3 text-[12.5px] whitespace-nowrap">{reg.unidad || "—"}</td>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          disabled={soloConsulta || guardando}
                          placeholder={reg.kmUltimoCambio != null ? String(reg.kmUltimoCambio) : "Capturar"}
                          value={ediciones[claveKmUltimo] ?? ""}
                          onChange={(e) => setEdiciones((prev) => ({ ...prev, [claveKmUltimo]: e.target.value }))}
                          className="w-[110px] border border-[var(--gray-200)] rounded-lg px-2.5 py-1.5 text-[12.5px] disabled:bg-[var(--gray-100)] disabled:cursor-not-allowed"
                        />
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--gray-400)] whitespace-nowrap">
                        {formatoFecha(reg.fechaUltimoCambio)}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--gray-400)] whitespace-nowrap">
                        {formatoKm(reg.kmProximoCambio)}
                      </td>
                      <td className="px-4 py-3 text-[12.5px] text-[var(--gray-400)] whitespace-nowrap" title="Se recupera de la última revisión registrada en Unidades">
                        {formatoKm(reg.kmActual)}
                      </td>
                      <td className="px-4 py-3 min-w-[180px]">
                        {progreso ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-[10px] bg-[var(--gray-100)] rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${ESTILO_SEMAFORO[progreso.semaforo].barra}`}
                                style={{ width: `${progreso.porcentaje}%` }}
                              />
                            </div>
                            <span className={`text-[10.5px] font-bold rounded-full px-2 py-0.5 whitespace-nowrap ${ESTILO_SEMAFORO[progreso.semaforo].chip}`}>
                              {Math.round(progreso.porcentaje)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11.5px] text-[var(--gray-400)]">Falta KM último cambio o kilometraje de Unidades</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!soloConsulta && (
        <div className="flex items-center justify-between gap-3 mt-4">
          <span className="text-[12.5px] text-[var(--gray-400)]">
            {totalPendientes > 0
              ? `${totalPendientes} cambio${totalPendientes === 1 ? "" : "s"} sin guardar`
              : "Sin cambios pendientes"}
          </span>
          <button
            type="button"
            onClick={guardarTodo}
            disabled={totalPendientes === 0 || guardando}
            className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {guardando ? "Guardando..." : "Guardar información"}
          </button>
        </div>
      )}
    </div>
  );
}