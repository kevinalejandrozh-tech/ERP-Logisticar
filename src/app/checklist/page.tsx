"use client";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import PuntoChecklist from "@/components/PuntoChecklist";
import PuntoChecklistCompacto from "@/components/PuntoChecklistCompacto";
import BarraNivel from "@/components/BarraNivel";
import FotoCardGrande from "@/components/FotoCardGrande";
import MultiFotoUploader from "@/components/MultiFotoUploader";
import {
  SECCIONES,
  TOTAL_PUNTOS,
  NIVELES_LABELS,
  NIVEL_OPCIONES,
  OPCIONES_CABINA,
  SwitchState,
} from "@/lib/checklistData";
import { UNIDADES } from "@/lib/unidadesData";

type PuntoState = { valor: SwitchState; comentarioActivo: boolean; comentario: string };
type DetalleNoOk = { seccion: string; punto: string; comentario: string };
type FilaReporte = {
  eco: string;
  descripcion: string;
  placas: string;
  estado: "ok" | "con_detalles" | "sin_registro";
  fechaHora: string | null;
  detalles: DetalleNoOk[];
};

function calcularEstadoUnidad(checklistGuardado: Record<string, any> | null | undefined): { estado: "ok" | "con_detalles" | "sin_registro"; detalles: DetalleNoOk[] } {
  if (!checklistGuardado) return { estado: "sin_registro", detalles: [] };
  const detalles: DetalleNoOk[] = [];
  SECCIONES.forEach((sec) => {
    sec.puntos.forEach((p) => {
      const key = `${sec.key}__${p}`;
      const v = checklistGuardado[key];
      if (v?.valor === "no") {
        detalles.push({ seccion: sec.titulo, punto: p, comentario: v.comentario || "" });
      }
    });
  });
  return { estado: detalles.length > 0 ? "con_detalles" : "ok", detalles };
}

const FOTOS_LABELS = ["Vista Frontal", "Vista lateral izquierda", "Vista trasera", "Vista lateral derecha"];
const FOTOS_INTERIOR_LABELS = ["Vista interior cabina", "Vista interior de caja"];

type Paso = "unidad" | "evidencia" | "niveles" | "inspeccion" | "adicionales" | "documentacion" | "resumen";
const ORDEN_PASOS: Paso[] = ["unidad", "evidencia", "niveles", "inspeccion", "adicionales", "documentacion", "resumen"];
const TITULOS_PASO: Record<Paso, string> = {
  unidad: "Unidad",
  evidencia: "Evidencia fotográfica",
  niveles: "Revisión de niveles",
  inspeccion: "Inspección completa",
  adicionales: "Adicionales de la unidad",
  documentacion: "Documentación",
  resumen: "Vista previa",
};

function escaparHtml(t: string) {
  return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function ChecklistPage() {
  const [ecoUnidad, setEcoUnidad] = useState(UNIDADES[0]?.eco || "");
  const [kmActual, setKmActual] = useState("");
  const [errorPaso, setErrorPaso] = useState("");
  const [modoSoloLectura, setModoSoloLectura] = useState(false);
  const [registroVista, setRegistroVista] = useState<{ folio: string; descripcion_unidad: string | null; placas: string | null; fecha_hora: string } | null>(null);
  const [cargandoVista, setCargandoVista] = useState(false);
  const [reporteAbierto, setReporteAbierto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);
  const [cargandoReporte, setCargandoReporte] = useState(false);
  const [filasReporte, setFilasReporte] = useState<FilaReporte[]>([]);
  const [filtroReporte, setFiltroReporte] = useState<"todas" | "ok" | "con_detalles">("todas");
  const [paso, setPaso] = useState<Paso>("unidad");
  const [folioGuardado, setFolioGuardado] = useState<string | null>(null);

  const abrirReporte = async () => {
    setReporteAbierto(true);
    setCargandoReporte(true);
    try {
      const res = await fetch("/api/checklist/reporte-estado", { cache: "no-store" });
      const data = await res.json();
      const porEco: Record<string, any> = {};
      (data.registros || []).forEach((r: any) => {
        porEco[r.eco_unidad] = r;
      });
      const filas: FilaReporte[] = UNIDADES.map((u) => {
        const r = porEco[u.eco];
        const { estado, detalles } = calcularEstadoUnidad(r?.checklist);
        return { eco: u.eco, descripcion: r?.descripcion_unidad || u.descripcion || "", placas: r?.placas || u.placa || "", estado, fechaHora: r?.fecha_hora || null, detalles };
      });
      setFilasReporte(filas);
    } catch {
      setFilasReporte([]);
    } finally {
      setCargandoReporte(false);
    }
  };

  const unidadSeleccionada = useMemo(() => UNIDADES.find((u) => u.eco === ecoUnidad), [ecoUnidad]);
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [fotosLibres, setFotosLibres] = useState<string[]>([]);
  const [detallesEncontrados, setDetallesEncontrados] = useState(false);
  const [niveles, setNiveles] = useState<Record<string, number>>({});
  const [nivelesLitros, setNivelesLitros] = useState<Record<string, string>>({});
  const [nivelesObs, setNivelesObs] = useState<Record<string, string>>({});
    const [checklist, setChecklist] = useState<Record<string, PuntoState>>({});
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  const setPunto = (key: string, valor: SwitchState, autoAbrirComentarioSiNo?: boolean) =>
    setChecklist((prev) => ({
      ...prev,
      [key]: {
        valor,
        comentarioActivo: autoAbrirComentarioSiNo ? valor === "no" : prev[key]?.comentarioActivo ?? false,
        comentario: prev[key]?.comentario ?? "",
      },
    }));
  const toggleComentario = (key: string) =>
    setChecklist((prev) => ({ ...prev, [key]: { valor: prev[key]?.valor ?? null, comentarioActivo: !(prev[key]?.comentarioActivo ?? false), comentario: prev[key]?.comentario ?? "" } }));
  const setComentario = (key: string, comentario: string) =>
    setChecklist((prev) => ({ ...prev, [key]: { valor: prev[key]?.valor ?? null, comentarioActivo: prev[key]?.comentarioActivo ?? false, comentario } }));

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    if (!id) {
      const eco = params.get("eco");
      if (eco && UNIDADES.some((u) => u.eco === eco)) setEcoUnidad(eco);
      return;
    }
    setCargandoVista(true);
    fetch(`/api/checklist/get?id=${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (!data.ok) {
          setMensaje({ tipo: "error", texto: data.error || "No se encontró el registro." });
          return;
        }
        const r = data.registro;
        setModoSoloLectura(true);
        setRegistroVista({ folio: r.folio, descripcion_unidad: r.descripcion_unidad, placas: r.placas, fecha_hora: r.fecha_hora });
        setEcoUnidad(r.eco_unidad || "");
        setKmActual(r.kilometraje_actual != null ? String(r.kilometraje_actual) : "");
        setFotos(r.fotos_evidencia || {});
        setFotosLibres(r.fotos_libres || []);
        setDetallesEncontrados((r.fotos_libres || []).length > 0);
        const nivelesGuardados = r.niveles || {};
        const nivelesNum: Record<string, number> = {};
        const nivelesLit: Record<string, string> = {};
        const nivelesObsMap: Record<string, string> = {};
        Object.entries(nivelesGuardados).forEach(([key, v]: [string, any]) => {
          const idx = NIVEL_OPCIONES.indexOf(v?.nivel || "");
          nivelesNum[key] = idx >= 0 ? idx + 1 : 0;
          nivelesLit[key] = v?.litros || "";
          nivelesObsMap[key] = v?.observaciones || "";
        });
        setNiveles(nivelesNum);
        setNivelesLitros(nivelesLit);
        setNivelesObs(nivelesObsMap);
        setChecklist(r.checklist || {});
        setPaso("resumen");
      })
      .catch(() => setMensaje({ tipo: "error", texto: "No se pudo cargar el registro." }))
      .finally(() => setCargandoVista(false));
  }, []);

  const porcentajeLlenado = useMemo(() => {
    const respondidos = Object.values(checklist).filter((p) => p.valor === "si" || p.valor === "no").length;
    return Math.round((respondidos / TOTAL_PUNTOS) * 100);
  }, [checklist]);

  const indicePaso = ORDEN_PASOS.indexOf(paso);
  const progresoPasos = Math.round(((indicePaso + 1) / ORDEN_PASOS.length) * 100);

  const validarPasoActual = (): string | null => {
    if (paso === "unidad") {
      if (!ecoUnidad) return "Selecciona el ECO de la unidad.";
      if (kmActual === "") return "Captura el kilometraje actual.";
      if (Number(kmActual) < 0) return "El kilometraje no puede ser negativo.";
    }
    if (paso === "niveles") {
      const incompleto = NIVELES_LABELS.some((n) => {
        const nivel = niveles[n.key] || 0;
        const litros = nivelesLitros[n.key];
        return nivel === 0 || litros === undefined || litros === "" || Number(litros) <= 0;
      });
      if (incompleto) return "Completa el nivel y la cantidad de litros (mayor a 0) de todos los puntos antes de continuar.";
    }
    if (paso === "inspeccion") {
      const faltantes = SECCIONES.find((s) => s.key === "cabina")?.puntos.filter((p) => !checklist[`cabina__${p}`]?.valor) ?? [];
      if (faltantes.length > 0) return `Responde todos los puntos de inspección antes de continuar (faltan ${faltantes.length}).`;
    }
    if (paso === "adicionales") {
      const faltantes = SECCIONES.find((s) => s.key === "adicionales")?.puntos.filter((p) => !checklist[`adicionales__${p}`]?.valor) ?? [];
      if (faltantes.length > 0) return `Responde todos los puntos de adicionales antes de continuar (faltan ${faltantes.length}).`;
    }
    if (paso === "documentacion") {
      const faltantes = SECCIONES.find((s) => s.key === "documentacion")?.puntos.filter((p) => !checklist[`documentacion__${p}`]?.valor) ?? [];
      if (faltantes.length > 0) return `Responde todos los puntos de documentación antes de continuar (faltan ${faltantes.length}).`;
    }
    return null;
  };

  const irSiguiente = () => {
    const error = validarPasoActual();
    if (error) {
      setErrorPaso(error);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErrorPaso("");
    const idx = ORDEN_PASOS.indexOf(paso);
    if (idx < ORDEN_PASOS.length - 1) {
      setPaso(ORDEN_PASOS[idx + 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const irAtras = () => {
    setErrorPaso("");
    const idx = ORDEN_PASOS.indexOf(paso);
    if (idx > 0) {
      setPaso(ORDEN_PASOS[idx - 1]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const guardar = async () => {
    setGuardando(true);
    setMensaje(null);
    try {
      const nivelesConEtiqueta: Record<string, { nivel: string; litros: string; observaciones: string }> = {};
      NIVELES_LABELS.forEach((n) => {
        const v = niveles[n.key] || 0;
        nivelesConEtiqueta[n.key] = { nivel: v > 0 ? NIVEL_OPCIONES[v - 1] : "", litros: nivelesLitros[n.key] ?? "", observaciones: nivelesObs[n.key] ?? "" };
      });
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eco_unidad: ecoUnidad,
          descripcion_unidad: unidadSeleccionada?.descripcion || "",
          placas: unidadSeleccionada?.placa || "",
          kilometraje_actual: kmActual ? Number(kmActual) : null,
          fotos_evidencia: fotos,
          fotos_libres: detallesEncontrados ? fotosLibres : [],
          niveles: nivelesConEtiqueta,
          checklist,
          porcentaje_llenado: porcentajeLlenado,
        }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        throw new Error(res.status === 413 ? "Las fotos son muy pesadas. Vuelve a tomarlas e intenta de nuevo." : `Error del servidor (${res.status}). Intenta de nuevo.`);
      }
      if (!res.ok) throw new Error(data.error || "Error al guardar.");
      const resumenNiveles: string[] = [];
      NIVELES_LABELS.forEach((n) => {
        const v = niveles[n.key] || 0;
        if (v > 0 && v < NIVEL_OPCIONES.length) {
          const litros = nivelesLitros[n.key] || "";
          resumenNiveles.push(`Se completa el nivel de ${n.label.replace(/^Nivel de /i, "")}${litros ? `, cantidad completada: ${litros} L` : ""}.`);
        }
      });
      const resumenPuntos: string[] = [];
      SECCIONES.forEach((sec) => {
        sec.puntos.forEach((p) => {
          const key = `${sec.key}__${p}`;
          if (checklist[key]?.valor === "no") resumenPuntos.push(`${p} NO PASA`);
        });
      });
      const resumenTexto = [...resumenNiveles, ...resumenPuntos].join(" · ");
      if (resumenTexto) {
        fetch("/api/revision-semanal/comentarios", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eco: ecoUnidad, comentario: resumenTexto }) }).catch(() => {});
      }
      setFolioGuardado(data.folio);
      setRegistroVista({ folio: data.folio, descripcion_unidad: unidadSeleccionada?.descripcion || "", placas: unidadSeleccionada?.placa || "", fecha_hora: data.fecha_hora });
    } catch (err: any) {
      setMensaje({ tipo: "error", texto: err?.message || "Error al guardar. Revisa tu conexión." });
    } finally {
      setGuardando(false);
    }
  };

  const imprimirChecklist = () => {
    const ventana = window.open("", "_blank", "width=900,height=700");
    if (!ventana) {
      alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
      return;
    }
    const folio = folioGuardado || registroVista?.folio || "—";
    const fecha = registroVista?.fecha_hora ? new Date(registroVista.fecha_hora).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
    const fotosTodas = [...FOTOS_LABELS, ...FOTOS_INTERIOR_LABELS].filter((l) => fotos[l]);
    const fotosHtml = fotosTodas
      .map((l) => `<div class="foto"><img src="${fotos[l]}" alt="${escaparHtml(l)}" /><p>${escaparHtml(l)}</p></div>`)
      .join("");
    const fotosLibresHtml = fotosLibres.length
      ? `<div class="bloque"><h3>Fotos de detalles encontrados</h3><div class="fotos-grid">${fotosLibres.map((f, i) => `<div class="foto"><img src="${f}" alt="Detalle ${i + 1}" /></div>`).join("")}</div></div>`
      : "";
    const nivelesHtml = NIVELES_LABELS.map((n) => {
      const v = niveles[n.key] || 0;
      return `<tr><td>${escaparHtml(n.label)}</td><td>${v > 0 ? NIVEL_OPCIONES[v - 1] : "—"}</td><td>${escaparHtml(nivelesLitros[n.key] || "—")}</td><td>${escaparHtml(nivelesObs[n.key] || "—")}</td></tr>`;
    }).join("");
    const seccionHtml = (sec: { key: string; titulo: string; puntos: string[] }) =>
      `<div class="bloque">
        <h3>${escaparHtml(sec.titulo)}</h3>
        <table>
          <thead><tr><th>Punto</th><th>Resultado</th><th>Comentario</th></tr></thead>
          <tbody>
            ${sec.puntos
              .map((p) => {
                const key = `${sec.key}__${p}`;
                const v = checklist[key];
                const opciones = sec.key === "cabina" ? OPCIONES_CABINA[p] : undefined;
                const texto = v?.valor === "si" ? opciones?.[0] || "Sí" : v?.valor === "no" ? opciones?.[1] || "No" : "Sin responder";
                const clase = v?.valor === "si" ? "ok" : v?.valor === "no" ? "malo" : "vacio";
                return `<tr><td>${escaparHtml(p)}</td><td class="${clase}">${escaparHtml(texto)}</td><td>${escaparHtml(v?.comentario || "—")}</td></tr>`;
              })
              .join("")}
          </tbody>
        </table>
      </div>`;
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Check List — ${escaparHtml(folio)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; padding: 0; background: #eef1f6; color: #1e1e1e; }
  .hoja { max-width: 780px; margin: 20px auto; background: #fff; }
  .cab { background: #16215c; color: #fff; padding: 18px 24px; display: flex; justify-content: space-between; align-items: center; }
  .cab h1 { font-size: 16px; margin: 0 0 3px; text-transform: uppercase; letter-spacing: 0.5px; }
  .cab p { font-size: 11px; margin: 0; color: #a9c2ee; }
  .cab .folio { text-align: right; font-size: 11px; }
  .cuerpo { padding: 18px 24px; }
  .datos { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 16px; font-size: 12px; }
  .datos b { color: #16215c; }
  .bloque { margin-bottom: 20px; break-inside: avoid; }
  .bloque h3 { font-size: 12.5px; text-transform: uppercase; color: #16215c; border-bottom: 2px solid #2f6fed; padding-bottom: 4px; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  th { text-align: left; background: #f4f5f8; color: #9aa1b0; text-transform: uppercase; font-size: 9px; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e8ee; }
  td.ok { color: #21a866; font-weight: bold; }
  td.malo { color: #e2412c; font-weight: bold; }
  td.vacio { color: #9aa1b0; }
  .fotos-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .foto { text-align: center; break-inside: avoid; }
  .foto img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 6px; border: 1px solid #e5e8ee; }
  .foto p { font-size: 8.5px; margin: 3px 0 0; color: #5a5a5a; }
  .barra { padding: 14px 0; text-align: center; }
  button { padding: 10px 26px; font-size: 13px; font-weight: bold; background: #16215c; color: #fff; border: none; border-radius: 8px; cursor: pointer; }
  @media print { body { background: #fff; } .hoja { margin: 0; max-width: none; } .barra { display: none; } }
</style>
</head>
<body>
<div class="hoja">
  <div class="cab">
    <div><h1>Check List Diario de Unidades</h1><p>Transportes Logisticar</p></div>
    <div class="folio">Folio: ${escaparHtml(folio)}<br/>${escaparHtml(fecha)}</div>
  </div>
  <div class="cuerpo">
    <div class="datos">
      <span><b>ECO:</b> ${escaparHtml(ecoUnidad)}</span>
      <span><b>Descripción:</b> ${escaparHtml(unidadSeleccionada?.descripcion || registroVista?.descripcion_unidad || "—")}</span>
      <span><b>Placas:</b> ${escaparHtml(unidadSeleccionada?.placa || registroVista?.placas || "—")}</span>
      <span><b>Kilometraje:</b> ${escaparHtml(kmActual || "—")}</span>
    </div>
    <div class="bloque">
      <h3>Evidencia de estado físico</h3>
      <div class="fotos-grid">${fotosHtml || "<p>Sin fotos.</p>"}</div>
    </div>
    <div class="bloque">
      <h3>Revisión de niveles</h3>
      <table><thead><tr><th>Punto</th><th>Nivel</th><th>Litros</th><th>Observaciones</th></tr></thead><tbody>${nivelesHtml}</tbody></table>
    </div>
    ${SECCIONES.map(seccionHtml).join("")}
    ${fotosLibresHtml}
  </div>
</div>
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });</script>
</body>
</html>`;
    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  };

  const cabinaHayNegativos = SECCIONES.find((s) => s.key === "cabina")?.puntos.some((p) => checklist[`cabina__${p}`]?.valor === "no") ?? false;

  return (
    <div className="min-h-screen flex justify-center bg-[#dcdfe6] py-6 px-2 sm:px-4">
      <div className="w-full max-w-[430px] md:max-w-[620px] lg:max-w-[760px] bg-white min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-xl overflow-hidden pb-8 relative">
        <div className="px-4 sm:px-6 pt-4 pb-3 flex items-center justify-between border-b border-[var(--gray-200)] flex-wrap gap-2">
          <a href="/checklist/elegir" className="text-[var(--blue)] text-xs font-semibold">
            ← Tipo de check list
          </a>
          <div className="flex items-center gap-2">
            <Logo size={32} />
            <div className="leading-tight">
              <p className="font-display font-extrabold text-[var(--red)] text-[12px] m-0">TRANSPORTES</p>
              <p className="font-display font-extrabold text-[var(--red)] text-[12px] m-0">LOGISTICAR</p>
            </div>
          </div>
        </div>
        <div className="text-center py-2 border-b border-[var(--gray-200)]">
          <h1 className="font-display font-extrabold text-[var(--navy)] text-base uppercase tracking-wide">Check List Diario de Unidades</h1>
        </div>
        {!modoSoloLectura && !folioGuardado && (
          <div className="px-4 sm:px-6 py-2.5 border-b border-[var(--gray-200)]">
            <button type="button" onClick={abrirReporte} className="w-full flex items-center justify-center gap-1.5 bg-[var(--blue-light)] text-[var(--blue)] font-display font-bold text-[11.5px] rounded-lg py-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
              Reporte de estado de unidades
            </button>
          </div>
        )}
        {modoSoloLectura && (
          <div className="bg-[var(--blue-light)] px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2 border-b border-[var(--gray-200)] flex-wrap">
            <span className="text-[11px] font-bold text-[var(--navy)]">👁 Viendo registro {registroVista ? `· Folio: ${registroVista.folio}` : ""} (solo lectura)</span>
            <a href="/registros" className="text-[11px] text-[var(--blue)] font-bold whitespace-nowrap">← Registros</a>
          </div>
        )}
        {cargandoVista && <p className="text-center text-xs text-[var(--gray-400)] py-3">Cargando registro...</p>}

        {!folioGuardado && (
          <div className="px-4 sm:px-6 py-3 border-b border-[var(--gray-200)]">
            <div className="flex justify-between text-[11px] text-[var(--text)] mb-1">
              <span>{TITULOS_PASO[paso]}</span>
              <span className="font-semibold text-[var(--blue)]">
                Paso {indicePaso + 1} de {ORDEN_PASOS.length}
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--gray-200)] overflow-hidden">
              <div className="h-full bg-[var(--blue)] transition-all" style={{ width: `${progresoPasos}%` }} />
            </div>
          </div>
        )}

        {errorPaso && !folioGuardado && (
          <div className="mx-4 sm:mx-6 mt-3 bg-[rgba(226,65,44,0.1)] border border-[var(--red)]/30 rounded-lg px-3.5 py-2.5 text-[12px] font-semibold text-[var(--red)]">
            ⚠ {errorPaso}
          </div>
        )}

        <div className={`px-4 sm:px-6 py-4 flex flex-col gap-5 ${modoSoloLectura ? "pointer-events-none" : ""}`}>
          {paso === "unidad" && !folioGuardado && (
            <>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-3 flex-1">
                  <label className="font-display font-extrabold text-[var(--navy)] text-xs whitespace-nowrap">ECO. UNIDAD</label>
                  <select value={ecoUnidad} onChange={(e) => setEcoUnidad(e.target.value)} className="flex-1 h-9 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-2 text-sm">
                    {UNIDADES.map((u) => (
                      <option key={u.eco} value={u.eco}>
                        {u.eco}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3 flex-1">
                  <label className="font-display font-extrabold text-[var(--navy)] text-xs whitespace-nowrap">Kilometraje</label>
                  <input
                    type="number"
                    min={0}
                    value={kmActual}
                    onChange={(e) => {
                      setKmActual(e.target.value);
                      setErrorPaso("");
                    }}
                    placeholder="0"
                    className="flex-1 h-9 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm"
                  />
                </div>
              </div>
              <div className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[11.5px] flex flex-col gap-1">
                <span>
                  <b className="text-[var(--navy)]">Descripción de unidad:</b> {unidadSeleccionada?.descripcion || "—"}
                </span>
                <span>
                  <b className="text-[var(--navy)]">Placas:</b> {unidadSeleccionada?.placa || "—"}
                </span>
              </div>
            </>
          )}

          {paso === "evidencia" && !folioGuardado && (
            <div>
              <p className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-2.5">Evidencia de estado físico de la unidad</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {FOTOS_LABELS.map((label) => (
                  <FotoCardGrande key={label} label={label} foto={fotos[label] || null} onFoto={(dataUrl) => setFotos((prev) => ({ ...prev, [label]: dataUrl }))} onVer={() => setFotoAmpliada(fotos[label] || null)} />
                ))}
              </div>
            </div>
          )}

          {paso === "niveles" && !folioGuardado && (
            <div>
              <p className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-2.5">Revisión de niveles</p>
              <div className="border border-[var(--gray-200)] rounded-lg overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      {["Punto a revisar", "Nivel", "Litros", "Observaciones"].map((h) => (
                        <th key={h} className="bg-[var(--navy)] text-white text-[8.5px] uppercase font-bold px-1.5 py-2 text-left">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {NIVELES_LABELS.map((n) => (
                      <tr key={n.key} className="border-b border-[var(--gray-200)] last:border-0">
                        <td className="px-1.5 py-2 text-[11px] font-bold w-[74px]">{n.label}</td>
                        <td className="px-1.5 py-2 w-[110px]">
                          <BarraNivel label={n.label} value={niveles[n.key] || 0} onChange={(v) => setNiveles((prev) => ({ ...prev, [n.key]: v }))} />
                        </td>
                        <td className="px-1.5 py-2 w-[46px]">
                          <input
                            type="number"
                            min={0}
                            value={nivelesLitros[n.key] ?? ""}
                            onChange={(e) => {
                              setNivelesLitros((prev) => ({ ...prev, [n.key]: e.target.value }));
                              setErrorPaso("");
                            }}
                            placeholder="0"
                            className="w-full text-center border border-[var(--gray-200)] rounded px-1 py-1 text-[10px]"
                          />
                        </td>
                        <td className="px-1.5 py-2">
                          <input
                            type="text"
                            value={nivelesObs[n.key] ?? ""}
                            onChange={(e) => setNivelesObs((prev) => ({ ...prev, [n.key]: e.target.value }))}
                            placeholder="Observaciones"
                            className="w-full bg-[var(--gray-100)] border border-[var(--gray-200)] rounded px-1.5 py-1 text-[9.5px]"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {paso === "inspeccion" && !folioGuardado && (
            <div>
              <div className="border border-[var(--gray-200)] rounded-lg p-3.5 mb-4">
                <h2 className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-1">Inspección completa</h2>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {FOTOS_INTERIOR_LABELS.map((label) => (
                    <FotoCardGrande key={label} label={label} foto={fotos[label] || null} onFoto={(dataUrl) => setFotos((prev) => ({ ...prev, [label]: dataUrl }))} onVer={() => setFotoAmpliada(fotos[label] || null)} />
                  ))}
                </div>
                {SECCIONES.find((s) => s.key === "cabina")?.puntos.map((p) => {
                  const key = `cabina__${p}`;
                  const estado = checklist[key];
                  return (
                    <PuntoChecklist
                      key={key}
                      label={p}
                      value={estado?.valor ?? null}
                      comentarioActivo={estado?.comentarioActivo ?? false}
                      comentario={estado?.comentario ?? ""}
                      onChange={(v) => setPunto(key, v, true)}
                      onToggleComentario={() => toggleComentario(key)}
                      onComentarioChange={(v) => setComentario(key, v)}
                      opciones={OPCIONES_CABINA[p]}
                    />
                  );
                })}
              </div>
              <label className="flex items-center gap-2.5 bg-[var(--gray-100)] rounded-lg px-3.5 py-3 cursor-pointer mb-3">
                <input type="checkbox" checked={detallesEncontrados} onChange={(e) => setDetallesEncontrados(e.target.checked)} className="w-4 h-4 accent-[var(--red)]" />
                <span className="text-[12px] font-bold text-[var(--navy)]">Se encontraron detalles en la unidad</span>
                {cabinaHayNegativos && !detallesEncontrados && <span className="text-[10px] text-[var(--red)] font-bold ml-auto">Hay puntos marcados como &quot;No&quot;</span>}
              </label>
              {detallesEncontrados && (
                <MultiFotoUploader titulo="Agrega fotos de los detalles encontrados" fotos={fotosLibres} onChange={setFotosLibres} onVerFoto={(i) => setFotoAmpliada(fotosLibres[i])} />
              )}
            </div>
          )}

          {paso === "adicionales" && !folioGuardado && (
            <div className="border border-[var(--gray-200)] rounded-lg p-3.5">
              <h2 className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-1">Adicionales de la unidad</h2>
              {SECCIONES.find((s) => s.key === "adicionales")?.puntos.map((p) => {
                const key = `adicionales__${p}`;
                const estado = checklist[key];
                return (
                  <PuntoChecklistCompacto key={key} label={p} value={estado?.valor ?? null} comentario={estado?.comentario ?? ""} onChange={(v) => setPunto(key, v)} onComentarioChange={(v) => setComentario(key, v)} />
                );
              })}
            </div>
          )}

          {paso === "documentacion" && !folioGuardado && (
            <div className="border border-[var(--gray-200)] rounded-lg p-3.5">
              <h2 className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-1">Documentación</h2>
              {SECCIONES.find((s) => s.key === "documentacion")?.puntos.map((p) => {
                const key = `documentacion__${p}`;
                const estado = checklist[key];
                return (
                  <PuntoChecklistCompacto key={key} label={p} value={estado?.valor ?? null} comentario={estado?.comentario ?? ""} onChange={(v) => setPunto(key, v)} onComentarioChange={(v) => setComentario(key, v)} />
                );
              })}
            </div>
          )}

          {(paso === "resumen" || modoSoloLectura) && (
            <div className="flex flex-col gap-5">
              {!modoSoloLectura && <p className="text-[12px] text-[var(--gray-400)] -mt-1">Revisa la información antes de guardar. Puedes regresar a cualquier sección para corregir algo.</p>}

              <div className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[11.5px] flex flex-col gap-1">
                <span><b className="text-[var(--navy)]">ECO:</b> {ecoUnidad} · <b className="text-[var(--navy)]">Kilometraje:</b> {kmActual || "—"}</span>
                <span><b className="text-[var(--navy)]">Descripción:</b> {(modoSoloLectura ? registroVista?.descripcion_unidad : unidadSeleccionada?.descripcion) || "—"} · <b className="text-[var(--navy)]">Placas:</b> {(modoSoloLectura ? registroVista?.placas : unidadSeleccionada?.placa) || "—"}</span>
              </div>

              <div>
                <p className="font-display font-extrabold text-[var(--navy)] text-[12px] uppercase mb-2">Evidencia fotográfica</p>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {[...FOTOS_LABELS, ...FOTOS_INTERIOR_LABELS].map((l) => (
                    <div key={l} onClick={() => fotos[l] && setFotoAmpliada(fotos[l] || null)} className="aspect-square rounded-lg bg-[var(--gray-100)] overflow-hidden cursor-pointer pointer-events-auto">
                      {fotos[l] && <img src={fotos[l] || ""} alt={l} className="w-full h-full object-cover" />}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="font-display font-extrabold text-[var(--navy)] text-[12px] uppercase mb-2">Niveles</p>
                <div className="flex flex-col gap-1">
                  {NIVELES_LABELS.map((n) => (
                    <div key={n.key} className="flex justify-between text-[11.5px] border-b border-[var(--gray-200)] py-1.5 last:border-0">
                      <span>{n.label}</span>
                      <span className="font-bold text-[var(--navy)]">{niveles[n.key] > 0 ? NIVEL_OPCIONES[niveles[n.key] - 1] : "—"}{nivelesLitros[n.key] ? ` · ${nivelesLitros[n.key]} L` : ""}</span>
                    </div>
                  ))}
                </div>
              </div>

              {SECCIONES.map((sec) => (
                <div key={sec.key}>
                  <p className="font-display font-extrabold text-[var(--navy)] text-[12px] uppercase mb-2">{sec.titulo}</p>
                  <div className="flex flex-col gap-1">
                    {sec.puntos.map((p) => {
                      const key = `${sec.key}__${p}`;
                      const v = checklist[key];
                      const opciones = sec.key === "cabina" ? OPCIONES_CABINA[p] : undefined;
                      return (
                        <div key={key} className="flex justify-between gap-2 text-[11.5px] border-b border-[var(--gray-200)] py-1.5 last:border-0">
                          <span className="flex-1">{p}</span>
                          <span className={`font-bold shrink-0 ${v?.valor === "si" ? "text-[var(--green)]" : v?.valor === "no" ? "text-[var(--red)]" : "text-[var(--gray-400)]"}`}>
                            {v?.valor === "si" ? opciones?.[0] || "Sí" : v?.valor === "no" ? opciones?.[1] || "No" : "Sin responder"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {fotosLibres.length > 0 && (
                <div>
                  <p className="font-display font-extrabold text-[var(--navy)] text-[12px] uppercase mb-2">Fotos de detalles encontrados</p>
                  <div className="flex flex-wrap gap-2">
                    {fotosLibres.map((f, i) => (
                      <div key={i} onClick={() => setFotoAmpliada(f)} className="w-14 h-14 rounded-md overflow-hidden border border-[var(--gray-200)] cursor-pointer pointer-events-auto">
                        <img src={f} alt={`Detalle ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {folioGuardado && (
            <div className="flex flex-col items-center text-center py-6 gap-3">
              <div className="w-14 h-14 rounded-full bg-[var(--green)] flex items-center justify-center">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <h2 className="font-display font-extrabold text-[var(--navy)] text-[16px] m-0">¡Checklist guardado!</h2>
              <p className="text-[12.5px] text-[var(--gray-400)] m-0">Folio: {folioGuardado}</p>
              <div className="flex flex-col gap-2.5 w-full max-w-[280px] mt-3">
                <button type="button" onClick={imprimirChecklist} className="flex items-center justify-center gap-2 bg-[var(--navy)] text-white font-display font-bold text-[12.5px] rounded-lg py-3">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                  Imprimir checklist
                </button>
                <a href="/checklist" className="text-center bg-[var(--gray-100)] text-[var(--navy)] font-display font-bold text-[12.5px] rounded-lg py-3 no-underline">
                  Llenar otro checklist
                </a>
                <a href="/registros" className="text-center text-[var(--blue)] font-bold text-[12px] py-1 no-underline">
                  Ver registros guardados
                </a>
              </div>
            </div>
          )}

          {mensaje && !folioGuardado && <p className={`text-xs -mt-2 ${mensaje.tipo === "ok" ? "text-[var(--green)]" : "text-[var(--red)]"}`}>{mensaje.texto}</p>}
        </div>

        {!modoSoloLectura && !folioGuardado && (
          <div className="px-4 sm:px-6 py-4 border-t border-[var(--gray-200)] flex gap-2.5">
            <button
              type="button"
              onClick={irAtras}
              disabled={indicePaso === 0}
              className="flex-1 bg-white border border-[var(--gray-200)] text-[var(--navy)] disabled:opacity-40 font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3"
            >
              Retroceder
            </button>
            {paso === "resumen" ? (
              <button type="button" onClick={guardar} disabled={guardando} className="flex-[2] bg-[var(--green)] disabled:opacity-60 text-white font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3">
                {guardando ? "Guardando..." : "Confirmar y guardar"}
              </button>
            ) : (
              <button type="button" onClick={irSiguiente} className="flex-[2] bg-[var(--navy)] text-white font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3">
                Siguiente
              </button>
            )}
          </div>
        )}
        {modoSoloLectura && (
          <div className="px-4 sm:px-6 py-4 border-t border-[var(--gray-200)] flex gap-2.5">
            <a href="/registros" className="flex-1 text-center bg-white border border-[var(--gray-200)] text-[var(--navy)] font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3 no-underline">
              ← Registros
            </a>
            <button type="button" onClick={imprimirChecklist} className="flex-[2] flex items-center justify-center gap-2 bg-[var(--navy)] text-white font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
              Imprimir
            </button>
          </div>
        )}
      </div>

      {reporteAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-[440px] sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--gray-200)]">
              <h2 className="font-display font-extrabold text-[var(--navy)] text-[13.5px] uppercase">Reporte de estado de unidades</h2>
              <span onClick={() => setReporteAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">✕</span>
            </div>
            <div className="flex gap-1.5 px-4 py-2.5 border-b border-[var(--gray-200)]">
              {([["todas", "Todas"], ["ok", "OK"], ["con_detalles", "Con detalles"]] as const).map(([key, label]) => (
                <button key={key} type="button" onClick={() => setFiltroReporte(key)} className={`text-[10.5px] font-bold px-2.5 py-1.5 rounded-full ${filtroReporte === key ? "bg-[var(--navy)] text-white" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}>
                  {label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {cargandoReporte && <p className="text-center text-xs text-[var(--gray-400)] py-6">Generando reporte...</p>}
              {!cargandoReporte &&
                filasReporte
                  .filter((f) => (filtroReporte === "todas" ? true : f.estado === filtroReporte))
                  .map((f) => (
                    <div key={f.eco} className="py-2.5 border-b border-[var(--gray-200)] last:border-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-display font-bold text-[var(--navy)] text-[12.5px]">{f.eco}</span>
                        <span className={`text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${f.estado === "ok" ? "bg-[var(--green)] text-white" : f.estado === "con_detalles" ? "bg-[var(--red)] text-white" : "bg-[var(--gray-200)] text-[var(--gray-400)]"}`}>
                          {f.estado === "ok" ? "OK" : f.estado === "con_detalles" ? `${f.detalles.length} detalle(s)` : "Sin checklist"}
                        </span>
                      </div>
                      <p className="text-[10.5px] text-[var(--gray-400)] m-0 mb-1">
                        {f.descripcion || "—"} {f.placas ? `· ${f.placas}` : ""} {f.fechaHora ? `· ${new Date(f.fechaHora).toLocaleDateString("es-MX")}` : ""}
                      </p>
                      {f.detalles.length > 0 && (
                        <ul className="pl-4 m-0 flex flex-col gap-0.5">
                          {f.detalles.map((d, i) => (
                            <li key={i} className="text-[11px] text-[var(--red)] list-disc">
                              <b>{d.punto}</b>
                              {d.comentario ? `: ${d.comentario}` : ""} <span className="text-[var(--gray-400)]">({d.seccion})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
              {!cargandoReporte && filasReporte.filter((f) => (filtroReporte === "todas" ? true : f.estado === filtroReporte)).length === 0 && (
                <p className="text-center text-xs text-[var(--gray-400)] py-6">Sin unidades para mostrar.</p>
              )}
            </div>
            <div className="p-3.5 border-t border-[var(--gray-200)]">
              <button type="button" onClick={() => setReporteAbierto(false)} className="w-full bg-[var(--navy)] text-white font-display font-bold text-xs rounded-lg py-2.5">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      {fotoAmpliada && (
        <div onClick={() => setFotoAmpliada(null)} className="fixed inset-0 bg-black/85 z-[60] flex items-center justify-center p-4">
          <img src={fotoAmpliada} alt="Foto ampliada" className="max-w-full max-h-full rounded-lg object-contain" />
          <span onClick={() => setFotoAmpliada(null)} className="absolute top-4 right-5 text-white text-2xl leading-none cursor-pointer">✕</span>
        </div>
      )}
    </div>
  );
}
