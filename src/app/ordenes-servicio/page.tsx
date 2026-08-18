"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import FotoCard from "@/components/FotoCard";
import { exportarExcel } from "@/lib/exportExcel";
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
type RequisicionItem = {
cantidad: string;
descripcion: string;
costo: string;
categoria?: string;
referencia?: string;
costoUnitario?: string;
proveedor?: string;
fechaCompra?: string;
};
type EstadoOrden = "diagnostico_pendiente" | "autorizacion_pendiente" | "cerrar_orden" | "servicio_realizado";
type Orden = {
folio: string;
fecha: string;
ecoUnidad: string;
fallaDetectada: string;
estado: EstadoOrden;
diagnostico?: string;
responsable?: string;
requisicion?: RequisicionItem[];
fechaDiagnostico?: string;
fechaIngreso?: string;
fechaCierre?: string;
quedoBien?: string;
fotoReparacion?: string | null;
};
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
declare global {
interface Window {
jspdf: any;
}
}
function cargarJsPDF(): Promise<void> {
return new Promise((resolve, reject) => {
if (window.jspdf) {
resolve();
return;
}
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
script.onload = () => resolve();
script.onerror = () => reject(new Error("No se pudo cargar el generador de PDF."));
document.body.appendChild(script);
});
}
function formatearFecha(iso?: string) {
if (!iso) return "—";
return new Date(iso).toLocaleString("es-MX");
}
function horasDentroDelTaller(o: Orden, ahora: number): string {
if (!o.fechaIngreso) return "—";
const inicio = new Date(o.fechaIngreso).getTime();
const fin = o.fechaCierre ? new Date(o.fechaCierre).getTime() : ahora;
const horas = Math.max(0, (fin - inicio) / 3600000);
return `${horas.toFixed(1)} hrs`;
}
const ESTADO_INFO: Record<EstadoOrden, { label: string; clases: string; clicable: boolean }> = {
diagnostico_pendiente: { label: "Diagnóstico", clases: "bg-[var(--amber)] text-[#52350a]", clicable: true },
autorizacion_pendiente: { label: "Autorización", clases: "bg-[var(--red)] text-white", clicable: false },
cerrar_orden: { label: "Cerrar", clases: "bg-[var(--blue)] text-white", clicable: true },
servicio_realizado: { label: "Realizado", clases: "bg-[var(--green)] text-white", clicable: false },
};
export default function OrdenesServicioPage() {
const [ordenes, setOrdenes] = useState<Orden[]>([]);
const [cargando, setCargando] = useState(true);
const [seccionActiva, setSeccionActiva] = useState<"reportes" | "unidades" | "gastos" | "aceite" | null>(null);
useEffect(() => {
const params = new URLSearchParams(window.location.search);
if (params.get("seccion") === "reportes") setSeccionActiva("reportes");
}, []);
const [cambiosAceite, setCambiosAceite] = useState<CambioAceite[]>([]);
const [cargandoAceite, setCargandoAceite] = useState(true);
const [unidadesRegistradas, setUnidadesRegistradas] = useState<RegistroUnidad[]>([]);
const [tick, setTick] = useState(Date.now());
const [errorCarga, setErrorCarga] = useState("");
// ---- Carga desde la nube (compartida entre dispositivos) ----
const cargarOrdenes = async () => {
try {
const res = await fetch("/api/ordenes/list");
const data = await res.json();
if (res.ok) setOrdenes(data.registros || []);
} catch {
setErrorCarga("No se pudo conectar con la nube. Revisa tu conexión.");
}
};
const cargarUnidades = async () => {
try {
const res = await fetch("/api/unidades/list");
const data = await res.json();
if (res.ok) setUnidadesRegistradas(data.registros || []);
} catch {
// se reintenta con el sondeo periódico
}
};
const cargarCambiosAceite = async () => {
try {
const res = await fetch("/api/cambios-aceite/list", { cache: "no-store" });
const data = await res.json();
if (res.ok) setCambiosAceite(data.registros || []);
} catch {
// se reintenta con el sondeo periódico
} finally {
setCargandoAceite(false);
}
};
const [ultimoChecklistPorEco, setUltimoChecklistPorEco] = useState<Record<string, { id: number; fechaHora: string }>>({});
const cargarUltimoChecklist = async () => {
try {
const res = await fetch("/api/checklist/reporte-estado", { cache: "no-store" });
const data = await res.json();
const mapa: Record<string, { id: number; fechaHora: string }> = {};
(data.registros || []).forEach((r: any) => {
mapa[r.eco_unidad] = { id: r.id, fechaHora: r.fecha_hora };
});
setUltimoChecklistPorEco(mapa);
} catch {
// se reintenta con el sondeo periódico
}
};
const [comentariosRevision, setComentariosRevision] = useState<Record<string, string>>({});
const cargarComentariosRevision = async () => {
try {
const res = await fetch("/api/revision-semanal/comentarios", { cache: "no-store" });
const data = await res.json();
setComentariosRevision(data.comentarios || {});
} catch {
// se reintenta con el sondeo periódico
}
};
const guardarComentarioRevision = (eco: string, comentario: string) => {
setComentariosRevision((prev) => ({ ...prev, [eco]: comentario }));
fetch("/api/revision-semanal/comentarios", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ eco, comentario }),
}).catch(() => cargarComentariosRevision());
};
useEffect(() => {
(async () => {
await Promise.all([cargarOrdenes(), cargarUnidades(), cargarCambiosAceite(), cargarUltimoChecklist(), cargarComentariosRevision()]);
setCargando(false);
})();
}, []);
// Sondeo periódico para reflejar cambios hechos desde otros dispositivos
useEffect(() => {
const id = setInterval(() => {
cargarOrdenes();
cargarUnidades();
cargarCambiosAceite();
cargarUltimoChecklist();
cargarComentariosRevision();
}, 20000);
return () => clearInterval(id);
}, []);
// Reloj para el contador de horas dentro del taller
useEffect(() => {
const id = setInterval(() => setTick(Date.now()), 60000);
return () => clearInterval(id);
}, []);
const unidadInfo = (eco: string) => unidadesRegistradas.find((u) => u["ECO"] === eco);

// ---- Cambios de aceite ----
const agregarCambioAceite = async () => {
try {
const res = await fetch("/api/cambios-aceite", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({}),
});
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
fetch("/api/cambios-aceite/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id, [campo]: valor }),
}).catch(() => cargarCambiosAceite());
};
const cambiarEcoAceite = (id: number, eco: string) => {
const unidad = unidadInfo(eco)?.["Unidad"] || "";
setCambiosAceite((prev) => prev.map((c) => (c.id === id ? { ...c, eco, unidad } : c)));
fetch("/api/cambios-aceite/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id, eco, unidad }),
}).catch(() => cargarCambiosAceite());
};
const eliminarCambioAceite = async (id: number) => {
if (!confirm("¿Eliminar este registro de cambio de aceite?")) return;
setCambiosAceite((prev) => prev.filter((c) => c.id !== id));
try {
await fetch("/api/cambios-aceite/delete", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id }),
});
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
porcentaje = ((kmActual - kmUltimo) * 100) / KM_INTERVALO_CAMBIO;
porcentaje = Math.max(0, porcentaje);
}
let etiqueta = "";
if (c.servicioRealizado) {
etiqueta = "Servicio realizado";
} else if (porcentaje !== null) {
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
setCambiosAceite((prev) =>
prev.map((x) => (x.id === c.id ? { ...x, servicioRealizado: true, kmUltimoCambio: nuevoKmUltimo, fechaUltimoCambio: hoy, kmActual: "" } : x))
);
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
await fetch("/api/cambios-aceite/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id: c.id, servicioRealizado: false }),
});
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
await Promise.all(
marcados.map((c) =>
fetch("/api/cambios-aceite/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id: c.id, servicioRealizado: false }),
})
)
);
} catch {
await cargarCambiosAceite();
}
};

// Candado por fila (solo visual/local, protege Eco/Unidad/Fecha ultimo cambio/KM ultimo cambio de ediciones accidentales)
const [filasDesbloqueadasAceite, setFilasDesbloqueadasAceite] = useState<Set<number>>(new Set());
const toggleBloqueoAceite = (id: number) => {
setFilasDesbloqueadasAceite((prev) => {
const nuevo = new Set(prev);
if (nuevo.has(id)) nuevo.delete(id);
else nuevo.add(id);
return nuevo;
});
};

// Filtro por indicador (multi-seleccion)
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
// ---- Formulario: nueva orden ----
const [nuevaOrdenAbierta, setNuevaOrdenAbierta] = useState(false);
const [nEco, setNEco] = useState("");
const [nFalla, setNFalla] = useState("");
const [creando, setCreando] = useState(false);
const abrirNuevaOrden = () => {
setNEco(unidadesRegistradas[0]?.["ECO"] || "");
setNFalla("");
setNuevaOrdenAbierta(true);
};
const guardarNuevaOrden = async () => {
if (!nEco) {
alert("Selecciona el ECO de la unidad.");
return;
}
setCreando(true);
try {
const res = await fetch("/api/ordenes", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ ecoUnidad: nEco, fallaDetectada: nFalla }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al crear la orden.");
setNuevaOrdenAbierta(false);
await cargarOrdenes();
} catch (err: any) {
alert(err.message || "Error al crear la orden.");
} finally {
setCreando(false);
}
};
// ---- Formulario: diagnostico (marcador "Diagnóstico pendiente") ----
const [diagFolio, setDiagFolio] = useState<string | null>(null);
const [diagComo, setDiagComo] = useState("");
const [diagQuien, setDiagQuien] = useState("");
const [diagItems, setDiagItems] = useState<RequisicionItem[]>([{ cantidad: "", descripcion: "", costo: "" }]);
const [guardandoDiag, setGuardandoDiag] = useState(false);
const abrirDiagnostico = (folio: string) => {
setDiagFolio(folio);
setDiagComo("");
setDiagQuien("");
setDiagItems([{ cantidad: "", descripcion: "", costo: "" }]);
};
const actualizarDiagItem = (i: number, campo: keyof RequisicionItem, valor: string) => {
setDiagItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));
};
const guardarDiagnostico = async () => {
if (!diagComo.trim() || !diagQuien.trim()) {
alert("Captura cómo se arregla la falla y quién hará la reparación.");
return;
}
const items = diagItems.filter((it) => it.descripcion.trim());
setGuardandoDiag(true);
try {
const res = await fetch("/api/ordenes/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
folio: diagFolio,
diagnostico: diagComo.trim(),
responsable: diagQuien.trim(),
requisicion: items,
fechaDiagnostico: new Date().toISOString(),
estado: "autorizacion_pendiente",
}),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al guardar el diagnóstico.");
setDiagFolio(null);
await cargarOrdenes();
} catch (err: any) {
alert(err.message || "Error al guardar el diagnóstico.");
} finally {
setGuardandoDiag(false);
}
};
// ---- Autorizaciones pendientes ----
const pendientes = useMemo(() => ordenes.filter((o) => o.estado === "autorizacion_pendiente"), [ordenes]);
const [autModalAbierto, setAutModalAbierto] = useState(false);
const [autDesbloqueado, setAutDesbloqueado] = useState(false);
const [autPassword, setAutPassword] = useState("");
const [autError, setAutError] = useState("");
const [autorizando, setAutorizando] = useState<string | null>(null);
const abrirAutorizaciones = () => {
setAutDesbloqueado(false);
setAutPassword("");
setAutError("");
setAutModalAbierto(true);
};
const validarPassword = () => {
if (autPassword === "1234") {
setAutDesbloqueado(true);
setAutError("");
} else {
setAutError("Contraseña incorrecta.");
}
};
// ---- PDF orden de servicio ----
const [pdfUrl, setPdfUrl] = useState<string | null>(null);
const [pdfNombre, setPdfNombre] = useState("");
const autorizar = async (folio: string) => {
setAutorizando(folio);
try {
const ahoraIso = new Date().toISOString();
const res = await fetch("/api/ordenes/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio, fechaIngreso: ahoraIso, estado: "cerrar_orden" }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al autorizar la orden.");
await cargarOrdenes();
await generarPdfOrden(data.orden);
} catch (err: any) {
alert(err.message || "Error al autorizar la orden.");
} finally {
setAutorizando(null);
}
};
const generarPdfOrden = async (o: Orden) => {
try {
await cargarJsPDF();
const { jsPDF } = window.jspdf;
const doc = new jsPDF({ unit: "pt", format: "letter" });
const marginX = 48;
const pageW = 612;
let y = 56;
const logoImg = await fetch("/logo-transportes.png")
.then((r) => r.blob())
.then(
(b) =>
new Promise<string>((resolve) => {
const reader = new FileReader();
reader.onload = () => resolve(reader.result as string);
reader.readAsDataURL(b);
})
);
doc.addImage(logoImg, "PNG", marginX, y - 30, 46, 46);
doc.setFont("helvetica", "bold");
doc.setFontSize(24);
doc.setTextColor(15, 15, 15);
doc.text("ORDEN DE SERVICIO", marginX + 70, y - 2);
const cajaX = 372;
const cajaW = 192;
const cajaY = y - 30;
const cajaH = 60;
doc.setDrawColor(40, 40, 40);
doc.setLineWidth(1);
doc.rect(cajaX, cajaY, cajaW, cajaH);
doc.setFontSize(9);
doc.setTextColor(20, 20, 20);
const filaCaja = (label: string, valor: string, ly: number) => {
doc.setFont("helvetica", "bold");
doc.text(label, cajaX + 10, ly);
doc.setFont("helvetica", "normal");
const lineas = doc.splitTextToSize(valor, cajaW - 78);
doc.text(lineas, cajaX + 68, ly);
};
filaCaja("FOLIO:", o.folio, cajaY + 17);
filaCaja("FECHA:", formatearFecha(o.fechaIngreso || o.fecha), cajaY + 33);
filaCaja("RESPONSABLE:", o.responsable || "—", cajaY + 49);
y = cajaY + cajaH + 24;
const unidad = unidadInfo(o.ecoUnidad);
const ecoBoxH = 30;
doc.setDrawColor(40, 40, 40);
doc.rect(marginX, y, 320, ecoBoxH);
doc.setFont("helvetica", "bold");
doc.setFontSize(10.5);
doc.text("ECO. UNIDAD", marginX + 10, y + 19);
doc.setFont("helvetica", "normal");
const textoUnidad = `${o.ecoUnidad}${unidad?.["Unidad"] ? " — " + unidad["Unidad"] : ""}`;
doc.text(textoUnidad, marginX + 115, y + 19);
y += ecoBoxH + 30;
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.setTextColor(15, 15, 15);
doc.text("DIAGNÓSTICO", pageW / 2, y, { align: "center" });
y += 10;
const diagBoxH = 80;
doc.rect(marginX, y, pageW - marginX * 2, diagBoxH);
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
const diagTexto = o.diagnostico || "—";
const diagLineas = doc.splitTextToSize(diagTexto, pageW - marginX * 2 - 30);
const diagAltoBloque = diagLineas.length * 13;
const diagStartY = y + Math.max(18, (diagBoxH - diagAltoBloque) / 2 + 10);
doc.text(diagLineas, pageW / 2, diagStartY, { align: "center" });
y += diagBoxH + 26;
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text("REQUISICIÓN", pageW / 2, y, { align: "center" });
y += 10;
const reqBoxH = 190;
const reqTop = y;
const headerH = 24;
doc.setFillColor(232, 233, 237);
doc.rect(marginX, reqTop, pageW - marginX * 2, headerH, "F");
doc.rect(marginX, reqTop, pageW - marginX * 2, reqBoxH);
doc.line(marginX, reqTop + headerH, pageW - marginX, reqTop + headerH);
doc.setFont("helvetica", "bold");
doc.setFontSize(9.5);
doc.setTextColor(20, 20, 20);
doc.text("CANTIDAD", marginX + 14, reqTop + 16);
doc.text("DESCRIPCIÓN", marginX + 150, reqTop + 16);
doc.text("MONTO", pageW - marginX - 70, reqTop + 16);
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
let filaY = reqTop + headerH + 18;
const items = o.requisicion || [];
if (items.length === 0) {
doc.setTextColor(150, 150, 150);
doc.text("Sin artículos capturados.", marginX + 14, filaY);
} else {
items.forEach((it) => {
doc.setTextColor(30, 30, 30);
doc.text(String(it.cantidad || ""), marginX + 14, filaY);
const ld = doc.splitTextToSize(it.descripcion, 220);
doc.text(ld, marginX + 150, filaY);
doc.text(it.costo ? `$${it.costo}` : "—", pageW - marginX - 70, filaY);
filaY += Math.max(15, ld.length * 13);
});
}
const firmasY = reqTop + reqBoxH + 70;
doc.setDrawColor(40, 40, 40);
doc.line(marginX + 20, firmasY, marginX + 220, firmasY);
doc.line(pageW - marginX - 220, firmasY, pageW - marginX - 20, firmasY);
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(30, 30, 30);
doc.text("Firma de autorización", marginX + 120, firmasY + 16, { align: "center" });
doc.text("Firma de garantía de servicio", pageW - marginX - 120, firmasY + 16, { align: "center" });
const blob = doc.output("blob");
if (pdfUrl) URL.revokeObjectURL(pdfUrl);
const url = URL.createObjectURL(blob);
setPdfUrl(url);
setPdfNombre(`${o.folio}_${new Date().toISOString().slice(0, 10)}.pdf`);
} catch (err: any) {
alert(err.message || "No se pudo generar el PDF.");
}
};
const descargarPdfOrden = () => {
if (!pdfUrl) return;
const a = document.createElement("a");
a.href = pdfUrl;
a.download = pdfNombre || "orden.pdf";
document.body.appendChild(a);
a.click();
a.remove();
};
// ---- Imprimir / descargar orden por folio (cualquier estatus) ----
const [imprimirModalAbierto, setImprimirModalAbierto] = useState(false);
const [folioAImprimir, setFolioAImprimir] = useState("");
const [generandoImpresion, setGenerandoImpresion] = useState(false);
const abrirImprimir = () => {
if (ordenes.length === 0) {
alert("Aún no hay órdenes registradas.");
return;
}
setFolioAImprimir(ordenes[0].folio);
setImprimirModalAbierto(true);
};
const generarDesdeImprimir = async () => {
const orden = ordenes.find((o) => o.folio === folioAImprimir);
if (!orden) return;
setGenerandoImpresion(true);
try {
await generarPdfOrden(orden);
setImprimirModalAbierto(false);
} finally {
setGenerandoImpresion(false);
}
};
// ---- Formulario: cierre de orden ----
const [cierreFolio, setCierreFolio] = useState<string | null>(null);
const [cierreQuedoBien, setCierreQuedoBien] = useState("");
const [cierreFoto, setCierreFoto] = useState<string | null>(null);
const [guardandoCierre, setGuardandoCierre] = useState(false);
const abrirCierre = (folio: string) => {
setCierreFolio(folio);
setCierreQuedoBien("");
setCierreFoto(null);
};
const guardarCierre = async () => {
if (!cierreFoto) {
alert("Agrega una foto de la reparación para poder cerrar la orden.");
return;
}
setGuardandoCierre(true);
try {
const res = await fetch("/api/ordenes/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
folio: cierreFolio,
quedoBien: cierreQuedoBien.trim(),
fotoReparacion: cierreFoto,
fechaCierre: new Date().toISOString(),
estado: "servicio_realizado",
}),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al cerrar la orden.");
setCierreFolio(null);
await cargarOrdenes();
} catch (err: any) {
alert(err.message || "Error al cerrar la orden.");
} finally {
setGuardandoCierre(false);
}
};
// ---- Eliminar orden completa ----
const eliminarOrden = async (folio: string) => {
if (!confirm(`¿Eliminar la orden ${folio}? Se eliminará también su historial de gastos. Esta acción no se puede deshacer.`)) return;
try {
const res = await fetch("/api/ordenes/delete", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al eliminar.");
await cargarOrdenes();
} catch (err: any) {
alert(err.message || "Error al eliminar la orden.");
}
};
// ---- Eliminar un artículo de gastos (dentro de la orden dueña) ----
const eliminarGasto = async (folio: string, idx: number) => {
if (!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;
const orden = ordenes.find((o) => o.folio === folio);
if (!orden) return;
const nuevaRequisicion = (orden.requisicion || []).filter((_, i) => i !== idx);
try {
const res = await fetch("/api/ordenes/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio, requisicion: nuevaRequisicion }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al eliminar.");
await cargarOrdenes();
} catch (err: any) {
alert(err.message || "Error al eliminar el gasto.");
}
};
// ---- Requisición de Insumos / servicios (agrega gastos directo a Gastos en mantenimiento) ----
type ReqRow = {
folio: string;
fecha: string;
cantidad: string;
categoria: string;
descripcion: string;
referencia: string;
costoUnitario: string;
costoTotal: string;
proveedor: string;
};
const filaReqVacia = (folioDefault: string): ReqRow => ({
folio: folioDefault,
fecha: new Date().toISOString().slice(0, 10),
cantidad: "",
categoria: "",
descripcion: "",
referencia: "",
costoUnitario: "",
costoTotal: "",
proveedor: "",
});
const [reqModalAbierto, setReqModalAbierto] = useState(false);
const [reqRows, setReqRows] = useState<ReqRow[]>([]);
const [guardandoReq, setGuardandoReq] = useState(false);
const abrirRequisicion = () => {
if (ordenes.length === 0) {
alert("Primero crea al menos una orden de mantenimiento.");
return;
}
setReqRows([filaReqVacia(ordenes[0].folio)]);
setReqModalAbierto(true);
};
const actualizarReqRow = (i: number, campo: keyof ReqRow, valor: string) => {
setReqRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [campo]: valor } : r)));
};
const guardarRequisicion = async () => {
const filas = reqRows.filter((r) => r.descripcion.trim());
if (filas.length === 0) {
alert("Captura al menos una descripción.");
return;
}
setGuardandoReq(true);
try {
const folios = Array.from(new Set(filas.map((r) => r.folio)));
for (const folio of folios) {
const orden = ordenes.find((o) => o.folio === folio);
if (!orden) continue;
const nuevosItems: RequisicionItem[] = filas
.filter((r) => r.folio === folio)
.map((r) => ({
cantidad: r.cantidad,
descripcion: r.descripcion.trim(),
costo: r.costoTotal,
categoria: r.categoria,
referencia: r.referencia,
costoUnitario: r.costoUnitario,
proveedor: r.proveedor,
fechaCompra: r.fecha,
}));
const requisicionActualizada = [...(orden.requisicion || []), ...nuevosItems];
const res = await fetch("/api/ordenes/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio, requisicion: requisicionActualizada }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || `Error al guardar en el folio ${folio}.`);
}
setReqModalAbierto(false);
await cargarOrdenes();
} catch (err: any) {
alert(err.message || "Error al guardar la requisición.");
} finally {
setGuardandoReq(false);
}
};
// ---- Derivados para las tablas ----
const totalUnidadesEnMantenimiento = ordenes.filter((o) => o.estado !== "servicio_realizado").length;
const conteoPorEstado = useMemo(() => {
const mapa: Record<EstadoOrden, number> = { diagnostico_pendiente: 0, autorizacion_pendiente: 0, cerrar_orden: 0, servicio_realizado: 0 };
ordenes.forEach((o) => {
if (mapa[o.estado] !== undefined) mapa[o.estado]++;
});
return mapa;
}, [ordenes]);
// ---- Edicion en linea de Unidades en mantenimiento ----
const actualizarOrdenLocal = (folio: string, campo: string, valor: string) => {
setOrdenes((prev) => prev.map((o) => (o.folio === folio ? { ...o, [campo]: valor } : o)));
};
const guardarCampoOrden = (folio: string, campo: string, valor: string) => {
fetch("/api/ordenes/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio, [campo]: valor }),
}).catch(() => cargarOrdenes());
};
const [filtroEstadoUnidades, setFiltroEstadoUnidades] = useState<EstadoOrden | "">("");
const [filtroMiniAceite, setFiltroMiniAceite] = useState<"urgentes" | "siguiente" | "todos" | null>(null);
const [busquedaHistorialUnidad, setBusquedaHistorialUnidad] = useState("");
const [unidadHistorialSeleccionada, setUnidadHistorialSeleccionada] = useState<string | null>(null);
const sugerenciasHistorialUnidad = useMemo(() => {
const q = busquedaHistorialUnidad.trim().toLowerCase();
if (!q) return [];
return unidadesRegistradas.map((u) => u["ECO"]).filter((eco) => eco.toLowerCase().includes(q)).slice(0, 8);
}, [busquedaHistorialUnidad, unidadesRegistradas]);
const miniAceiteFiltrado = useMemo(() => {
if (filtroMiniAceite === "urgentes") return cambiosAceite.filter((c) => calcularAceite(c).etiqueta === "Urgente");
if (filtroMiniAceite === "siguiente") return cambiosAceite.filter((c) => calcularAceite(c).etiqueta === "Se programa para la siguiente semana");
if (filtroMiniAceite === "todos") {
return [...cambiosAceite].sort((a, b) => {
const pa = calcularAceite(a).porcentaje ?? -1;
const pb = calcularAceite(b).porcentaje ?? -1;
return pb - pa;
});
}
return cambiosAceite;
}, [cambiosAceite, filtroMiniAceite]);
// ---- Checkbox de check rapido en Cambios de aceite (mini tabla) ----
const [aceiteCheckAbierto, setAceiteCheckAbierto] = useState<CambioAceite | null>(null);
const [aceiteCheckKm, setAceiteCheckKm] = useState("");
const [guardandoAceiteCheck, setGuardandoAceiteCheck] = useState(false);
const iniciarCheckAceite = (c: CambioAceite) => {
const clave = prompt("Ingresa la contraseña para registrar el cambio de aceite:");
if (clave === null) return;
if (clave !== "4321") {
alert("Contraseña incorrecta.");
return;
}
setAceiteCheckKm("");
setAceiteCheckAbierto(c);
};
const confirmarCheckAceite = async () => {
if (!aceiteCheckAbierto || !aceiteCheckKm.trim()) {
alert("Captura el kilometraje del cambio.");
return;
}
setGuardandoAceiteCheck(true);
const hoy = new Date().toISOString().slice(0, 10);
try {
const res = await fetch("/api/cambios-aceite/update", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ id: aceiteCheckAbierto.id, kmUltimoCambio: aceiteCheckKm.trim(), kmActual: aceiteCheckKm.trim(), fechaUltimoCambio: hoy }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al guardar.");
await cargarCambiosAceite();
setAceiteCheckAbierto(null);
} catch (err: any) {
alert(err.message || "No se pudo guardar el cambio de aceite.");
} finally {
setGuardandoAceiteCheck(false);
}
};
// ---- Filtro por ECO para el dashboard "Ordenes de Servicio" ----
const [filtroEcoOrdenes, setFiltroEcoOrdenes] = useState("");
const gastosEcoFiltrado = useMemo(() => {
if (!filtroEcoOrdenes) return [];
return ordenes
.filter((o) => o.ecoUnidad === filtroEcoOrdenes)
.map((o) => ({ folio: o.folio, fecha: o.fechaIngreso || o.fechaCierre || "", costo: (o.requisicion || []).reduce((s, it) => s + (parseFloat(it.costo) || 0), 0) }))
.filter((g) => g.costo > 0)
.sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));
}, [ordenes, filtroEcoOrdenes]);
const ordenesFiltradas = filtroEstadoUnidades ? ordenes.filter((o) => o.estado === filtroEstadoUnidades) : ordenes;
// ---- Grafica de costos de reparacion por ECO. Unidad ----
const costosPorEco = useMemo(() => {
const mapa: Record<string, number> = {};
ordenes.forEach((o) => {
const costo = (o.requisicion || []).reduce((s, it) => s + (parseFloat(it.costo) || 0), 0);
if (costo > 0 && o.ecoUnidad) mapa[o.ecoUnidad] = (mapa[o.ecoUnidad] || 0) + costo;
});
return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
}, [ordenes]);
const DIAS_SEMANA_CORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const comparativoSemanal = useMemo(() => {
const lunesDeSemana = (f: Date) => {
const d = new Date(f);
const dia = d.getDay() || 7;
d.setDate(d.getDate() - (dia - 1));
d.setHours(0, 0, 0, 0);
return d;
};
const lunesActual = lunesDeSemana(new Date());
const lunesAnterior = new Date(lunesActual);
lunesAnterior.setDate(lunesAnterior.getDate() - 7);
const contarEnFecha = (fecha: Date) => {
const clave = fecha.toISOString().slice(0, 10);
return ordenes.filter((o) => o.fechaIngreso && o.fechaIngreso.slice(0, 10) === clave).length;
};
return DIAS_SEMANA_CORTO.map((dia, i) => {
const fA = new Date(lunesActual);
fA.setDate(fA.getDate() + i);
const fP = new Date(lunesAnterior);
fP.setDate(fP.getDate() + i);
return { dia, actual: contarEnFecha(fA), anterior: contarEnFecha(fP) };
});
}, [ordenes]);
const lunesDeSemanaActual = () => {
const d = new Date();
const dia = d.getDay() || 7;
const l = new Date(d);
l.setDate(d.getDate() - (dia - 1));
l.setHours(0, 0, 0, 0);
return l;
};
const unidadesConEstadoSemanal = useMemo(() => {
const lunesActual = lunesDeSemanaActual();
return unidadesRegistradas.map((u) => {
const info = ultimoChecklistPorEco[u["ECO"]];
const revisadaEstaSemana = !!info && new Date(info.fechaHora).getTime() >= lunesActual.getTime();
return { u, info, revisadaEstaSemana };
});
}, [unidadesRegistradas, ultimoChecklistPorEco]);
const totalRevisadasEstaSemana = unidadesConEstadoSemanal.filter((x) => x.revisadaEstaSemana).length;
const porcentajeAvanceSemanal = useMemo(() => {
if (unidadesRegistradas.length === 0) return 0;
return (totalRevisadasEstaSemana / unidadesRegistradas.length) * 100;
}, [unidadesRegistradas, totalRevisadasEstaSemana]);
const [filtroRevisionSemanal, setFiltroRevisionSemanal] = useState<"todos" | "realizados" | "pendientes">("todos");
const unidadesRevisionFiltradas = useMemo(() => {
if (filtroRevisionSemanal === "realizados") return unidadesConEstadoSemanal.filter((x) => x.revisadaEstaSemana);
if (filtroRevisionSemanal === "pendientes") return unidadesConEstadoSemanal.filter((x) => !x.revisadaEstaSemana);
return unidadesConEstadoSemanal;
}, [unidadesConEstadoSemanal, filtroRevisionSemanal]);
// ---- Descargar todo (Excel + fotos) / Liberar espacio (movido desde Registros guardados) ----
const [descargandoTodo, setDescargandoTodo] = useState(false);
const [liberandoEspacio, setLiberandoEspacio] = useState(false);
const [mensajeDescarga, setMensajeDescarga] = useState("");
const descargarTodoChecklist = async () => {
setDescargandoTodo(true);
setMensajeDescarga("");
try {
const res = await fetch("/api/checklist/export");
if (!res.ok) {
const data = await res.json();
throw new Error(data.error || "Error al descargar.");
}
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = `Checklist_Unidades_${new Date().toISOString().slice(0, 10)}.zip`;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
setMensajeDescarga("Descarga completa. Guárdala en tu PC antes de liberar espacio.");
} catch (err: any) {
setMensajeDescarga(err.message || "Error al descargar.");
} finally {
setDescargandoTodo(false);
}
};
const liberarEspacioNube = async () => {
if (!confirm("¿Ya guardaste el archivo descargado en tu PC? Esto borrará todos los registros de checklist de la nube de forma permanente.")) return;
setLiberandoEspacio(true);
setMensajeDescarga("");
try {
const res = await fetch("/api/checklist/clear", { method: "POST" });
const data = await res.json();
if (!res.ok) throw new Error(data.error);
setMensajeDescarga(`Se liberaron ${data.borrados} registros de la nube.`);
await cargarUltimoChecklist();
} catch (err: any) {
setMensajeDescarga(err.message || "Error al liberar espacio.");
} finally {
setLiberandoEspacio(false);
}
};
const totalGastos = ordenes.reduce(
(acc, o) => acc + (o.requisicion || []).reduce((s, it) => s + (parseFloat(it.costo) || 0), 0),
0
);
const filasGastos = ordenes.flatMap((o) =>
(o.requisicion || []).map((it, idx) => ({
key: `${o.folio}-${idx}`,
folio: o.folio,
ecoUnidad: o.ecoUnidad,
idxEnOrden: idx,
fecha: it.fechaCompra ? it.fechaCompra : o.fechaDiagnostico ? new Date(o.fechaDiagnostico).toLocaleDateString("es-MX") : "—",
cantidad: it.cantidad,
categoria: it.categoria || "—",
descripcion: it.descripcion,
referencia: it.referencia || "—",
costoUnitario: it.costoUnitario || "—",
costo: it.costo,
proveedor: it.proveedor || "—",
}))
);
const [filtroGastoFolio, setFiltroGastoFolio] = useState("");
const [filtroGastoEco, setFiltroGastoEco] = useState("");
const [filtroGastoFecha, setFiltroGastoFecha] = useState("");
const [filtroGastoDescripcion, setFiltroGastoDescripcion] = useState("");
const foliosGastos = Array.from(new Set(filasGastos.map((f) => f.folio)));
const ecosGastos = Array.from(new Set(ordenes.map((o) => o.ecoUnidad)));
const filasGastosFiltradas = filasGastos.filter((f) => {
if (filtroGastoFolio && f.folio !== filtroGastoFolio) return false;
if (filtroGastoEco && f.ecoUnidad !== filtroGastoEco) return false;
if (filtroGastoFecha && !f.fecha.includes(filtroGastoFecha)) return false;
if (filtroGastoDescripcion && !f.descripcion.toLowerCase().includes(filtroGastoDescripcion.toLowerCase())) return false;
return true;
});
const exportarUnidadesEnMantenimiento = () => {
exportarExcel(`Unidades_en_mantenimiento_${new Date().toISOString().slice(0, 10)}.xlsx`, [
{
nombre: "Unidades en mantenimiento",
filas: ordenes.map((o) => ({
Estado: ESTADO_INFO[o.estado].label,
Folio: o.folio,
"ECO. Unidad": o.ecoUnidad,
Unidad: unidadInfo(o.ecoUnidad)?.["Unidad"] || "",
"Qué se está haciendo": o.diagnostico || "",
"Fecha de ingreso": o.fechaIngreso ? formatearFecha(o.fechaIngreso) : "",
"Hrs dentro del taller": horasDentroDelTaller(o, tick),
"Costo de reparación": (o.requisicion || []).reduce((s, it) => s + (parseFloat(it.costo) || 0), 0),
})),
},
]);
};
const exportarGastos = () => {
exportarExcel(`Gastos_en_mantenimiento_${new Date().toISOString().slice(0, 10)}.xlsx`, [
{
nombre: "Gastos en mantenimiento",
filas: filasGastosFiltradas.map((f) => ({
Folio: f.folio,
"Fecha de compra": f.fecha,
Cantidad: f.cantidad,
Categoría: f.categoria === "—" ? "" : f.categoria,
Descripción: f.descripcion,
Referencia: f.referencia === "—" ? "" : f.referencia,
"Costo unitario": f.costoUnitario === "—" ? "" : f.costoUnitario,
"Costo total": f.costo,
Proveedor: f.proveedor === "—" ? "" : f.proveedor,
})),
},
]);
};
return (
<div className="min-h-screen bg-[#eef1f6]">
<div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
<PageHeader
titulo="Órdenes de servicio y mantenimiento"
subtitulo="Gestiona las órdenes de servicio, mantenimiento y sus gastos."
backHref="/"
backLabel="Menú principal"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-3" /><path d="M9 14l2 2 4-4" /></svg>}
/>
{errorCarga && <p className="text-[12.5px] text-[var(--red)] mb-3">{errorCarga}</p>}
<div className="flex flex-wrap gap-2.5 md:gap-3 mb-6">
<button type="button" onClick={abrirNuevaOrden} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-3 text-[13px] font-bold">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
Nueva orden de mantenimiento
</button>
<Link href="/ordenes-servicio/inventario" className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-3 text-[13px] font-bold no-underline">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
Inventario
</Link>
<Link href="/ordenes-servicio/historial-mantenimientos" className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-3 text-[13px] font-bold no-underline">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
Historial de mantenimientos
</Link>
<button
type="button"
onClick={abrirImprimir}
title="Imprimir / descargar orden de servicio"
className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-3 text-[13px] font-bold"
>
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M6 9V2h12v7" /><path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
</button>
</div>
<div className="flex flex-wrap gap-2.5 mb-5">
<button type="button" onClick={() => setSeccionActiva("reportes")} className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "reportes" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}>
Reportes
</button>
<button type="button" onClick={() => setSeccionActiva("aceite")} className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "aceite" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}>
Cambios de aceite
</button>
<button type="button" onClick={() => setSeccionActiva(null)} className="text-[13px] font-bold px-5 py-2.5 rounded-lg bg-white border border-[var(--gray-200)] text-[var(--gray-400)]">
Ocultar
</button>
</div>

{seccionActiva === "reportes" && (
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 md:gap-5 mb-6">
{/* 1. Ordenes de Servicio */}
<div className="bg-white rounded-2xl border border-[var(--gray-200)] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_1px_2px_rgba(22,33,92,0.04)] h-[460px] flex flex-col">
<div className="flex items-center justify-between gap-2 mb-1.5">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Órdenes de Servicio</p>
<div className="flex items-center gap-1.5">
<input
list="dl-eco-filtro-ordenes"
value={filtroEcoOrdenes}
onChange={(e) => setFiltroEcoOrdenes(e.target.value)}
placeholder="Buscar ECO..."
className="border border-[var(--gray-200)] rounded-md px-2 py-1 text-[11px] w-[110px]"
/>
<datalist id="dl-eco-filtro-ordenes">
{unidadesRegistradas.map((u) => (
<option key={u["ECO"]} value={u["ECO"]} />
))}
</datalist>
{filtroEcoOrdenes && (
<span onClick={() => setFiltroEcoOrdenes("")} className="text-[10.5px] text-[var(--red)] font-semibold cursor-pointer whitespace-nowrap">
Borrar filtro
</span>
)}
</div>
</div>
<p className="text-[24px] md:text-[28px] font-bold text-[var(--navy)] m-0 mb-3">{totalUnidadesEnMantenimiento}</p>
<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
<div className="text-center bg-[var(--gray-100)] rounded-lg py-2 px-1">
<p className="text-[16px] font-bold text-[var(--green)] m-0">{conteoPorEstado.servicio_realizado}</p>
<p className="text-[9.5px] text-[var(--gray-400)] font-semibold m-0 leading-tight">Realizados</p>
</div>
<div className="text-center bg-[var(--gray-100)] rounded-lg py-2 px-1">
<p className="text-[16px] font-bold text-[var(--blue)] m-0">{conteoPorEstado.cerrar_orden}</p>
<p className="text-[9.5px] text-[var(--gray-400)] font-semibold m-0 leading-tight">Activos</p>
</div>
<div className="text-center bg-[var(--gray-100)] rounded-lg py-2 px-1">
<p className="text-[16px] font-bold text-[var(--red)] m-0">{conteoPorEstado.autorizacion_pendiente}</p>
<p className="text-[9.5px] text-[var(--gray-400)] font-semibold m-0 leading-tight">Aut. pendiente</p>
</div>
<div className="text-center bg-[var(--gray-100)] rounded-lg py-2 px-1">
<p className="text-[16px] font-bold text-[#8a5a05] m-0">{conteoPorEstado.diagnostico_pendiente}</p>
<p className="text-[9.5px] text-[var(--gray-400)] font-semibold m-0 leading-tight">Diagnóstico</p>
</div>
</div>
<div className="border-t border-[var(--gray-100)] pt-2.5 mb-2">
<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Total de gastos</p>
<p className="text-[19px] font-bold text-[var(--navy)] m-0">${totalGastos.toFixed(2)}</p>
</div>
<div className="flex-1 min-h-0">
{filtroEcoOrdenes ? (
<>
<p className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1">Gastos de {filtroEcoOrdenes} (todas las fechas)</p>
{gastosEcoFiltrado.length === 0 ? (
<p className="text-center text-[var(--gray-400)] text-[12px] py-8">Sin gastos registrados para esta unidad.</p>
) : (
<svg viewBox="0 0 480 170" className="w-full h-full">
<line x1={25} y1={125} x2={465} y2={125} stroke="#e5e8ee" strokeWidth={1} />
{(() => {
const maxVal = Math.max(1, ...gastosEcoFiltrado.map((g) => g.costo));
const puntos = gastosEcoFiltrado
.map((g, i) => {
const x = gastosEcoFiltrado.length > 1 ? 25 + i * ((465 - 25) / (gastosEcoFiltrado.length - 1)) : 245;
const y = 125 - (g.costo / maxVal) * 90;
return `${x},${y}`;
})
.join(" ");
return (
<>
<polyline points={puntos} fill="none" stroke="#2f6fed" strokeWidth={2.4} />
{gastosEcoFiltrado.map((g, i) => {
const x = gastosEcoFiltrado.length > 1 ? 25 + i * ((465 - 25) / (gastosEcoFiltrado.length - 1)) : 245;
const y = 125 - (g.costo / maxVal) * 90;
return (
<g key={g.folio + i}>
<circle cx={x} cy={y} r={3.4} fill="#2f6fed" />
<text x={x} y={y - 8} fontSize={9} textAnchor="middle" fill="#16215c" fontWeight="bold">
${g.costo.toFixed(0)}
</text>
<text x={x} y={142} fontSize={8.5} textAnchor="middle" fill="#9aa1b0">
{g.fecha ? new Date(g.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "—"}
</text>
</g>
);
})}
</>
);
})()}
</svg>
)}
</>
) : (
<>
<p className="text-[10.5px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1">Unidades ingresadas por día</p>
<svg viewBox="0 0 480 170" className="w-full h-full">
<line x1={25} y1={125} x2={465} y2={125} stroke="#e5e8ee" strokeWidth={1} />
{(() => {
const maxVal = Math.max(1, ...comparativoSemanal.map((d) => Math.max(d.actual, d.anterior)));
const puntos = (campo: "actual" | "anterior") =>
comparativoSemanal
.map((d, i) => {
const x = 25 + i * ((465 - 25) / (comparativoSemanal.length - 1));
const y = 125 - (d[campo] / maxVal) * 90;
return `${x},${y}`;
})
.join(" ");
return (
<>
<polyline points={puntos("anterior")} fill="none" stroke="#c3c9d4" strokeWidth={2} />
<polyline points={puntos("actual")} fill="none" stroke="#2f6fed" strokeWidth={2.4} />
{comparativoSemanal.map((d, i) => {
const x = 25 + i * ((465 - 25) / (comparativoSemanal.length - 1));
const yA = 125 - (d.actual / maxVal) * 90;
const yP = 125 - (d.anterior / maxVal) * 90;
return (
<g key={d.dia}>
<circle cx={x} cy={yP} r={2.6} fill="#c3c9d4" />
<circle cx={x} cy={yA} r={3.2} fill="#2f6fed" />
<text x={x} y={142} fontSize={9.5} textAnchor="middle" fill="#9aa1b0">
{d.dia}
</text>
</g>
);
})}
</>
);
})()}
</svg>
<div className="flex items-center justify-center gap-4 -mt-1">
<span className="flex items-center gap-1 text-[10px] text-[var(--navy)] font-semibold"><span className="w-3 h-[2.5px] bg-[var(--blue)] inline-block rounded" /> Semana en curso</span>
<span className="flex items-center gap-1 text-[10px] text-[var(--gray-400)] font-semibold"><span className="w-3 h-[2.5px] bg-[#c3c9d4] inline-block rounded" /> Semana anterior</span>
</div>
</>
)}
</div>
</div>

{/* 2. Cambios de aceite */}
<div className="bg-white rounded-2xl border border-[var(--gray-200)] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_1px_2px_rgba(22,33,92,0.04)] h-[460px] flex flex-col">
<div className="flex items-center justify-between gap-2 mb-2.5">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Cambios de aceite</p>
<div className="flex gap-1.5">
<button
type="button"
onClick={() => setFiltroMiniAceite((p) => (p === "urgentes" ? null : "urgentes"))}
className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${filtroMiniAceite === "urgentes" ? "bg-[var(--red)] text-white" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}
>
Urgentes
</button>
<button
type="button"
onClick={() => setFiltroMiniAceite((p) => (p === "siguiente" ? null : "siguiente"))}
className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${filtroMiniAceite === "siguiente" ? "bg-[var(--amber)] text-[#52350a]" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}
>
Próximo
</button>
<button
type="button"
onClick={() => setFiltroMiniAceite((p) => (p === "todos" ? null : "todos"))}
className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${filtroMiniAceite === "todos" ? "bg-[var(--navy)] text-white" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}
>
Todos
</button>
</div>
</div>
<div className="flex-1 overflow-y-auto">
<table className="border-collapse min-w-max w-full">
<thead>
<tr>
{["✔", "ECO", "Unidad", "KM próximo", "%"].map((c) => (
<th key={c} className="text-left text-[9px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap sticky top-0">
{c}
</th>
))}
</tr>
</thead>
<tbody>
{miniAceiteFiltrado.map((c) => {
const { kmSiguiente, porcentaje } = calcularAceite(c);
const colorBarra = porcentaje === null ? "#9aa1b0" : porcentaje > 85 ? "var(--red)" : porcentaje >= 70 ? "var(--amber)" : "var(--green)";
return (
<tr key={c.id} className="border-b border-[var(--gray-200)]">
<td className="px-2 py-1.5 whitespace-nowrap">
<input type="checkbox" checked={c.servicioRealizado} onChange={() => !c.servicioRealizado && iniciarCheckAceite(c)} className="w-3.5 h-3.5 accent-[var(--green)] cursor-pointer" title="Registrar cambio de aceite" />
</td>
<td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{c.eco}</td>
<td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{c.unidad}</td>
<td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{kmSiguiente ?? "—"}</td>
<td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap font-semibold" style={{ color: colorBarra }}>
{porcentaje === null ? "—" : `${porcentaje.toFixed(1)}%`}
</td>
</tr>
);
})}
</tbody>
</table>
{miniAceiteFiltrado.length === 0 && <p className="text-center text-[var(--gray-400)] text-[12px] py-4">Sin registros.</p>}
</div>
</div>

{/* 3. Revision semanal de unidades */}
<div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 h-[460px] flex flex-col">
<div className="flex items-center justify-between gap-2 mb-2">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">REVISION SEMANAL DE UNIDADES</p>
<div className="flex items-center gap-2 shrink-0">
<span className="text-[11px] font-bold text-[var(--navy)] whitespace-nowrap">{totalRevisadasEstaSemana}/{unidadesRegistradas.length} revisadas</span>
<div className="w-[90px] h-[8px] bg-[var(--gray-200)] rounded-full overflow-hidden">
<div
className="h-full rounded-full"
style={{
width: `${Math.min(100, porcentajeAvanceSemanal)}%`,
backgroundColor: porcentajeAvanceSemanal > 95 ? "var(--green)" : porcentajeAvanceSemanal >= 50 ? "#14b8a6" : "#c3c9d4",
}}
/>
</div>
<span className="text-[11px] font-bold text-[var(--navy)] whitespace-nowrap">{porcentajeAvanceSemanal.toFixed(0)}%</span>
</div>
</div>
<div className="flex gap-1.5 mb-2.5">
{([
["todos", "Todos"],
["realizados", "Realizados"],
["pendientes", "Pendientes"],
] as const).map(([key, label]) => (
<button
key={key}
type="button"
onClick={() => setFiltroRevisionSemanal(key)}
className={`text-[10.5px] font-bold px-2.5 py-1 rounded-full ${filtroRevisionSemanal === key ? "bg-[var(--navy)] text-white" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}
>
{label}
</button>
))}
</div>
<div className="flex-1 overflow-y-auto min-h-0">
<table className="border-collapse min-w-max w-full">
<thead>
<tr>
{["ECO", "Modelo/Tipo", "Inspección semanal", "Fecha de revisión", "Comentarios", ""].map((c) => (
<th key={c} className="text-left text-[9px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap sticky top-0">
{c}
</th>
))}
</tr>
</thead>
<tbody>
{unidadesRevisionFiltradas.map(({ u, info, revisadaEstaSemana }) => {
const eco = u["ECO"];
return (
<tr key={eco} className="border-b border-[var(--gray-200)]" style={revisadaEstaSemana ? { backgroundColor: "rgba(33,168,102,0.18)" } : undefined}>
<td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{eco}</td>
<td className="px-2 py-1.5 text-[11.5px] whitespace-nowrap">{u["Modelo/Tipo"] || "—"}</td>
<td className="px-2 py-1.5 whitespace-nowrap">
<Link
href={`/checklist?eco=${encodeURIComponent(eco)}`}
className={`inline-block text-white text-[10px] font-bold rounded-full px-2.5 py-1 no-underline whitespace-nowrap ${revisadaEstaSemana ? "bg-[var(--green)]" : "bg-[var(--blue)]"}`}
>
Realizar Check List
</Link>
</td>
<td className="px-2 py-1.5 text-[11px] whitespace-nowrap text-[var(--gray-400)]">
{info ? new Date(info.fechaHora).toLocaleDateString("es-MX", { weekday: "short", day: "2-digit", month: "short" }) : "—"}
</td>
<td className="px-2 py-1.5 min-w-[160px]">
<input
defaultValue={comentariosRevision[eco] || ""}
onBlur={(e) => guardarComentarioRevision(eco, e.target.value)}
placeholder="Escribe un comentario..."
className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-full"
/>
</td>
<td className="px-2 py-1.5 whitespace-nowrap text-center">
{info ? (
<Link href={`/checklist?id=${info.id}`} className="text-[var(--blue)]" title="Ver último checklist registrado">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
</Link>
) : (
<span className="text-[var(--gray-400)]" title="Sin checklist registrado">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
</span>
)}
</td>
</tr>
);
})}
</tbody>
</table>
{unidadesRevisionFiltradas.length === 0 && <p className="text-center text-[var(--gray-400)] text-[12px] py-4">Sin unidades para mostrar.</p>}
</div>
<div className="shrink-0 pt-2.5 mt-1 border-t border-[var(--gray-100)] flex flex-wrap items-center gap-2">
<button
type="button"
onClick={descargarTodoChecklist}
disabled={descargandoTodo}
className="text-[10.5px] font-bold text-[var(--gray-400)] hover:text-[var(--navy)] disabled:opacity-60"
>
{descargandoTodo ? "Generando..." : "Descargar todo (Excel + fotos)"}
</button>
<span className="text-[var(--gray-200)]">|</span>
<button
type="button"
onClick={liberarEspacioNube}
disabled={liberandoEspacio}
className="text-[10.5px] font-bold text-[var(--red)] hover:text-[#a12817] disabled:opacity-60"
>
{liberandoEspacio ? "Liberando..." : "Liberar espacio en la nube"}
</button>
{mensajeDescarga && <span className="text-[10px] text-[var(--blue)] w-full">{mensajeDescarga}</span>}
</div>
</div>

{/* 4. Historial de mantenimientos por unidad */}
<div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 h-[460px] flex flex-col">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-3">Historial de mantenimientos por unidad</p>
<div className="relative mb-3">
<div className="flex items-center gap-2 bg-white border border-[var(--gray-200)] rounded-lg px-3 py-2">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
<input
value={busquedaHistorialUnidad}
onChange={(e) => {
setBusquedaHistorialUnidad(e.target.value);
setUnidadHistorialSeleccionada(null);
}}
placeholder="Busca una unidad..."
className="flex-1 outline-none text-[12.5px]"
/>
</div>
{sugerenciasHistorialUnidad.length > 0 && !unidadHistorialSeleccionada && (
<div className="absolute z-10 top-full left-0 right-0 bg-white border border-[var(--gray-200)] rounded-lg shadow-md mt-1 max-h-[180px] overflow-y-auto">
{sugerenciasHistorialUnidad.map((eco) => (
<div
key={eco}
onClick={() => {
setUnidadHistorialSeleccionada(eco);
setBusquedaHistorialUnidad(eco);
}}
className="px-3 py-2 text-[12.5px] text-[var(--navy)] cursor-pointer hover:bg-[var(--gray-100)]"
>
{eco}
</div>
))}
</div>
)}
</div>
<div className="flex-1 flex items-center justify-center">
<p className="text-center text-[var(--blue)] text-[12.5px] m-0">{unidadHistorialSeleccionada ? `Detalle de ${unidadHistorialSeleccionada} (próximamente).` : "Selecciona una unidad para ver su detalle."}</p>
</div>
</div>
</div>
)}
{seccionActiva === "aceite" && (
<div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-5">
<div className="flex flex-wrap items-center justify-between gap-2.5 mb-3.5">
<h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Cambios de aceite</h3>
<div className="flex flex-wrap items-center gap-2.5">
<button type="button" onClick={agregarCambioAceite} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
+ Agregar
</button>
<button type="button" onClick={quitarSeleccionAceite} className="flex items-center gap-1.5 bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-3.5 py-1.5 text-[12px] font-bold">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
Quitar selección
</button>
{!cargandoAceite && cambiosAceite.length > 0 && (
<button type="button" onClick={exportarCambiosAceite} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Exportar Excel
</button>
)}
</div>
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
const estiloFila = c.servicioRealizado
? { backgroundColor: "rgba(33,168,102,0.12)" }
: urgente
? { backgroundColor: "rgba(226,65,44,0.12)" }
: undefined;
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
)}
<PageFooter />
</div>
{/* Nueva orden */}
{nuevaOrdenAbierta && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[520px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Nueva orden de mantenimiento</h3>
<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
<div>
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Folio</label>
<input disabled value="Se asigna al guardar" className="w-full border border-[var(--gray-200)] bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[13.5px] text-[var(--gray-400)]" />
</div>
<div>
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fecha</label>
<input disabled value={new Date().toLocaleString("es-MX")} className="w-full border border-[var(--gray-200)] bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
</div>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">ECO. Unidad</label>
{unidadesRegistradas.length === 0 ? (
<p className="text-[12.5px] text-[var(--red)]">No hay unidades registradas. Agrega unidades en la página &quot;Unidades&quot; primero.</p>
) : (
<select value={nEco} onChange={(e) => setNEco(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]">
{unidadesRegistradas.map((u, i) => (
<option key={i} value={u["ECO"]}>
{u["ECO"]} {u["Unidad"] ? `— ${u["Unidad"]}` : ""}
</option>
))}
</select>
)}
</div>
<div className="mb-6">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Falla detectada</label>
<textarea value={nFalla} onChange={(e) => setNFalla(e.target.value)} rows={3} placeholder="Describe la falla" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setNuevaOrdenAbierta(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button type="button" onClick={guardarNuevaOrden} disabled={unidadesRegistradas.length === 0 || creando} className="bg-[var(--navy)] disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
{creando ? "Guardando..." : "Guardar"}
</button>
</div>
</div>
</div>
)}
{/* Imprimir / descargar orden por folio */}
{imprimirModalAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
<div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Imprimir orden de servicio</h3>
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Folio</label>
<select
value={folioAImprimir}
onChange={(e) => setFolioAImprimir(e.target.value)}
className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-6"
>
{ordenes.map((o) => (
<option key={o.folio} value={o.folio}>
{o.folio} — {o.ecoUnidad} — {ESTADO_INFO[o.estado].label}
</option>
))}
</select>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setImprimirModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button
type="button"
onClick={generarDesdeImprimir}
disabled={generandoImpresion}
className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
>
{generandoImpresion ? "Generando..." : "Generar"}
</button>
</div>
</div>
</div>
)}
{/* Vista previa PDF orden */}
{pdfUrl && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
<div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Orden de servicio</h3>
<iframe src={pdfUrl} className="w-full h-[560px] border border-[var(--gray-200)] rounded-lg" />
<div className="flex gap-2.5 justify-end mt-4">
<button
type="button"
onClick={() => {
URL.revokeObjectURL(pdfUrl);
setPdfUrl(null);
}}
className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold"
>
Cerrar
</button>
<button type="button" onClick={descargarPdfOrden} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Descargar PDF
</button>
</div>
</div>
</div>
)}
{/* Cierre de orden */}
{cierreFolio && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[480px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Cerrar orden — Folio {cierreFolio}</h3>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">¿Quedó bien?</label>
<textarea value={cierreQuedoBien} onChange={(e) => setCierreQuedoBien(e.target.value)} rows={3} placeholder="Captura libre" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="mb-6">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-2">Foto de la reparación (obligatoria)</label>
<div className="w-24">
<FotoCard label="Evidencia" foto={cierreFoto} onFoto={(url) => setCierreFoto(url)} />
</div>
</div>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setCierreFolio(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Salir
</button>
<button type="button" onClick={guardarCierre} disabled={guardandoCierre} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
{guardandoCierre ? "Guardando..." : "Guardar"}
</button>
</div>
</div>
</div>
)}

{/* Check rapido de cambio de aceite (mini tabla del dashboard) */}
{aceiteCheckAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[380px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[16px] font-bold text-[var(--navy)] mb-1">Registrar cambio de aceite</h3>
<p className="text-[12.5px] text-[var(--gray-400)] mb-4">
{aceiteCheckAbierto.eco} — {aceiteCheckAbierto.unidad}
</p>
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Kilometraje con el que se realizó el cambio</label>
<input
type="number"
autoFocus
value={aceiteCheckKm}
onChange={(e) => setAceiteCheckKm(e.target.value)}
placeholder="0"
className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-6"
/>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setAceiteCheckAbierto(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button type="button" onClick={confirmarCheckAceite} disabled={guardandoAceiteCheck} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
{guardandoAceiteCheck ? "Guardando..." : "Guardar"}
</button>
</div>
</div>
</div>
)}
</div>
);
}
