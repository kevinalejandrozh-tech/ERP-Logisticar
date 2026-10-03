"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { CAMPOS_UNIDAD } from "@/lib/unidadFormData";
import { exportarExcel } from "@/lib/exportExcel";
import { compressImage } from "@/lib/imageUtils";
import { useSesion } from "@/lib/useSesion";

type RegistroUnidad = Record<string, string>;
type ModoFicha = "ver" | "editar" | "nuevo";
type Resultados = Record<string, Record<string, boolean>>;
type Revision = {
  id: number;
  eco: string;
  fecha: string;
  resultados: Resultados;
  observaciones: string | null;
  realizado_por: string | null;
  kilometraje?: number | null;
  neumaticos?: Record<string, Llanta | string> | null; // { P1: { folio, mm }, ..., PR: { folio, mm } }
};
type Llanta = { folio?: string; mm?: number | null };
type DocumentoMeta = { nombre_archivo: string | null; cargado_por: string | null; fecha_carga: string };

const ZONA = "America/Mexico_City";

// Documentos PDF por unidad: independientes del checklist/revisión rápida — se guardan al
// subirlos (no hace falta "Guardar revisión") y se conservan hasta que se reemplacen con otro archivo.
const DOCUMENTOS_UNIDAD: { tipo: string; etiqueta: string }[] = [
  { tipo: "tarjeta_circulacion", etiqueta: "Tarjeta de circulación" },
  { tipo: "poliza_seguro", etiqueta: "Póliza de Seguro" },
  { tipo: "verificacion", etiqueta: "Verificación" },
];
const MAX_PDF_MB = 4;
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

// Checklist rápido de unidad (se guarda en unidades_revisiones).
const CHECKLIST: { titulo: string; nota?: string; items: string[] }[] = [
  {
    titulo: "Auditoría GPS",
    nota: "Todos los comandos deben registrarse en la plataforma",
    items: [
      "Paro de motor desde Plataforma",
      "Voz cabina Bidireccional",
      "Paro al abrir puerta del Piloto",
      "Botón de Pánico Piloto",
      "Paro al abrir puerta Copiloto",
      "Botón de Pánico Copiloto",
      "Apertura de Chapa Trasera",
      "Sirenas de Emergencia",
    ],
  },
  {
    titulo: "Funcionamiento",
    nota: "Todos los comandos deben registrarse en la plataforma",
    items: [
      "Clima / Aire Acondicionado",
      "Plumas del Limpiaparabrisas",
      "Luces Altas",
      "Luces Bajas",
      "Cuartos",
      "Direccionales",
      "Intermitentes",
      "STOP / Luces traseras",
      "Luces de Navegación",
      "Luces de Reversa",
      "Alarma de Reversa",
      "Luz Interior",
      "Claxon",
    ],
  },
  {
    titulo: "Herramental",
    items: ["Botiquín de primeros Auxilios", "Gato Hidráulico 1.5 Ton.", "Triángulos Reflectantes", "Birlos y Herramienta"],
  },
  {
    titulo: "Documentos",
    items: ["Póliza de Seguro Vigente", "Tarjeta de Circulación", "Certificado de Verificación", "Hojas de Descanso de Operador"],
  },
];
// Checklists adicionales (se abren en recuadro desde los botones debajo de la fotografía).
// Se guardan junto con la revisión, en el mismo JSON de resultados.
const CHECKLIST_EXTRA: { titulo: string; nota?: string; items: string[] }[] = [
  { titulo: "Carrocería", items: ["Frente", "Lateral izquierda", "Lateral derecha", "Atrás"] },
];
const CHECKLIST_TODOS = [...CHECKLIST, ...CHECKLIST_EXTRA];
const TOTAL_PUNTOS = CHECKLIST_TODOS.reduce((n, b) => n + b.items.length, 0);

// Neumáticos: las posiciones dependen del tipo de unidad (se detecta por el nombre de la unidad).
// Cada posición lleva un folio individual por llanta y su profundidad de dibujo en MM; PR = llanta de refacción.
// Semáforo por MM: < rojo = crítico (alerta en todo el panel) · rojo ≤ mm < amarillo · amarillo ≤ mm < verde · ≥ verde.
type LimitesMM = { rojo: number; amarillo: number; verde: number; max: number };
type TipoNeumaticos = { tipo: string; patron: RegExp; posiciones: string[]; mm: LimitesMM };
const posicionesLlantas = (n: number) => [...Array.from({ length: n }, (_, i) => `P${i + 1}`), "PR"];
const TIPOS_NEUMATICOS: TipoNeumaticos[] = [
  { tipo: "Transporter", patron: /transporter/i, posiciones: posicionesLlantas(4), mm: { rojo: 2, amarillo: 3, verde: 4, max: 9.2 } },
  { tipo: "Sprinter", patron: /sprinter/i, posiciones: posicionesLlantas(4), mm: { rojo: 2, amarillo: 3, verde: 4, max: 11 } },
  { tipo: "Delivery", patron: /delivery/i, posiciones: posicionesLlantas(6), mm: { rojo: 2, amarillo: 3, verde: 4, max: 11 } },
  { tipo: "Torthon", patron: /torth?on/i, posiciones: posicionesLlantas(10), mm: { rojo: 4, amarillo: 5, verde: 6, max: 18 } },
];
const POSICIONES_EXPORTAR = posicionesLlantas(10);
const MAX_FOLIO = 40;
const MM_RE = /^\d{0,2}(\.\d{0,2})?$/; // decimal positivo, hasta 2 decimales (sin signo negativo)

function tipoNeumaticos(registro: RegistroUnidad | null) {
  if (!registro) return null;
  const texto = `${registro["Unidad"] || ""} ${registro["Modelo/Tipo"] || ""}`;
  return TIPOS_NEUMATICOS.find((t) => t.patron.test(texto)) || null;
}

type Semaforo = "critico" | "rojo" | "amarillo" | "verde";
function semaforoMM(mm: number, lim: LimitesMM): Semaforo {
  if (mm < lim.rojo) return "critico";
  if (mm < lim.amarillo) return "rojo";
  if (mm < lim.verde) return "amarillo";
  return "verde";
}
const ESTILO_SEMAFORO: Record<Semaforo, { borde: string; chip: string; etiqueta: string }> = {
  critico: { borde: "border-[#ff1a1a] shadow-[0_0_0_3px_rgba(255,26,26,0.35),0_0_14px_rgba(255,26,26,0.55)]", chip: "bg-[#ff1a1a] text-white", etiqueta: "Crítico" },
  rojo: { borde: "border-[var(--red)]", chip: "bg-[#fde4e0] text-[var(--red)]", etiqueta: "Rojo" },
  amarillo: { borde: "border-[var(--amber)]", chip: "bg-[#fdf1d6] text-[#9a6a00]", etiqueta: "Amarillo" },
  verde: { borde: "border-[var(--green)]", chip: "bg-[#dcf5e8] text-[#137a4a]", etiqueta: "Verde" },
};

// Acepta el formato nuevo { folio, mm } y el anterior (solo folio como texto).
function leerLlanta(valor: Llanta | string | undefined | null): Llanta {
  if (!valor) return {};
  if (typeof valor === "string") return { folio: valor, mm: null };
  return valor;
}
const formatoMM = (mm: number) => `${mm.toLocaleString("es-MX", { maximumFractionDigits: 2 })} mm`;

// Ficha técnica: las Sprinter manejan medida de llanta delantera y trasera en lugar de la medida STD.
const CAMPO_MEDIDA_STD = "Medida STD de llantas";
const CAMPOS_MEDIDA_SPRINTER = ["Medida llantas delanteras", "Medida llantas traseras"];
function camposFicha(registro: RegistroUnidad) {
  return tipoNeumaticos(registro)?.tipo === "Sprinter"
    ? CAMPOS_UNIDAD.flatMap((c) => (c === CAMPO_MEDIDA_STD ? CAMPOS_MEDIDA_SPRINTER : [c]))
    : CAMPOS_UNIDAD;
}

// Animación del panel principal cuando alguna llanta está por debajo del mínimo permitido.
const CSS_ALERTA = `
@keyframes llantas-parpadeo {
  0%, 100% { border-color: #ff1a1a; box-shadow: 0 0 10px 2px rgba(255, 26, 26, 0.45); }
  50% { border-color: #ff8a8a; box-shadow: 0 0 34px 10px rgba(255, 26, 26, 0.9); }
}
.llantas-alerta-critica { animation: llantas-parpadeo 0.9s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .llantas-alerta-critica { animation: none; box-shadow: 0 0 24px 6px rgba(255, 26, 26, 0.75); }
}
`;

function IconoAviso({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

// ---------- Utilidades ----------
function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

function escaparHtml(t: string) {
  return String(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Clave por bloque + punto (evita choques si dos bloques llegan a tener un punto con el mismo nombre).
const clavePunto = (bloque: string, item: string) => `${bloque}::${item}`;

function hoyLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date()); // AAAA-MM-DD
}

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatoHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
}

function diaLocal(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(iso));
}

function formatoDia(dia: string) {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

function contarCumplidos(resultados: Resultados) {
  let ok = 0;
  let total = 0;
  for (const bloque of Object.values(resultados || {})) {
    for (const v of Object.values(bloque || {})) {
      total++;
      if (v) ok++;
    }
  }
  return { ok, total };
}

async function leerJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de comunicación con el servidor.");
  return data;
}

async function obtenerUnidades(): Promise<{ registros: RegistroUnidad[]; conImagen: string[]; noDisponibles: string[] }> {
  const data = await leerJson(await fetch("/api/unidades/list", { cache: "no-store" }));
  return { registros: data.registros || [], conImagen: data.conImagen || [], noDisponibles: data.noDisponibles || [] };
}

async function obtenerImagen(eco: string): Promise<string | null> {
  const data = await leerJson(await fetch(`/api/unidades/imagen?eco=${encodeURIComponent(eco)}`, { cache: "no-store" }));
  return data.imagen || null;
}

async function obtenerRevisiones(filtros: { eco?: string; desde?: string; hasta?: string; limite?: number }): Promise<Revision[]> {
  const q = new URLSearchParams();
  if (filtros.eco) q.set("eco", filtros.eco);
  if (filtros.desde) q.set("desde", filtros.desde);
  if (filtros.hasta) q.set("hasta", filtros.hasta);
  if (filtros.limite) q.set("limite", String(filtros.limite));
  const data = await leerJson(await fetch(`/api/unidades/revisiones?${q.toString()}`, { cache: "no-store" }));
  return data.registros || [];
}

// Documentos PDF de la unidad: solo metadatos (nombre, fecha, quién lo subió); el contenido
// se pide aparte (obtenerDocumentoPdf) hasta que el usuario da clic en "Descargar".
async function obtenerDocumentos(eco: string): Promise<Record<string, DocumentoMeta>> {
  const data = await leerJson(await fetch(`/api/unidades/documentos?eco=${encodeURIComponent(eco)}`, { cache: "no-store" }));
  return data.documentos || {};
}

async function obtenerDocumentoPdf(eco: string, tipo: string): Promise<{ nombreArchivo: string; contenido: string }> {
  const data = await leerJson(
    await fetch(`/api/unidades/documentos/descargar?eco=${encodeURIComponent(eco)}&tipo=${encodeURIComponent(tipo)}`, { cache: "no-store" })
  );
  return { nombreArchivo: data.nombreArchivo, contenido: data.contenido };
}

async function subirDocumentoPdf(eco: string, tipo: string, nombreArchivo: string, contenido: string): Promise<DocumentoMeta> {
  const data = await leerJson(
    await fetch("/api/unidades/documentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eco, tipo, nombreArchivo, contenido }),
    })
  );
  return data.documento;
}

function leerArchivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result || ""));
    lector.onerror = () => reject(new Error("No se pudo leer el archivo."));
    lector.readAsDataURL(file);
  });
}

// Convierte un data URI ("data:application/pdf;base64,....") en un Blob para poder abrirlo
// con window.open() como blob: URL. Los navegadores modernos bloquean la navegación directa
// a una data: URL en una pestaña nueva, así que la previsualización necesita este paso.
function dataUrlABlob(dataUrl: string): Blob {
  const [encabezado, base64] = dataUrl.split(",");
  const tipoMime = /data:(.*?);base64/.exec(encabezado)?.[1] || "application/pdf";
  const binario = atob(base64 || "");
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipoMime });
}

// ---------- PDF de una revisión (misma identidad visual que el documento de Compras: logo +
// "TRANSPORTES LOGISTICAR" + folio, sin jsPDF — ventana nueva con HTML + @media print + window.print(),
// igual que el resto de documentos completos del sistema, p. ej. Check List Diario de Unidades). ----------
function folioRevision(rev: Revision) {
  return `REV-${rev.eco}-${diaLocal(rev.fecha).replace(/-/g, "")}-${rev.id}`;
}

function descargarPdfRevision(revision: Revision, unidad: string, tipoLlantas: TipoNeumaticos | null) {
  const ventana = window.open("", "_blank", "width=900,height=700");
  if (!ventana) {
    alert("El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes para este sitio.");
    return;
  }
  const { ok, total } = contarCumplidos(revision.resultados);
  const fallas = total - ok;
  const fecha = formatoFecha(revision.fecha);
  const hora = formatoHora(revision.fecha);
  const folio = folioRevision(revision);

  const bloquesHtml = CHECKLIST_TODOS.map((bloque) => {
    const filas = bloque.items
      .map((item) => {
        const v = revision.resultados?.[bloque.titulo]?.[item];
        const estado = v === undefined ? '<span class="vacio">—</span>' : v ? '<span class="ok">OK</span>' : '<span class="malo">FALLA</span>';
        return `<tr><td>${escaparHtml(item)}</td><td class="col-estado">${estado}</td></tr>`;
      })
      .join("");
    return `<div class="bloque"><table><thead><tr><th colspan="2">${escaparHtml(bloque.titulo)}</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }).join("");

  const llantasHtml = Object.entries(revision.neumaticos || {})
    .map(([posicion, valor]) => {
      const llanta = leerLlanta(valor);
      if (!llanta.folio && llanta.mm == null) return "";
      const estado = llanta.mm != null && llanta.mm > 0 && tipoLlantas ? semaforoMM(llanta.mm, tipoLlantas.mm) : null;
      const clase = estado ? `llanta-${estado}` : "";
      return `<span class="llanta ${clase}"><b>${escaparHtml(posicion)}</b>${llanta.folio ? ` · Folio ${escaparHtml(llanta.folio)}` : ""}${
        llanta.mm != null ? ` · ${escaparHtml(formatoMM(llanta.mm))}` : ""
      }</span>`;
    })
    .filter(Boolean)
    .join("");

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Revisión ${escaparHtml(folio)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; margin: 0; background: #f4f5f8; color: #1c1c1c; }
  .hoja { max-width: 820px; margin: 24px auto; background: #fff; padding: 32px 40px; }
  .cab { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #e5e8ee; padding-bottom: 18px; gap: 12px; }
  .cab .marca { display: flex; align-items: center; gap: 10px; }
  .cab .marca img { width: 38px; height: 38px; object-fit: contain; }
  .cab .marca span { font-size: 17px; font-weight: bold; color: #16215c; text-transform: uppercase; letter-spacing: 0.03em; }
  .cab .folio { text-align: right; }
  .cab .folio p { margin: 0; }
  .cab .folio .fecha { color: #2f6fed; font-size: 13px; font-weight: 500; }
  .cab .folio .num { font-size: 14px; font-weight: bold; color: #111; margin-top: 4px; }
  h1.titulo { text-align: center; font-size: 17px; text-transform: uppercase; letter-spacing: 0.06em; color: #16215c; margin: 22px 0; }
  .datos { border: 1px solid #e5e8ee; border-radius: 10px; overflow: hidden; margin-bottom: 20px; }
  .datos table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  .datos th { text-align: left; width: 45%; background: #fff; color: #16215c; text-transform: uppercase; font-size: 10.5px; font-weight: bold; padding: 8px 12px; vertical-align: top; }
  .datos td { padding: 8px 12px; }
  .datos tr:nth-child(even) { background: #f4f5f8; }
  .resultado { display: inline-block; border-radius: 6px; padding: 2px 8px; font-size: 11px; font-weight: bold; }
  .resultado.bien { background: #dcf5e8; color: #137a4a; }
  .resultado.mal { background: #fde4e0; color: #e2412c; }
  .bloques { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
  .bloque table { width: 100%; border-collapse: collapse; border: 1px solid #e5e8ee; border-radius: 8px; overflow: hidden; font-size: 11.5px; }
  .bloque th { background: #16215c; color: #fff; text-align: left; padding: 6px 10px; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.03em; }
  .bloque td { padding: 5px 10px; border-top: 1px solid #e5e8ee; }
  .bloque td.col-estado { text-align: right; width: 70px; }
  .bloque tr:nth-child(even) td { background: #f4f5f8; }
  .ok { color: #21a866; font-weight: bold; }
  .malo { color: #e2412c; font-weight: bold; }
  .vacio { color: #9aa1b0; }
  .seccion-titulo { font-size: 12.5px; font-weight: bold; color: #16215c; margin: 0 0 8px; text-transform: uppercase; letter-spacing: 0.03em; }
  .llantas { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 20px; }
  .llanta { display: inline-flex; gap: 5px; border: 2px solid #e5e8ee; border-radius: 6px; padding: 4px 9px; font-size: 11px; background: #fff; }
  .llanta-critico { border-color: #ff1a1a; }
  .llanta-rojo { border-color: #e2412c; }
  .llanta-amarillo { border-color: #f2b134; }
  .llanta-verde { border-color: #21a866; }
  .observaciones { font-size: 12.5px; margin-bottom: 28px; }
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
    <div class="folio">
      <p class="fecha">${escaparHtml(fecha)} · ${escaparHtml(hora)}</p>
      <p class="num">Folio: ${escaparHtml(folio)}</p>
    </div>
  </div>

  <h1 class="titulo">Checklist de Revisión de Unidad</h1>

  <div class="datos">
    <table>
      <tbody>
        <tr><th>ECO</th><td>${escaparHtml(revision.eco)}</td></tr>
        <tr><th>Unidad</th><td>${escaparHtml(unidad || "—")}</td></tr>
        <tr><th>Kilometraje</th><td>${revision.kilometraje != null ? `${Number(revision.kilometraje).toLocaleString("es-MX")} km` : "—"}</td></tr>
        <tr><th>Resultado</th><td><span class="resultado ${fallas === 0 ? "bien" : "mal"}">${ok}/${total} ${fallas === 0 ? "OK" : `· ${fallas} falla(s)`}</span></td></tr>
        <tr><th>Realizó</th><td>${escaparHtml(revision.realizado_por || "—")}</td></tr>
      </tbody>
    </table>
  </div>

  <div class="bloques">${bloquesHtml}</div>

  ${llantasHtml ? `<p class="seccion-titulo">Neumáticos</p><div class="llantas">${llantasHtml}</div>` : ""}

  ${revision.observaciones ? `<p class="observaciones"><b>Observaciones:</b> ${escaparHtml(revision.observaciones)}</p>` : ""}
</div>
<div class="barra"><button id="btnImprimir">Imprimir / Guardar PDF</button></div>
<script>document.getElementById("btnImprimir").addEventListener("click", function () { window.print(); });</script>
</body>
</html>`;
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

// ---------- Componentes pequeños ----------
function Toggle({ activo, onChange, etiqueta, deshabilitado }: { activo: boolean; onChange: () => void; etiqueta: string; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onChange}
      disabled={deshabilitado}
      className={`relative flex-none w-[32px] min-w-[32px] h-[18px] rounded-full transition-colors disabled:cursor-not-allowed ${activo ? "bg-[var(--green)]" : "bg-[var(--gray-400)]"}`}
    >
      <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-[left] ${activo ? "left-[16px]" : "left-[2px]"}`} />
    </button>
  );
}

function IconoUnidad({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 24 15" fill="none" stroke="#c3c8d4" strokeWidth="1.1">
      <rect x="1" y="1.5" width="14" height="10" rx="1" />
      <path d="M15 4.5h4l3 3v4h-7z" />
      <circle cx="5.5" cy="12.3" r="1.7" fill="#fff" />
      <circle cx="17.5" cy="12.3" r="1.7" fill="#fff" />
    </svg>
  );
}

export default function UnidadesPage() {
  const sesion = useSesion();
  const soloConsulta = sesion.rol === "supervisor_tms";
  const esAdmin = sesion.rol === "sysadmin" || sesion.rol === "personal";

  const [registros, setRegistros] = useState<RegistroUnidad[]>([]);
  const [conImagen, setConImagen] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null); // ECO seleccionado
  const [noDisponibles, setNoDisponibles] = useState<Set<string>>(new Set());
  const [cambiandoDisp, setCambiandoDisp] = useState(false);
  // Si se llegó desde el Calendario de viajes (?eco=X&desde=calendario): abre esa unidad y muestra el regreso.
  const ecoInicial = useRef<string | null>(null);
  const [desdeCalendario, setDesdeCalendario] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    ecoInicial.current = q.get("eco");
    setDesdeCalendario(q.get("desde") === "calendario");
    if (ecoInicial.current) setSeleccion(ecoInicial.current);
  }, []);

  // Cachés por ECO (undefined = aún no se consulta)
  const [imagenes, setImagenes] = useState<Record<string, string | null>>({});
  const [ultimas, setUltimas] = useState<Record<string, Revision | null>>({});
  const [documentos, setDocumentos] = useState<Record<string, Record<string, DocumentoMeta>>>({});

  // Documentos PDF: se guardan de inmediato al subirlos (no forman parte del "Guardar revisión").
  const [subiendoDoc, setSubiendoDoc] = useState<string | null>(null); // `${eco}::${tipo}` en curso
  const [descargandoDoc, setDescargandoDoc] = useState<string | null>(null);
  const inputDoc = useRef<HTMLInputElement>(null);
  const tipoDocPendiente = useRef<string>("");

  // Borrador del checklist por unidad: { [eco]: { [bloque::item]: boolean } }
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [kilometrajes, setKilometrajes] = useState<Record<string, string>>({}); // borrador por ECO
  const [extraAbierto, setExtraAbierto] = useState<string | null>(null); // título del checklist adicional abierto
  const [folios, setFolios] = useState<Record<string, Record<string, string>>>({}); // borrador de folios de llantas por ECO
  const [mms, setMms] = useState<Record<string, Record<string, string>>>({}); // borrador de MM de llantas por ECO

  // Ficha completa (modal)
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [modo, setModo] = useState<ModoFicha>("ver");
  const [valores, setValores] = useState<RegistroUnidad>({});
  const [fotoNueva, setFotoNueva] = useState<string | null | undefined>(undefined); // undefined = sin cambios
  const [guardando, setGuardando] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);
  const pedidos = useRef<Set<string>>(new Set()); // evita pedir dos veces la misma foto/revisión

  // Historial de revisiones (modal)
  const [histAbierto, setHistAbierto] = useState(false);
  const [histEco, setHistEco] = useState("");
  const [histDesde, setHistDesde] = useState("");
  const [histHasta, setHistHasta] = useState("");
  const [histRegistros, setHistRegistros] = useState<Revision[]>([]);
  const [histCargando, setHistCargando] = useState(false);
  const [histError, setHistError] = useState("");
  const [histExpandido, setHistExpandido] = useState<number | null>(null);
  const [histConsulta, setHistConsulta] = useState<{ eco: string; desde: string; hasta: string } | null>(null);

  // ---------- Carga de unidades ----------
  const aplicarLista = useCallback((datos: { registros: RegistroUnidad[]; conImagen: string[]; noDisponibles: string[] }) => {
    setRegistros(datos.registros);
    setConImagen(new Set(datos.conImagen));
    setNoDisponibles(new Set(datos.noDisponibles));
    setSeleccion((prev) => (prev && datos.registros.some((r) => r["ECO"] === prev) ? prev : datos.registros[0]?.["ECO"] ?? null));
  }, []);

  const cargar = useCallback(async () => {
    try {
      aplicarLista(await obtenerUnidades());
    } catch {
      setMensaje("No se pudieron cargar las unidades. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }, [aplicarLista]);

  useEffect(() => {
    obtenerUnidades()
      .then(aplicarLista)
      .catch(() => setMensaje("No se pudieron cargar las unidades. Revisa tu conexión."))
      .finally(() => setCargando(false));
  }, [aplicarLista]);

  // Foto y última revisión de la unidad seleccionada (solo se piden una vez por unidad)
  useEffect(() => {
    if (!seleccion) return;
    const eco = seleccion;
    if (imagenes[eco] === undefined && !pedidos.current.has(`img:${eco}`)) {
      pedidos.current.add(`img:${eco}`);
      const peticion = conImagen.has(eco) ? obtenerImagen(eco) : Promise.resolve(null);
      peticion
        .then((img) => setImagenes((prev) => ({ ...prev, [eco]: img })))
        .catch(() => setImagenes((prev) => ({ ...prev, [eco]: null })))
        .finally(() => pedidos.current.delete(`img:${eco}`));
    }
    if (ultimas[eco] === undefined && !pedidos.current.has(`rev:${eco}`)) {
      pedidos.current.add(`rev:${eco}`);
      obtenerRevisiones({ eco, limite: 1 })
        .then((lista) => setUltimas((prev) => ({ ...prev, [eco]: lista[0] || null })))
        .catch(() => setUltimas((prev) => ({ ...prev, [eco]: null })))
        .finally(() => pedidos.current.delete(`rev:${eco}`));
    }
    if (documentos[eco] === undefined && !pedidos.current.has(`doc:${eco}`)) {
      pedidos.current.add(`doc:${eco}`);
      obtenerDocumentos(eco)
        .then((docs) => setDocumentos((prev) => ({ ...prev, [eco]: docs })))
        .catch(() => setDocumentos((prev) => ({ ...prev, [eco]: {} })))
        .finally(() => pedidos.current.delete(`doc:${eco}`));
    }
  }, [seleccion, conImagen, imagenes, ultimas, documentos]);

  // Aviso temporal
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const cambiarDisponible = async (eco: string, disponible: boolean) => {
    if (!eco) return;
    setCambiandoDisp(true);
    try {
      const res = await fetch("/api/unidades/disponible", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eco, disponible }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "No se pudo actualizar.");
      setNoDisponibles((prev) => {
        const n = new Set(prev);
        if (disponible) n.delete(eco);
        else n.add(eco);
        return n;
      });
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo actualizar la disponibilidad.");
    } finally {
      setCambiandoDisp(false);
    }
  };

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((r) => `${r["ECO"] || ""} ${r["Unidad"] || ""}`.toLowerCase().includes(q));
  }, [registros, busqueda]);

  const nombrePorEco = useMemo(() => Object.fromEntries(registros.map((r) => [r["ECO"], r["Unidad"] || ""])), [registros]);

  const indiceActual = registros.findIndex((r) => r["ECO"] === seleccion);
  const actual = indiceActual >= 0 ? registros[indiceActual] : null;
  const ecoActual = actual?.["ECO"] || "";
  const imagenActual = ecoActual ? imagenes[ecoActual] : undefined;
  const ultimaActual = ecoActual ? ultimas[ecoActual] : undefined;
  const hayCambios =
    !!ecoActual &&
    (Object.keys(checks[ecoActual] || {}).length > 0 ||
      Object.keys(folios[ecoActual] || {}).length > 0 ||
      Object.keys(mms[ecoActual] || {}).length > 0 ||
      !!observaciones[ecoActual]?.trim() ||
      !!kilometrajes[ecoActual]?.trim());
  const tipoLlantas = tipoNeumaticos(actual);
  const tipoPorEco = useMemo(() => Object.fromEntries(registros.map((r) => [r["ECO"], tipoNeumaticos(r)])), [registros]);
  const bloqueExtra = CHECKLIST_EXTRA.find((b) => b.titulo === extraAbierto) || null;

  const mover = useCallback(
    (dir: 1 | -1) => {
      if (registros.length === 0) return;
      const base = indiceActual < 0 ? 0 : indiceActual;
      const siguiente = (base + dir + registros.length) % registros.length;
      setSeleccion(registros[siguiente]["ECO"]);
    },
    [registros, indiceActual]
  );

  // Navegación con flechas del teclado (solo sin modales abiertos)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fichaAbierta || histAbierto || extraAbierto) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mover, fichaAbierta, histAbierto, extraAbierto]);

  // ---------- Checklist rápido ----------
  // Valor mostrado: borrador > última revisión guardada > true
  const estaActivo = (eco: string, bloque: string, item: string) =>
    checks[eco]?.[clavePunto(bloque, item)] ?? ultimas[eco]?.resultados?.[bloque]?.[item] ?? true;

  // Folio mostrado: borrador > última revisión guardada > vacío
  const folioMostrado = (eco: string, posicion: string) =>
    folios[eco]?.[posicion] ?? leerLlanta(ultimas[eco]?.neumaticos?.[posicion]).folio ?? "";

  // MM mostrado: borrador > última revisión guardada > vacío
  const mmMostrado = (eco: string, posicion: string) => {
    if (mms[eco]?.[posicion] !== undefined) return mms[eco][posicion];
    const guardado = leerLlanta(ultimas[eco]?.neumaticos?.[posicion]).mm;
    return guardado != null ? String(guardado) : "";
  };

  const cambiarMM = (eco: string, posicion: string, valor: string, limites: LimitesMM, tipo: string) => {
    if (soloConsulta) return;
    const texto = valor.replace(",", ".").trim();
    if (!MM_RE.test(texto)) return; // solo números positivos con punto decimal
    if (texto !== "" && texto !== "." && Number(texto) > limites.max) {
      setAviso(`El valor máximo permitido para ${tipo} es ${limites.max} mm.`);
      return;
    }
    setMms((prev) => ({ ...prev, [eco]: { ...prev[eco], [posicion]: texto } }));
  };

  const cambiarFolio = (eco: string, posicion: string, valor: string) => {
    if (soloConsulta) return;
    setFolios((prev) => ({ ...prev, [eco]: { ...prev[eco], [posicion]: valor.slice(0, MAX_FOLIO) } }));
  };

  const alternar = (eco: string, bloque: string, item: string) => {
    if (soloConsulta) return;
    const actualValor = estaActivo(eco, bloque, item);
    setChecks((prev) => ({ ...prev, [eco]: { ...prev[eco], [clavePunto(bloque, item)]: !actualValor } }));
  };

  const descartarCambios = (eco: string) => {
    setChecks((prev) => {
      const copia = { ...prev };
      delete copia[eco];
      return copia;
    });
    setObservaciones((prev) => ({ ...prev, [eco]: "" }));
    setKilometrajes((prev) => ({ ...prev, [eco]: "" }));
    setFolios((prev) => {
      const copia = { ...prev };
      delete copia[eco];
      return copia;
    });
    setMms((prev) => {
      const copia = { ...prev };
      delete copia[eco];
      return copia;
    });
  };

  const guardarRevision = async () => {
    if (!ecoActual || soloConsulta) return;
    const kmTexto = (kilometrajes[ecoActual] || "").trim();
    const kilometraje = kmTexto === "" ? null : Number(kmTexto);
    if (kilometraje !== null && (!Number.isInteger(kilometraje) || kilometraje < 0)) {
      alert("El kilometraje debe ser un número entero no negativo.");
      return;
    }
    const resultados: Resultados = {};
    for (const bloque of CHECKLIST_TODOS) {
      resultados[bloque.titulo] = {};
      for (const item of bloque.items) resultados[bloque.titulo][item] = estaActivo(ecoActual, bloque.titulo, item);
    }
    let neumaticos: Record<string, Llanta> | null = null;
    if (tipoLlantas) {
      neumaticos = {};
      for (const posicion of tipoLlantas.posiciones) {
        const mmTexto = mmMostrado(ecoActual, posicion).trim();
        let mm: number | null = null;
        if (mmTexto !== "") {
          mm = Number(mmTexto);
          if (!Number.isFinite(mm) || mm <= 0) {
            alert(`El valor en MM de la llanta ${posicion} debe ser mayor a 0.`);
            return;
          }
          if (mm > tipoLlantas.mm.max) {
            alert(`El valor en MM de la llanta ${posicion} excede el máximo permitido (${tipoLlantas.mm.max} mm).`);
            return;
          }
        }
        neumaticos[posicion] = { folio: folioMostrado(ecoActual, posicion).trim(), mm };
      }
    }
    const { ok } = contarCumplidos(resultados);
    if (!confirm(`¿Guardar la revisión de ${ecoActual}? (${ok}/${TOTAL_PUNTOS} puntos en orden)`)) return;
    setGuardandoRevision(true);
    try {
      const data = await leerJson(
        await fetch("/api/unidades/revisiones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eco: ecoActual, resultados, observaciones: observaciones[ecoActual] || "", kilometraje, neumaticos }),
        })
      );
      const registro: Revision = data.registro;
      setUltimas((prev) => ({ ...prev, [ecoActual]: registro }));
      descartarCambios(ecoActual);
      if (histAbierto && histConsulta) setHistRegistros((prev) => [registro, ...prev]);
      setAviso(`Revisión de ${ecoActual} guardada.`);
    } catch (err) {
      alert(mensajeError(err, "No se pudo guardar la revisión."));
    } finally {
      setGuardandoRevision(false);
    }
  };

  // ---------- Documentos PDF de la unidad (independientes de "Guardar revisión") ----------
  const documentoMeta = (eco: string, tipo: string): DocumentoMeta | null => documentos[eco]?.[tipo] || null;

  const pedirArchivoDoc = (tipo: string) => {
    if (soloConsulta || !ecoActual) return;
    tipoDocPendiente.current = tipo;
    inputDoc.current?.click();
  };

  const manejarArchivoDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const tipo = tipoDocPendiente.current;
    if (!file || !ecoActual || !tipo) return;
    if (file.type !== "application/pdf") {
      alert("Selecciona un archivo PDF.");
      return;
    }
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      alert(`El PDF no debe superar ${MAX_PDF_MB} MB.`);
      return;
    }
    const eco = ecoActual;
    const clave = `${eco}::${tipo}`;
    setSubiendoDoc(clave);
    try {
      const contenido = await leerArchivoComoDataUrl(file);
      const documento = await subirDocumentoPdf(eco, tipo, file.name, contenido);
      setDocumentos((prev) => ({ ...prev, [eco]: { ...prev[eco], [tipo]: documento } }));
      const etiqueta = DOCUMENTOS_UNIDAD.find((d) => d.tipo === tipo)?.etiqueta || tipo;
      setAviso(`${etiqueta} actualizado(a) para ${eco}.`);
    } catch (err) {
      alert(mensajeError(err, "No se pudo subir el documento."));
    } finally {
      setSubiendoDoc(null);
    }
  };

  // Abre el PDF en una pestaña nueva para previsualizarlo (visor nativo del navegador), en vez
  // de forzar la descarga directa. Desde esa pestaña el usuario puede descargarlo o imprimirlo
  // con los controles propios del visor — el mismo patrón que el PDF de revisiones.
  const previsualizarDoc = async (tipo: string) => {
    if (!ecoActual) return;
    const eco = ecoActual;
    const clave = `${eco}::${tipo}`;
    setDescargandoDoc(clave);
    try {
      const { contenido } = await obtenerDocumentoPdf(eco, tipo);
      const url = URL.createObjectURL(dataUrlABlob(contenido));
      const ventana = window.open(url, "_blank");
      if (!ventana) {
        alert("El navegador bloqueó la ventana de previsualización. Habilita las ventanas emergentes para este sitio.");
      }
      // Se libera después de que la pestaña tuvo tiempo de cargar el PDF.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      alert(mensajeError(err, "No se pudo previsualizar el documento."));
    } finally {
      setDescargandoDoc(null);
    }
  };

  // ---------- Semáforo de llantas de la unidad actual ----------
  const evaluacionLlantas = tipoLlantas
    ? tipoLlantas.posiciones.map((posicion) => {
        const texto = mmMostrado(ecoActual, posicion);
        const mm = texto === "" || texto === "." ? NaN : Number(texto);
        const valido = Number.isFinite(mm) && mm > 0;
        return { posicion, mm: valido ? mm : null, estado: valido ? semaforoMM(mm, tipoLlantas.mm) : null };
      })
    : [];
  const llantasCriticas = evaluacionLlantas.filter((l) => l.estado === "critico");
  const llantasRojas = evaluacionLlantas.filter((l) => l.estado === "rojo");
  const llantasAmarillas = evaluacionLlantas.filter((l) => l.estado === "amarillo");
  const alertaCritica = llantasCriticas.length > 0;
  const listaLlantas = (lista: { posicion: string; mm: number | null }[]) =>
    lista.map((l) => `${l.posicion} (${l.mm != null ? formatoMM(l.mm) : "—"})`).join(" · ");

  // ---------- Historial ----------
  const consultarHistorial = async (filtros: { eco: string; desde: string; hasta: string }) => {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setHistError("La fecha 'Desde' no puede ser mayor que 'Hasta'.");
      return;
    }
    setHistCargando(true);
    setHistError("");
    setHistExpandido(null);
    try {
      setHistRegistros(await obtenerRevisiones({ ...filtros, limite: 500 }));
      setHistConsulta(filtros);
    } catch (err) {
      setHistError(mensajeError(err, "No se pudo consultar el historial."));
    } finally {
      setHistCargando(false);
    }
  };

  const abrirHistorial = (eco: string, dia: string) => {
    setHistEco(eco);
    setHistDesde(dia);
    setHistHasta(dia);
    setHistRegistros([]);
    setHistConsulta(null);
    setHistAbierto(true);
    consultarHistorial({ eco, desde: dia, hasta: dia });
  };

  const eliminarRevision = async (rev: Revision) => {
    if (!esAdmin) return;
    if (!confirm(`¿Eliminar la revisión de ${rev.eco} del ${formatoFecha(rev.fecha)} ${formatoHora(rev.fecha)}? Esta acción no se puede deshacer.`)) return;
    try {
      await leerJson(await fetch(`/api/unidades/revisiones?id=${rev.id}`, { method: "DELETE" }));
      setHistRegistros((prev) => prev.filter((r) => r.id !== rev.id));
      // Si era la última de la unidad, se vuelve a consultar
      if (ultimas[rev.eco]?.id === rev.id) {
        const lista = await obtenerRevisiones({ eco: rev.eco, limite: 1 });
        setUltimas((prev) => ({ ...prev, [rev.eco]: lista[0] || null }));
      }
      setAviso("Revisión eliminada.");
    } catch (err) {
      alert(mensajeError(err, "No se pudo eliminar la revisión."));
    }
  };

  // Resumen por día: qué unidades se revisaron y cuáles faltan (solo con un día y todas las unidades)
  const resumenDia = useMemo(() => {
    if (!histConsulta || histConsulta.eco || !histConsulta.desde || histConsulta.desde !== histConsulta.hasta) return null;
    const revisadas = new Set(histRegistros.map((r) => r.eco));
    return {
      dia: histConsulta.desde,
      revisadas: registros.filter((r) => revisadas.has(r["ECO"])).map((r) => r["ECO"]),
      pendientes: registros.filter((r) => !revisadas.has(r["ECO"])).map((r) => r["ECO"]),
    };
  }, [histConsulta, histRegistros, registros]);

  const exportarHistorial = () => {
    exportarExcel(`Revisiones_Unidades_${hoyLocal()}.xlsx`, [
      {
        nombre: "Revisiones",
        filas: histRegistros.map((r) => {
          const fila: Record<string, string> = {
            Fecha: formatoFecha(r.fecha),
            Hora: formatoHora(r.fecha),
            ECO: r.eco,
            Unidad: nombrePorEco[r.eco] || "",
            "Puntos en orden": `${contarCumplidos(r.resultados).ok}/${contarCumplidos(r.resultados).total}`,
            Kilometraje: r.kilometraje != null ? String(r.kilometraje) : "",
          };
          for (const bloque of CHECKLIST_TODOS) {
            for (const item of bloque.items) {
              const v = r.resultados?.[bloque.titulo]?.[item];
              fila[`${bloque.titulo} - ${item}`] = v === undefined ? "" : v ? "OK" : "FALLA";
            }
          }
          for (const posicion of POSICIONES_EXPORTAR) {
            const llanta = leerLlanta(r.neumaticos?.[posicion]);
            fila[`Folio llanta ${posicion}`] = llanta.folio || "";
            fila[`MM llanta ${posicion}`] = llanta.mm != null ? String(llanta.mm) : "";
          }
          fila["Observaciones"] = r.observaciones || "";
          fila["Realizó"] = r.realizado_por || "";
          return fila;
        }),
      },
    ]);
  };

  // ---------- Ficha completa ----------
  const abrirFicha = (registro: RegistroUnidad) => {
    setValores({ ...registro });
    setFotoNueva(undefined);
    setModo("ver");
    setFichaAbierta(true);
  };

  const abrirNueva = () => {
    setValores({});
    setFotoNueva(undefined);
    setModo("nuevo");
    setFichaAbierta(true);
  };

  const cerrarFicha = () => {
    if (guardando) return;
    setFichaAbierta(false);
  };

  const cancelarEdicion = () => {
    if (modo === "nuevo") {
      setFichaAbierta(false);
      return;
    }
    const original = registros.find((r) => r["ECO"] === valores["ECO"]);
    if (original) setValores({ ...original });
    setFotoNueva(undefined);
    setModo("ver");
  };

  const seleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Selecciona un archivo de imagen.");
      return;
    }
    setProcesandoFoto(true);
    try {
      setFotoNueva(await compressImage(file, 900, 0.7, 450000));
    } catch (err) {
      alert(mensajeError(err, "No se pudo procesar la imagen."));
    } finally {
      setProcesandoFoto(false);
    }
  };

  const guardar = async () => {
    if (!valores["ECO"]?.trim()) {
      alert("Captura al menos el campo ECO.");
      return;
    }
    if (modo === "nuevo" && registros.some((r) => r["ECO"]?.trim().toLowerCase() === valores["ECO"].trim().toLowerCase())) {
      alert(`La unidad ${valores["ECO"]} ya existe. Selecciónala en la lista para editarla.`);
      return;
    }
    setGuardando(true);
    try {
      const eco = valores["ECO"].trim();
      const datos: RegistroUnidad = { ...valores, ECO: eco };
      delete datos["imagen"];
      // La foto solo se envía si cambió (si no se envía, el backend conserva la actual)
      const payload = fotoNueva !== undefined ? { ...datos, imagen: fotoNueva || "" } : datos;
      await leerJson(
        await fetch("/api/unidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      if (fotoNueva !== undefined) setImagenes((prev) => ({ ...prev, [eco]: fotoNueva || null }));
      setSeleccion(eco);
      await cargar();
      setValores(datos);
      setFotoNueva(undefined);
      setModo("ver");
      setAviso(`Unidad ${eco} guardada.`);
    } catch (err) {
      alert(mensajeError(err, "Error al guardar la unidad."));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (eco: string) => {
    if (!confirm(`¿Eliminar la unidad ${eco}? Esta acción no se puede deshacer.`)) return;
    try {
      await leerJson(
        await fetch("/api/unidades/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eco }),
        })
      );
      setFichaAbierta(false);
      setSeleccion(null);
      setImagenes((prev) => {
        const copia = { ...prev };
        delete copia[eco];
        return copia;
      });
      await cargar();
    } catch (err) {
      alert(mensajeError(err, "Error al eliminar la unidad."));
    }
  };

  const exportar = () => {
    exportarExcel(`Unidades_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      {
        nombre: "Unidades",
        filas: registros.map((r) => Object.fromEntries([...CAMPOS_UNIDAD, ...CAMPOS_MEDIDA_SPRINTER].map((c) => [c, r[c] || ""]))),
      },
    ]);
  };

  const enEdicion = modo === "editar" || modo === "nuevo";
  const ecoFicha = valores["ECO"] || "";
  const fotoFicha = fotoNueva !== undefined ? fotoNueva : modo === "nuevo" ? null : imagenes[ecoFicha];
  const camposActuales = camposFicha(valores);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <style>{CSS_ALERTA}</style>
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 pb-10">
        <PageHeader
          titulo="Unidades"
          subtitulo="Administra y consulta la información de las unidades."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
          extra={
            desdeCalendario ? (
              <Link href="/control-viajes/calendario" className="text-[13px] sm:text-[13.5px] font-medium text-[var(--blue)] underline underline-offset-[3px] hover:text-[var(--navy)] flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                Calendario de viajes
              </Link>
            ) : undefined
          }
        />

        {mensaje && <p className="text-[12.5px] text-[var(--red)] mb-3">{mensaje}</p>}
        {aviso && (
          <div className="fixed bottom-5 right-5 z-[60] bg-[var(--navy)] text-white text-[12.5px] font-semibold rounded-lg px-4 py-2.5 shadow-lg" role="status">
            {aviso}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5 items-start">
          {/* ===================== MENÚ LATERAL (25%) ===================== */}
          <aside className="lg:col-span-1 bg-white rounded-[18px] p-4 shadow-[0_1px_3px_rgba(22,33,92,0.06)] lg:sticky lg:top-24">
            <div className="flex flex-wrap gap-2 mb-3">
              {!soloConsulta && (
                <button
                  type="button"
                  onClick={abrirNueva}
                  className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  Agregar / Editar
                </button>
              )}
              <button
                type="button"
                onClick={() => abrirHistorial("", hoyLocal())}
                className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[var(--gray-100)]"
                title="Revisiones realizadas por día"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
                Revisiones por día
              </button>
              <Link
                href="/unidades/revisiones-aceite"
                className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[var(--gray-100)]"
                title="Control de cambios de aceite por unidad"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2c3 4 6 7.5 6 11a6 6 0 1 1-12 0c0-3.5 3-7 6-11Z" /></svg>
                Revisiones de Aceite
              </Link>
            </div>

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ECO o unidad..."
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] mb-3"
            />

            <div className="bg-[var(--navy)] text-white text-[12px] font-bold uppercase tracking-wide rounded-t-md px-3 py-2.5 grid grid-cols-[70px_1fr]">
              <span>ECO</span>
              <span>Unidad</span>
            </div>

            <div className="max-h-[260px] lg:max-h-[calc(100vh-300px)] overflow-y-auto">
              {cargando ? (
                <p className="text-center text-[var(--gray-400)] text-[12.5px] py-6">Cargando unidades...</p>
              ) : filtrados.length === 0 ? (
                <p className="text-center text-[var(--gray-400)] text-[12.5px] py-6">
                  {registros.length === 0 ? "Aún no hay unidades registradas." : "Sin coincidencias."}
                </p>
              ) : (
                filtrados.map((r) => {
                  const activo = r["ECO"] === seleccion;
                  return (
                    <button
                      type="button"
                      key={r["ECO"]}
                      onClick={() => setSeleccion(r["ECO"])}
                      onDoubleClick={() => abrirFicha(r)}
                      title="Clic: ver unidad · Doble clic: ficha completa"
                      className={`w-full text-left grid grid-cols-[70px_1fr] items-center px-3 py-2.5 text-[12px] border-b border-[var(--gray-200)] transition-colors ${
                        activo ? "bg-[#a9aec6] text-[var(--navy)] font-semibold rounded-md" : "hover:bg-[var(--gray-100)]"
                      }`}
                    >
                      <span>{r["ECO"]}</span>
                      <span className="truncate">{r["Unidad"] || "—"}</span>
                    </button>
                  );
                })
              )}
            </div>

            {!cargando && registros.length > 0 && (
              <button type="button" onClick={exportar} className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Exportar Excel
              </button>
            )}
          </aside>

          {/* ===================== PANEL PRINCIPAL (75%) ===================== */}
          <section
            className={`lg:col-span-3 bg-white rounded-[18px] p-4 sm:p-5 md:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] ${
              actual && alertaCritica ? "border-[3px] border-[#ff1a1a] llantas-alerta-critica" : "border-2 border-[#8b5cf6]/70"
            }`}
          >
            {!actual ? (
              <div className="flex flex-col items-center justify-center text-center py-20 text-[var(--gray-400)] text-[13.5px]">
                <IconoUnidad size={140} />
                <p className="mt-4">{cargando ? "Cargando..." : "Selecciona una unidad del menú lateral."}</p>
              </div>
            ) : (
              <>
                {/* Encabezado */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-[#d9d9d9] text-[#3a3a3a] font-display font-bold text-[26px] sm:text-[30px] rounded-md px-4 py-1 leading-tight">
                      {ecoActual}
                    </span>
                    <span className="hidden sm:block text-[13px] text-[var(--gray-400)]">{actual["Unidad"] || ""}</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={!noDisponibles.has(ecoActual)}
                      disabled={soloConsulta || cambiandoDisp}
                      onClick={() => cambiarDisponible(ecoActual, noDisponibles.has(ecoActual))}
                      title={soloConsulta ? "Solo consulta" : "Cambiar disponibilidad"}
                      className={`inline-flex items-center gap-2 rounded-full pl-1 pr-3 py-1 text-[12px] font-bold text-white transition-colors disabled:opacity-70 ${noDisponibles.has(ecoActual) ? "bg-[var(--red)]" : "bg-[var(--green)]"}`}
                    >
                      <span className="w-5 h-5 rounded-full bg-white shadow" />
                      {noDisponibles.has(ecoActual) ? "No disponible" : "Disponible"}
                    </button>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[11.5px] text-[var(--text)] text-right">
                      Fecha de última revisión - Checklist&nbsp;&nbsp;
                      <b>
                        {ultimaActual === undefined
                          ? "..."
                          : ultimaActual
                          ? `${formatoFecha(ultimaActual.fecha)} ${formatoHora(ultimaActual.fecha)}`
                          : "Sin revisiones"}
                      </b>
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => abrirHistorial(ecoActual, "")}
                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3 py-1.5 hover:bg-[var(--gray-100)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        Historial
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirFicha(actual)}
                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--blue)] border border-[var(--blue)] rounded-lg px-3 py-1.5 hover:bg-[var(--blue-light)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M3 12h18M3 19h18" /></svg>
                        Ver ficha completa
                      </button>
                    </div>
                  </div>
                </div>

                {/* Avisos de llantas (semáforo en rojo o amarillo) */}
                {tipoLlantas && (alertaCritica || llantasRojas.length > 0 || llantasAmarillas.length > 0) && (
                  <div className="flex flex-col gap-1.5 mt-3" role="alert">
                    {alertaCritica && (
                      <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-bold bg-[#ff1a1a] text-white">
                        <span className="mt-[1px] flex-none"><IconoAviso /></span>
                        <span>
                          ALERTA CRÍTICA: llanta(s) por debajo del mínimo permitido ({tipoLlantas.mm.rojo} mm) · {listaLlantas(llantasCriticas)}
                        </span>
                      </div>
                    )}
                    {llantasRojas.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold bg-[#fde4e0] text-[var(--red)] border border-[var(--red)]">
                        <span className="mt-[1px] flex-none"><IconoAviso /></span>
                        <span>
                          Llantas en rojo ({tipoLlantas.mm.rojo}–{tipoLlantas.mm.amarillo} mm), programar cambio · {listaLlantas(llantasRojas)}
                        </span>
                      </div>
                    )}
                    {llantasAmarillas.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold bg-[#fdf1d6] text-[#9a6a00] border border-[var(--amber)]">
                        <span className="mt-[1px] flex-none"><IconoAviso /></span>
                        <span>
                          Llantas en amarillo ({tipoLlantas.mm.amarillo}–{tipoLlantas.mm.verde} mm), dar seguimiento · {listaLlantas(llantasAmarillas)}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Imagen + navegación */}
                <div className="relative flex items-center justify-center h-[220px] sm:h-[260px] md:h-[300px] my-2">
                  <button
                    type="button"
                    onClick={() => mover(-1)}
                    aria-label="Unidad anterior"
                    className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 p-2 text-[#c3c3c3] hover:text-[var(--navy)]"
                  >
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
                  </button>

                  <button type="button" onClick={() => abrirFicha(actual)} className="h-full max-w-[75%] flex items-center justify-center" title="Ver ficha completa">
                    {imagenActual ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagenActual} alt={`Unidad ${ecoActual}`} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-[var(--gray-400)] text-[12.5px] gap-2">
                        <IconoUnidad size={170} />
                        <span>
                          {imagenActual === undefined ? "Cargando fotografía..." : soloConsulta ? "Sin fotografía" : "Sin fotografía · clic para agregarla"}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => mover(1)}
                    aria-label="Unidad siguiente"
                    className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 p-2 text-[#c3c3c3] hover:text-[var(--navy)]"
                  >
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Documentos PDF de la unidad (independientes del checklist: se conservan hasta reemplazarse) */}
                <input ref={inputDoc} type="file" accept="application/pdf" className="hidden" onChange={manejarArchivoDoc} />
                <div className="flex flex-wrap items-start justify-center gap-6 sm:gap-8 mb-4">
                  {DOCUMENTOS_UNIDAD.map((doc) => {
                    const cargandoDocs = documentos[ecoActual] === undefined;
                    const meta = documentoMeta(ecoActual, doc.tipo);
                    const clave = `${ecoActual}::${doc.tipo}`;
                    const subiendo = subiendoDoc === clave;
                    const descargando = descargandoDoc === clave;
                    const existe = !!meta;
                    return (
                      <div key={doc.tipo} className="flex flex-col items-center gap-1 w-[110px]">
                        <button
                          type="button"
                          onClick={() => (existe ? previsualizarDoc(doc.tipo) : pedirArchivoDoc(doc.tipo))}
                          disabled={subiendo || descargando || cargandoDocs}
                          title={existe ? `Ver ${doc.etiqueta}` : soloConsulta ? "Sin archivo" : `Subir ${doc.etiqueta}`}
                          className="relative flex items-center justify-center w-11 h-11 rounded-lg bg-[var(--red)] text-white disabled:opacity-60"
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M12 11v6M9.5 14.5 12 17l2.5-2.5" /></svg>
                          {!existe && !soloConsulta && (
                            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-[var(--navy)] flex items-center justify-center text-[10px] leading-none">+</span>
                          )}
                        </button>
                        <span className="text-[11px] font-semibold text-[var(--navy)] text-center leading-tight">{doc.etiqueta}</span>
                        <span className="text-[9.5px] text-[var(--gray-400)] text-center leading-tight">
                          {subiendo
                            ? "Subiendo..."
                            : cargandoDocs
                            ? "Cargando..."
                            : existe
                            ? `${formatoFecha(meta!.fecha_carga)}${meta!.cargado_por ? ` · ${meta!.cargado_por}` : ""}`
                            : "Sin archivo"}
                        </span>
                        {existe && !soloConsulta && (
                          <button type="button" onClick={() => pedirArchivoDoc(doc.tipo)} disabled={subiendo} className="text-[9.5px] font-bold text-[var(--blue)] hover:underline">
                            Reemplazar
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Kilometraje + checklists adicionales */}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                  <div className="w-full sm:w-auto">
                    <label htmlFor="kilometraje-actual" className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">
                      Kilometraje actual
                    </label>
                    <div className="flex items-center border border-[var(--gray-200)] rounded-lg overflow-hidden bg-white w-full sm:w-[240px]">
                      <input
                        id="kilometraje-actual"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={kilometrajes[ecoActual] || ""}
                        onChange={(e) => setKilometrajes((prev) => ({ ...prev, [ecoActual]: e.target.value }))}
                        disabled={soloConsulta}
                        placeholder={ultimaActual?.kilometraje != null ? `Último: ${ultimaActual.kilometraje.toLocaleString("es-MX")}` : "Ej. 125000"}
                        className="flex-1 min-w-0 px-3 py-2 text-[12.5px] outline-none disabled:bg-[var(--gray-100)]"
                      />
                      <span className="px-3 py-2 text-[11.5px] font-bold text-[var(--gray-400)] bg-[var(--gray-100)] border-l border-[var(--gray-200)]">km</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {CHECKLIST_EXTRA.map((bloque) => {
                      const fallas = bloque.items.filter((item) => !estaActivo(ecoActual, bloque.titulo, item)).length;
                      return (
                        <button
                          key={bloque.titulo}
                          type="button"
                          onClick={() => setExtraAbierto(bloque.titulo)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--navy)] bg-white border border-[var(--gray-200)] rounded-lg px-3.5 py-2 hover:bg-[var(--gray-100)]"
                        >
                          {bloque.titulo}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${
                              fallas === 0 ? "bg-[#dcf5e8] text-[#137a4a]" : "bg-[#fde4e0] text-[var(--red)]"
                            }`}
                          >
                            {bloque.items.length - fallas}/{bloque.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-stretch">
                  {/* Neumáticos (primero): posiciones según el tipo de unidad, con folio y MM por llanta */}
                  <div className="bg-[#d9d9d9] rounded-lg p-2.5 flex flex-col min-w-0 md:col-span-2 xl:col-span-4">
                    <h4 className="text-center text-[14px] font-semibold text-[#333] m-0">
                      Neumáticos{tipoLlantas ? ` · ${tipoLlantas.tipo}` : ""}
                    </h4>
                    <p className="text-[10px] leading-snug text-[#444] mt-0.5 mb-0">
                      -{" "}
                      {tipoLlantas
                        ? `Captura el folio y los MM de cada llanta (P1 a P${tipoLlantas.posiciones.length - 1} + PR refacción). Máximo ${tipoLlantas.mm.max} mm.`
                        : "No se identificó el tipo de unidad (Transporter, Sprinter, Delivery o Torthon) para asignar posiciones de llantas."}
                    </p>
                    {tipoLlantas && (
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-[#444]">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--red)]" /> {tipoLlantas.mm.rojo}–{tipoLlantas.mm.amarillo} mm
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--amber)]" /> {tipoLlantas.mm.amarillo}–{tipoLlantas.mm.verde} mm
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[var(--green)]" /> {tipoLlantas.mm.verde} mm o más
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-sm bg-[#ff1a1a]" /> Menos de {tipoLlantas.mm.rojo} mm: crítico
                        </span>
                        {ultimaActual && (
                          <span className="ml-auto text-[#666]">
                            Última revisión: {formatoFecha(ultimaActual.fecha)} {formatoHora(ultimaActual.fecha)}
                          </span>
                        )}
                      </div>
                    )}
                    {tipoLlantas && (
                      <div className="grid gap-1.5 mt-2 auto-rows-fr grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {tipoLlantas.posiciones.map((posicion) => {
                          const estado = evaluacionLlantas.find((l) => l.posicion === posicion)?.estado ?? null;
                          const mmTexto = mmMostrado(ecoActual, posicion);
                          const mmInvalido = mmTexto !== "" && !(Number(mmTexto) > 0);
                          return (
                            <div
                              key={posicion}
                              className={`bg-[#f2f2f2] rounded-lg pl-2 pr-1.5 py-1.5 min-h-[40px] flex flex-col gap-1 border-[5px] transition-colors ${
                                estado ? ESTILO_SEMAFORO[estado].borde : mmInvalido ? "border-[var(--red)]" : "border-transparent"
                              }`}
                              title={estado ? `Semáforo: ${ESTILO_SEMAFORO[estado].etiqueta}` : undefined}
                            >
                              <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-1.5">
                                <label
                                  htmlFor={`folio-llanta-${posicion}`}
                                  title={posicion === "PR" ? "Llanta de refacción" : `Posición ${posicion}`}
                                  className="text-[10.5px] font-semibold leading-tight text-[#222]"
                                >
                                  {posicion}
                                </label>
                                <input
                                  id={`folio-llanta-${posicion}`}
                                  type="text"
                                  value={folioMostrado(ecoActual, posicion)}
                                  onChange={(e) => cambiarFolio(ecoActual, posicion, e.target.value)}
                                  disabled={soloConsulta}
                                  maxLength={MAX_FOLIO}
                                  placeholder="Folio"
                                  aria-label={`Folio de llanta ${posicion === "PR" ? "de refacción" : posicion}`}
                                  className="w-full min-w-0 bg-white border border-[var(--gray-200)] rounded px-2 py-1 text-[11px] outline-none focus:border-[var(--blue)] disabled:bg-[var(--gray-100)]"
                                />
                              </div>
                              <div className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-1.5">
                                <label htmlFor={`mm-llanta-${posicion}`} className="text-[9.5px] font-semibold leading-tight text-[#555]">
                                  MM
                                </label>
                                <div className="flex items-center min-w-0 bg-white border border-[var(--gray-200)] rounded overflow-hidden focus-within:border-[var(--blue)]">
                                  <input
                                    id={`mm-llanta-${posicion}`}
                                    type="text"
                                    inputMode="decimal"
                                    value={mmTexto}
                                    onChange={(e) => cambiarMM(ecoActual, posicion, e.target.value, tipoLlantas.mm, tipoLlantas.tipo)}
                                    disabled={soloConsulta}
                                    placeholder={`Máx. ${tipoLlantas.mm.max}`}
                                    aria-label={`MM de llanta ${posicion === "PR" ? "de refacción" : posicion}`}
                                    aria-invalid={mmInvalido}
                                    className="flex-1 w-full min-w-0 px-2 py-1 text-[11px] outline-none disabled:bg-[var(--gray-100)]"
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {CHECKLIST.map((bloque) => {
                    const dosColumnas = bloque.items.length > 4;
                    return (
                      <div key={bloque.titulo} className="bg-[#d9d9d9] rounded-lg p-2.5 flex flex-col min-w-0">
                        <h4 className="text-center text-[14px] font-semibold text-[#333] m-0">{bloque.titulo}</h4>
                        {bloque.nota && <p className="text-[10px] leading-snug text-[#444] mt-0.5 mb-0">- {bloque.nota}</p>}
                        <div className={`grid gap-1.5 mt-2 auto-rows-fr ${dosColumnas ? "grid-cols-2" : "grid-cols-1"}`}>
                          {bloque.items.map((item) => (
                            <div
                              key={item}
                              className="bg-[#f2f2f2] rounded-md pl-2 pr-1.5 py-1.5 min-h-[40px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5"
                            >
                              <span lang="es" className="min-w-0 text-[10.5px] leading-tight text-[#222] break-words hyphens-auto">
                                {item}
                              </span>
                              <Toggle
                                activo={estaActivo(ecoActual, bloque.titulo, item)}
                                onChange={() => alternar(ecoActual, bloque.titulo, item)}
                                etiqueta={`${bloque.titulo}: ${item}`}
                                deshabilitado={soloConsulta}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Guardar revisión */}
                {soloConsulta ? (
                  <p className="text-[10.5px] text-[var(--gray-400)] mt-2 mb-0">* Se muestra la última revisión guardada. Tu usuario es de solo consulta.</p>
                ) : (
                  <div className="mt-3 flex flex-col md:flex-row md:items-end gap-2.5">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Observaciones (opcional)</label>
                      <textarea
                        value={observaciones[ecoActual] || ""}
                        onChange={(e) => setObservaciones((prev) => ({ ...prev, [ecoActual]: e.target.value }))}
                        maxLength={2000}
                        rows={1}
                        placeholder="Ej. Falla en luz intermitente derecha..."
                        className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] resize-y"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      {hayCambios && (
                        <button
                          type="button"
                          onClick={() => descartarCambios(ecoActual)}
                          disabled={guardandoRevision}
                          className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold"
                        >
                          Descartar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={guardarRevision}
                        disabled={guardandoRevision || ultimaActual === undefined}
                        className="bg-[var(--green)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[12.5px] font-bold whitespace-nowrap"
                      >
                        {guardandoRevision ? "Guardando..." : "Guardar revisión"}
                      </button>
                    </div>
                  </div>
                )}
                {!soloConsulta && (
                  <p className="text-[10.5px] text-[var(--gray-400)] mt-2 mb-0">
                    * Los interruptores muestran la última revisión guardada. {hayCambios ? "Tienes cambios sin guardar." : ""}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* ===================== FICHA COMPLETA (MODAL) ===================== */}
      {fichaAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50" onClick={cerrarFicha}>
          <div
            className="bg-white rounded-2xl w-[980px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0">
                  {modo === "nuevo" ? "Agregar unidad" : `${ecoFicha} · ${valores["Unidad"] || "Sin nombre"}`}
                </h3>
                <p className="text-[12px] text-[var(--gray-400)] m-0">
                  {modo === "ver" ? "Ficha completa de la unidad" : modo === "editar" ? "Editando información de la unidad" : "Captura la información de la nueva unidad"}
                </p>
              </div>
              <button type="button" onClick={cerrarFicha} aria-label="Cerrar" className="text-[var(--gray-400)] hover:text-[var(--navy)] p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
              {/* Fotografía */}
              <div>
                <div className="bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-xl h-[200px] flex items-center justify-center overflow-hidden">
                  {fotoFicha ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoFicha} alt="Fotografía de la unidad" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-[var(--gray-400)] text-[12px] gap-2">
                      <IconoUnidad size={120} />
                      {fotoFicha === undefined ? "Cargando fotografía..." : "Sin fotografía"}
                    </div>
                  )}
                </div>
                {enEdicion && (
                  <div className="flex gap-2 mt-2.5">
                    <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={seleccionarFoto} />
                    <button
                      type="button"
                      onClick={() => inputFoto.current?.click()}
                      disabled={procesandoFoto}
                      className="flex-1 bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-3 py-2 text-[12px] font-bold disabled:opacity-60"
                    >
                      {procesandoFoto ? "Procesando..." : fotoFicha ? "Cambiar foto" : "Agregar foto"}
                    </button>
                    {fotoFicha && (
                      <button
                        type="button"
                        onClick={() => setFotoNueva(null)}
                        className="bg-white text-[var(--red)] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12px] font-bold"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
                {enEdicion && <p className="text-[10.5px] text-[var(--gray-400)] mt-1.5 mb-0">La imagen se comprime automáticamente (JPEG, máx. 900 px).</p>}
              </div>

              {/* Datos */}
              {enEdicion ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                  {camposActuales.map((campo) => (
                    <div key={campo}>
                      <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">{campo}</label>
                      <input
                        disabled={modo === "editar" && campo === "ECO"}
                        value={valores[campo] || ""}
                        onChange={(e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }))}
                        className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] disabled:bg-[var(--gray-100)]"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-[var(--gray-200)] rounded-xl overflow-hidden">
                  <table className="w-full border-collapse">
                    <tbody>
                      {camposActuales.map((campo, i) => (
                        <tr key={campo} className={i % 2 === 0 ? "bg-white" : "bg-[var(--gray-100)]"}>
                          <th className="text-left text-[11px] uppercase tracking-wide text-[var(--navy)] font-bold px-3 py-2 w-[45%] align-top">{campo}</th>
                          <td className="px-3 py-2 text-[12.5px] break-words">{valores[campo] || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-2.5 justify-end mt-6">
              {modo === "ver" ? (
                <>
                  {!soloConsulta && (
                    <button
                      type="button"
                      onClick={() => eliminar(ecoFicha)}
                      className="mr-auto bg-white text-[var(--red)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold"
                    >
                      Eliminar
                    </button>
                  )}
                  <button type="button" onClick={cerrarFicha} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                    Cerrar
                  </button>
                  {!soloConsulta && (
                    <button type="button" onClick={() => setModo("editar")} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                      Editar unidad
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button type="button" onClick={cancelarEdicion} disabled={guardando} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando || procesandoFoto}
                    className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
                  >
                    {guardando ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== CHECKLIST ADICIONAL (MODAL) ===================== */}
      {bloqueExtra && actual && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50" onClick={() => setExtraAbierto(null)}>
          <div
            className="bg-white rounded-2xl w-[980px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0">
                  {ecoActual} · {actual["Unidad"] || "Sin nombre"}
                </h3>
                <p className="text-[12px] text-[var(--gray-400)] m-0">Checklist de {bloqueExtra.titulo.toLowerCase()}</p>
              </div>
              <button type="button" onClick={() => setExtraAbierto(null)} aria-label="Cerrar" className="text-[var(--gray-400)] hover:text-[var(--navy)] p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="bg-[#d9d9d9] rounded-lg p-2.5 flex flex-col min-w-0">
              <h4 className="text-center text-[14px] font-semibold text-[#333] m-0">{bloqueExtra.titulo}</h4>
              {bloqueExtra.nota && <p className="text-[10px] leading-snug text-[#444] mt-0.5 mb-0">- {bloqueExtra.nota}</p>}
              <div className="grid gap-1.5 mt-2 auto-rows-fr grid-cols-2">
                {bloqueExtra.items.map((item) => (
                  <div key={item} className="bg-[#f2f2f2] rounded-md pl-2 pr-1.5 py-1.5 min-h-[40px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                    <span lang="es" className="min-w-0 text-[10.5px] leading-tight text-[#222] break-words hyphens-auto">
                      {item}
                    </span>
                    <Toggle
                      activo={estaActivo(ecoActual, bloqueExtra.titulo, item)}
                      onChange={() => alternar(ecoActual, bloqueExtra.titulo, item)}
                      etiqueta={`${bloqueExtra.titulo}: ${item}`}
                      deshabilitado={soloConsulta}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10.5px] text-[var(--gray-400)] mt-2 mb-0">
              {soloConsulta
                ? "* Se muestra la última revisión guardada. Tu usuario es de solo consulta."
                : "* Los cambios se guardan junto con la revisión al presionar \"Guardar revisión\"."}
            </p>

            <div className="flex flex-wrap gap-2.5 justify-end mt-6">
              <button type="button" onClick={() => setExtraAbierto(null)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== HISTORIAL DE REVISIONES (MODAL) ===================== */}
      {histAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50" onClick={() => setHistAbierto(false)}>
          <div
            className="bg-white rounded-2xl w-[1100px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0">Historial de revisiones</h3>
                <p className="text-[12px] text-[var(--gray-400)] m-0">Consulta los checklists rápidos por unidad y por día.</p>
              </div>
              <button type="button" onClick={() => setHistAbierto(false)} aria-label="Cerrar" className="text-[var(--gray-400)] hover:text-[var(--navy)] p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* Filtros */}
            <form
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] gap-2.5 items-end mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                consultarHistorial({ eco: histEco, desde: histDesde, hasta: histHasta });
              }}
            >
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Unidad</label>
                <select value={histEco} onChange={(e) => setHistEco(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] bg-white">
                  <option value="">Todas las unidades</option>
                  {registros.map((r) => (
                    <option key={r["ECO"]} value={r["ECO"]}>
                      {r["ECO"]} · {r["Unidad"] || ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Desde</label>
                <input type="date" value={histDesde} onChange={(e) => setHistDesde(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Hasta</label>
                <input type="date" value={histHasta} onChange={(e) => setHistHasta(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const hoy = hoyLocal();
                    setHistDesde(hoy);
                    setHistHasta(hoy);
                    consultarHistorial({ eco: histEco, desde: hoy, hasta: hoy });
                  }}
                  className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] font-bold"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistDesde("");
                    setHistHasta("");
                    consultarHistorial({ eco: histEco, desde: "", hasta: "" });
                  }}
                  className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] font-bold"
                >
                  Todas las fechas
                </button>
                <button type="submit" disabled={histCargando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
                  Buscar
                </button>
              </div>
            </form>

            {histError && <p className="text-[12.5px] text-[var(--red)] mb-3">{histError}</p>}

            {/* Resumen del día */}
            {resumenDia && !histCargando && (
              <div className="bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-xl p-3 mb-4">
                <p className="text-[12.5px] text-[var(--navy)] font-bold m-0 mb-2">
                  {formatoDia(resumenDia.dia)}: {resumenDia.revisadas.length} de {registros.length} unidades revisadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resumenDia.revisadas.map((eco) => (
                    <span key={eco} className="text-[11px] font-semibold rounded-md px-2 py-1 bg-[#dcf5e8] text-[#137a4a]">
                      ✓ {eco}
                    </span>
                  ))}
                  {resumenDia.pendientes.map((eco) => (
                    <span key={eco} className="text-[11px] font-semibold rounded-md px-2 py-1 bg-white border border-[var(--gray-200)] text-[var(--gray-400)]">
                      {eco}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla */}
            {histCargando ? (
              <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Consultando revisiones...</p>
            ) : histRegistros.length === 0 ? (
              <p className="text-center text-[var(--gray-400)] text-[13px] py-8">{histConsulta ? "No hay revisiones con esos filtros." : ""}</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11.5px] text-[var(--gray-400)]">{histRegistros.length} registro(s)</span>
                  <button type="button" onClick={exportarHistorial} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                    Exportar Excel
                  </button>
                </div>
                <div className="overflow-x-auto border border-[var(--gray-200)] rounded-xl">
                  <table className="w-full border-collapse min-w-[720px]">
                    <thead>
                      <tr>
                        {["Fecha", "Hora", "ECO", "Unidad", "Resultado", "Realizó", "Acciones"].map((h) => (
                          <th key={h} className="text-left text-[10.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3 py-2.5 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histRegistros.map((r, i) => {
                        const { ok, total } = contarCumplidos(r.resultados);
                        const fallas = total - ok;
                        const expandido = histExpandido === r.id;
                        const diaAnterior = i > 0 ? diaLocal(histRegistros[i - 1].fecha) : "";
                        const nuevoDia = diaLocal(r.fecha) !== diaAnterior;
                        return (
                          <FilaRevision
                            key={r.id}
                            revision={r}
                            unidad={nombrePorEco[r.eco] || "—"}
                            tipoLlantas={tipoPorEco[r.eco] || null}
                            ok={ok}
                            total={total}
                            fallas={fallas}
                            expandido={expandido}
                            separador={nuevoDia && i > 0}
                            puedeEliminar={esAdmin}
                            onVer={() => setHistExpandido(expandido ? null : r.id)}
                            onEliminar={() => eliminarRevision(r)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Fila del historial (con detalle desplegable) ----------
function FilaRevision({
  revision,
  unidad,
  tipoLlantas,
  ok,
  total,
  fallas,
  expandido,
  separador,
  puedeEliminar,
  onVer,
  onEliminar,
}: {
  revision: Revision;
  unidad: string;
  tipoLlantas: TipoNeumaticos | null;
  ok: number;
  total: number;
  fallas: number;
  expandido: boolean;
  separador: boolean;
  puedeEliminar: boolean;
  onVer: () => void;
  onEliminar: () => void;
}) {
  // Llantas de la revisión con su semáforo (según el tipo de unidad)
  const llantas = Object.entries(revision.neumaticos || {})
    .map(([posicion, valor]) => {
      const llanta = leerLlanta(valor);
      const estado = llanta.mm != null && llanta.mm > 0 && tipoLlantas ? semaforoMM(llanta.mm, tipoLlantas.mm) : null;
      return { posicion, folio: llanta.folio || "", mm: llanta.mm ?? null, estado };
    })
    .filter((l) => l.folio || l.mm != null);
  const peor = (["critico", "rojo", "amarillo"] as Semaforo[]).find((e) => llantas.some((l) => l.estado === e)) || null;
  const cuentaPeor = peor ? llantas.filter((l) => l.estado === peor).length : 0;

  return (
    <>
      <tr className={`border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)] ${separador ? "border-t-2 border-t-[var(--gray-400)]" : ""} ${expandido ? "bg-[var(--gray-100)]" : ""}`}>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap font-semibold">{formatoFecha(revision.fecha)}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{formatoHora(revision.fecha)}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{revision.eco}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{unidad}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">
          <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${fallas === 0 ? "bg-[#dcf5e8] text-[#137a4a]" : "bg-[#fde4e0] text-[var(--red)]"}`}>
            {ok}/{total} {fallas === 0 ? "OK" : `· ${fallas} falla(s)`}
          </span>
          {peor && (
            <span className={`inline-flex items-center gap-1 ml-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold ${ESTILO_SEMAFORO[peor].chip}`}>
              <IconoAviso size={11} />
              {cuentaPeor} llanta(s) {peor === "critico" ? "crítica(s)" : `en ${ESTILO_SEMAFORO[peor].etiqueta.toLowerCase()}`}
            </span>
          )}
        </td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{revision.realizado_por || "—"}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onVer} className="text-[12px] font-bold text-[var(--blue)] hover:underline">
              {expandido ? "Ocultar" : "Ver"}
            </button>
            <button
              type="button"
              onClick={() => descargarPdfRevision(revision, unidad, tipoLlantas)}
              className="text-[var(--navy)]"
              title="Descargar PDF de esta revisión"
              aria-label="Descargar PDF de esta revisión"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
            </button>
            {puedeEliminar && (
              <button type="button" onClick={onEliminar} className="text-[var(--red)]" title="Eliminar revisión" aria-label="Eliminar revisión">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
              </button>
            )}
          </div>
        </td>
      </tr>
      {expandido && (
        <tr className="bg-[var(--gray-100)] border-b border-[var(--gray-200)]">
          <td colSpan={7} className="px-3 pb-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {CHECKLIST_TODOS.map((bloque) => (
                <div key={bloque.titulo} className="bg-white border border-[var(--gray-200)] rounded-lg p-2.5">
                  <p className="text-[12px] font-bold text-[var(--navy)] m-0 mb-1.5">{bloque.titulo}</p>
                  <ul className="m-0 p-0 list-none space-y-1">
                    {bloque.items.map((item) => {
                      const v = revision.resultados?.[bloque.titulo]?.[item];
                      return (
                        <li key={item} className="flex items-start gap-1.5 text-[11px] leading-tight">
                          <span className={`font-bold ${v === undefined ? "text-[var(--gray-400)]" : v ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                            {v === undefined ? "–" : v ? "✓" : "✗"}
                          </span>
                          <span className="min-w-0 break-words">{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {llantas.length > 0 && (
              <div className="mt-2.5">
                <p className="text-[12px] font-bold text-[var(--navy)] m-0 mb-1.5">Neumáticos</p>
                <div className="flex flex-wrap gap-1.5">
                  {llantas.map((l) => (
                    <span
                      key={l.posicion}
                      className={`inline-flex items-center gap-1.5 bg-white rounded-md border-2 px-2 py-1 text-[11px] ${
                        l.estado ? ESTILO_SEMAFORO[l.estado].borde : "border-[var(--gray-200)]"
                      }`}
                    >
                      <b className="text-[var(--navy)]">{l.posicion}</b>
                      {l.folio && <span>Folio {l.folio}</span>}
                      {l.mm != null && <span className="font-semibold">{formatoMM(l.mm)}</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {revision.kilometraje != null && (
              <p className="text-[12px] text-[var(--text)] mt-2.5 mb-0">
                <b className="text-[var(--navy)]">Kilometraje:</b> {Number(revision.kilometraje).toLocaleString("es-MX")} km
              </p>
            )}
            {revision.observaciones && (
              <p className="text-[12px] text-[var(--text)] mt-2.5 mb-0 break-words">
                <b className="text-[var(--navy)]">Observaciones:</b> {revision.observaciones}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}