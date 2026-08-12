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
const [seccionActiva, setSeccionActiva] = useState<"unidades" | "gastos" | "aceite" | null>(null);
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
useEffect(() => {
(async () => {
await Promise.all([cargarOrdenes(), cargarUnidades(), cargarCambiosAceite()]);
setCargando(false);
})();
}, []);
// Sondeo periódico para reflejar cambios hechos desde otros dispositivos
useEffect(() => {
const id = setInterval(() => {
cargarOrdenes();
cargarUnidades();
cargarCambiosAceite();
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
const [filtroMiniAceite, setFiltroMiniAceite] = useState<"urgentes" | "siguiente" | null>(null);
const miniAceiteFiltrado = useMemo(() => {
if (filtroMiniAceite === "urgentes") return cambiosAceite.filter((c) => calcularAceite(c).etiqueta === "Urgente");
if (filtroMiniAceite === "siguiente") return cambiosAceite.filter((c) => calcularAceite(c).etiqueta === "Se programa para la siguiente semana");
return cambiosAceite;
}, [cambiosAceite, filtroMiniAceite]);
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
<button type="button" onClick={abrirRequisicion} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-3 text-[13px] font-bold">
<svg width="15" height="15" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
Requisición de Insumos / servicios
</button>
<button
type="button"
onClick={abrirAutorizaciones}
className={`flex items-center gap-2 rounded-lg px-5 py-3 text-[13px] font-bold ${
pendientes.length > 0 ? "bg-[var(--red)] text-white" : "bg-white text-[var(--navy)] border border-[var(--gray-200)]"
}`}
>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={pendientes.length > 0 ? "#fff" : "#2f6fed"} strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></svg>
Autorizaciones pendientes
{pendientes.length > 0 && (
<span className="bg-white text-[var(--red)] rounded-full w-5 h-5 flex items-center justify-center text-[11px] font-bold">
{pendientes.length}
</span>
)}
</button>
<Link href="/ordenes-servicio/inventario" className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-3 text-[13px] font-bold no-underline">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>
Inventario
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
<div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 md:gap-5 mb-6 items-start">
<div className="flex flex-col gap-3.5 md:gap-5">
<div className="bg-white rounded-2xl border border-[var(--gray-200)] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_1px_2px_rgba(22,33,92,0.04)]">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1.5">Total de unidades en mantenimiento</p>
<p className="text-[24px] md:text-[28px] font-bold text-[var(--navy)] m-0 mb-2.5">{totalUnidadesEnMantenimiento}</p>
<div className="flex flex-col gap-1.5">
<div className="flex items-center justify-between text-[12px]">
<span className="text-[var(--green)] font-semibold">Servicios realizados</span>
<span className="font-bold text-[var(--navy)]">{conteoPorEstado.servicio_realizado}</span>
</div>
<div className="flex items-center justify-between text-[12px]">
<span className="text-[var(--blue)] font-semibold">Servicios activos</span>
<span className="font-bold text-[var(--navy)]">{conteoPorEstado.cerrar_orden}</span>
</div>
<div className="flex items-center justify-between text-[12px]">
<span className="text-[var(--red)] font-semibold">Pendientes de autorización</span>
<span className="font-bold text-[var(--navy)]">{conteoPorEstado.autorizacion_pendiente}</span>
</div>
<div className="flex items-center justify-between text-[12px]">
<span className="text-[#8a5a05] font-semibold">Pendientes de diagnosticar</span>
<span className="font-bold text-[var(--navy)]">{conteoPorEstado.diagnostico_pendiente}</span>
</div>
</div>
</div>
<div className="bg-white rounded-2xl border border-[var(--gray-200)] px-4 sm:px-6 py-4 sm:py-5 shadow-[0_1px_2px_rgba(22,33,92,0.04)]">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1.5">Total de gastos en mantenimiento</p>
<p className="text-[24px] md:text-[28px] font-bold text-[var(--navy)] m-0">${totalGastos.toFixed(2)}</p>
<div className="flex items-center justify-between gap-2 mt-4 mb-2.5">
<p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Cambios de aceite</p>
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
Siguiente semana
</button>
</div>
</div>
<div className="overflow-x-auto max-h-[220px] overflow-y-auto">
<table className="border-collapse min-w-max w-full">
<thead>
<tr>
{["ECO", "Unidad", "KM próximo", "%"].map((c) => (
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
</div>

<div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 h-full">
<p className="text-[12px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-3">Gráfica de costos de reparación</p>
{costosPorEco.length === 0 ? (
<p className="text-center text-[var(--gray-400)] text-[12.5px] py-8">Sin gastos registrados aún.</p>
) : (
(() => {
const maxCosto = Math.max(...costosPorEco.map(([, c]) => c));
const anchoBarra = 46;
const espacio = 18;
const alturaMax = 160;
const anchoSvg = costosPorEco.length * (anchoBarra + espacio) + espacio;
return (
<div className="overflow-x-auto">
<svg viewBox={`0 0 ${anchoSvg} 230`} width={Math.max(anchoSvg, 500)} height="230">
<line x1={0} y1={190} x2={anchoSvg} y2={190} stroke="#e5e8ee" strokeWidth={1} />
{costosPorEco.map(([eco, costo], i) => {
const alto = (costo / maxCosto) * alturaMax;
const x = espacio + i * (anchoBarra + espacio);
const y = 190 - alto;
return (
<g key={eco}>
<rect x={x} y={y} width={anchoBarra} height={alto} rx={5} fill="#2f6fed" />
<text x={x + anchoBarra / 2} y={y - 8} fontSize={10.5} textAnchor="middle" fill="#16215c" fontWeight="bold">
${costo.toFixed(0)}
</text>
<text x={x + anchoBarra / 2} y={207} fontSize={10} textAnchor="middle" fill="#16215c" fontWeight="bold">
{eco}
</text>
</g>
);
})}
</svg>
</div>
);
})()
)}
</div>
</div>
<div className="flex flex-wrap gap-2.5 mb-5">
<button type="button" onClick={() => setSeccionActiva("unidades")} className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "unidades" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}>
Unidades en mantenimiento
</button>
<button type="button" onClick={() => setSeccionActiva("gastos")} className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "gastos" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}>
Gastos en mantenimiento
</button>
<button type="button" onClick={() => setSeccionActiva("aceite")} className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${seccionActiva === "aceite" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}>
Cambios de aceite
</button>
<button type="button" onClick={() => setSeccionActiva(null)} className="text-[13px] font-bold px-5 py-2.5 rounded-lg bg-white border border-[var(--gray-200)] text-[var(--gray-400)]">
Ocultar
</button>
</div>
{seccionActiva === "unidades" && (
<div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-5">
<div className="flex flex-wrap items-center justify-between gap-2.5 mb-4">
<h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Unidades en mantenimiento</h3>
{!cargando && ordenes.length > 0 && (
<button type="button" onClick={exportarUnidadesEnMantenimiento} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Exportar Excel
</button>
)}
</div>
<div className="flex flex-wrap items-end gap-2.5 mb-4">
<div>
<label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Filtrar por estado</label>
<select value={filtroEstadoUnidades} onChange={(e) => setFiltroEstadoUnidades(e.target.value as EstadoOrden | "")} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
<option value="">Todos</option>
{(Object.keys(ESTADO_INFO) as EstadoOrden[]).map((e) => (
<option key={e} value={e}>
{ESTADO_INFO[e].label}
</option>
))}
</select>
</div>
{filtroEstadoUnidades && (
<button type="button" onClick={() => setFiltroEstadoUnidades("")} className="text-[11.5px] text-[var(--red)] font-semibold px-2 py-1.5">
Limpiar filtro
</button>
)}
</div>
<div className="overflow-x-auto">
<table className="border-collapse min-w-max w-full">
<thead>
<tr>
{["Estado", "Folio", "ECO. Unidad", "Unidad", "Detalles", "Fecha de ingreso", "HRS EN TALLER", "COSTO", "Acciones"].map((c) => (
<th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
{c}
</th>
))}
</tr>
</thead>
<tbody>
{ordenesFiltradas.map((o) => {
const info = ESTADO_INFO[o.estado];
const costoReparacion = (o.requisicion || []).reduce((s, it) => s + (parseFloat(it.costo) || 0), 0);
const campoDetalle = o.estado === "diagnostico_pendiente" ? "fallaDetectada" : "diagnostico";
const textoQueSeHace = o.estado === "diagnostico_pendiente" ? o.fallaDetectada : o.diagnostico;
return (
<tr key={o.folio} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]" style={o.estado === "servicio_realizado" ? { backgroundColor: "rgba(33,168,102,0.5)" } : undefined}>
<td className="px-2.5 py-2.5">
<button
type="button"
disabled={!info.clicable}
onClick={() => {
if (o.estado === "diagnostico_pendiente") abrirDiagnostico(o.folio);
if (o.estado === "cerrar_orden") abrirCierre(o.folio);
}}
className={`text-[9.5px] font-bold uppercase px-2 py-1 rounded-full whitespace-nowrap ${info.clases} ${
info.clicable ? "cursor-pointer" : "cursor-default opacity-90"
}`}
>
{info.label}
</button>
</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{o.folio}</td>
<td className="px-2.5 py-2.5 whitespace-nowrap">
<select
value={o.ecoUnidad}
onChange={(e) => {
actualizarOrdenLocal(o.folio, "ecoUnidad", e.target.value);
guardarCampoOrden(o.folio, "ecoUnidad", e.target.value);
}}
className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px]"
>
{unidadesRegistradas.map((u) => (
<option key={u["ECO"]} value={u["ECO"]}>
{u["ECO"]}
</option>
))}
</select>
</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{unidadInfo(o.ecoUnidad)?.["Unidad"] || "—"}</td>
<td className="px-2.5 py-2.5 min-w-[280px]">
<textarea
defaultValue={textoQueSeHace || ""}
onBlur={(e) => {
actualizarOrdenLocal(o.folio, campoDetalle, e.target.value);
guardarCampoOrden(o.folio, campoDetalle, e.target.value);
}}
rows={2}
className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[12px] w-full resize-y"
/>
</td>
<td className="px-2.5 py-2.5 whitespace-nowrap">
<input
type="date"
defaultValue={o.fechaIngreso ? o.fechaIngreso.slice(0, 10) : ""}
onBlur={(e) => {
if (!e.target.value) return;
actualizarOrdenLocal(o.folio, "fechaIngreso", e.target.value);
guardarCampoOrden(o.folio, "fechaIngreso", e.target.value);
}}
className="border border-[var(--gray-200)] rounded px-1.5 py-1 text-[11.5px]"
/>
</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{horasDentroDelTaller(o, tick)}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{costoReparacion > 0 ? `$${costoReparacion.toFixed(2)}` : "—"}</td>
<td className="px-2.5 py-2.5 whitespace-nowrap">
<span onClick={() => eliminarOrden(o.folio)} className="text-[var(--red)] cursor-pointer" title="Eliminar orden">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
</span>
</td>
</tr>
);
})}
</tbody>
</table>
{!cargando && ordenesFiltradas.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin registros.</div>}
{cargando && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">Cargando...</div>}
</div>
</div>
)}
{seccionActiva === "gastos" && (
<div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] mb-5">
<div className="flex items-center justify-between mb-4">
<h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0">Gastos en mantenimiento</h3>
{!cargando && filasGastos.length > 0 && (
<button type="button" onClick={exportarGastos} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Exportar Excel
</button>
)}
</div>
<div className="flex flex-wrap items-end gap-2.5 mb-3.5">
<div>
<label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Folio</label>
<select value={filtroGastoFolio} onChange={(e) => setFiltroGastoFolio(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
<option value="">Todos</option>
{foliosGastos.map((f) => (
<option key={f} value={f}>
{f}
</option>
))}
</select>
</div>
<div>
<label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">ECO. Unidad</label>
<select value={filtroGastoEco} onChange={(e) => setFiltroGastoEco(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]">
<option value="">Todas</option>
{ecosGastos.map((eco) => (
<option key={eco} value={eco}>
{eco}
</option>
))}
</select>
</div>
<div>
<label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Fecha de compra</label>
<input type="date" value={filtroGastoFecha} onChange={(e) => setFiltroGastoFecha(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]" />
</div>
<div>
<label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Descripción</label>
<input value={filtroGastoDescripcion} onChange={(e) => setFiltroGastoDescripcion(e.target.value)} placeholder="Buscar..." className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px]" />
</div>
{(filtroGastoFolio || filtroGastoEco || filtroGastoFecha || filtroGastoDescripcion) && (
<button
type="button"
onClick={() => {
setFiltroGastoFolio("");
setFiltroGastoEco("");
setFiltroGastoFecha("");
setFiltroGastoDescripcion("");
}}
className="text-[11.5px] text-[var(--red)] font-semibold px-2 py-1.5"
>
Limpiar filtros
</button>
)}
</div>
<div className="overflow-x-auto">
<table className="border-collapse min-w-max w-full">
<thead>
<tr>
{["Folio", "Fecha de compra", "Cantidad", "Categoría", "Descripción", "Referencia", "Costo unitario", "Costo total", "Proveedor", "Acciones"].map((c) => (
<th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
{c}
</th>
))}
</tr>
</thead>
<tbody>
{filasGastosFiltradas.map((f) => (
<tr key={f.key} className="border-b border-[var(--gray-200)]">
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.folio}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.fecha}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.cantidad}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.categoria}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.descripcion}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.referencia}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.costoUnitario === "—" ? "—" : `$${f.costoUnitario}`}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.costo ? `$${f.costo}` : "—"}</td>
<td className="px-2.5 py-2.5 text-[12.5px] whitespace-nowrap">{f.proveedor}</td>
<td className="px-2.5 py-2.5 whitespace-nowrap">
<span onClick={() => eliminarGasto(f.folio, f.idxEnOrden)} className="text-[var(--red)] cursor-pointer" title="Eliminar gasto">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
</span>
</td>
</tr>
))}
</tbody>
</table>
{!cargando && filasGastosFiltradas.length === 0 && <div className="text-center text-[var(--gray-400)] text-[13px] py-8">{filasGastos.length === 0 ? "Sin registros." : "Ningún gasto coincide con el filtro."}</div>}
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
{op}
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
{etiqueta}
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
{/* Diagnostico */}
{diagFolio && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[640px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Diagnóstico — Folio {diagFolio}</h3>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">¿Cómo se tiene que arreglar la falla?</label>
<textarea value={diagComo} onChange={(e) => setDiagComo(e.target.value)} rows={2} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">¿Quién va a hacer la reparación?</label>
<input value={diagQuien} onChange={(e) => setDiagQuien(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="mb-2">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">¿Qué necesitamos comprar o hacer?</label>
<table className="w-full border-collapse mb-2.5">
<thead>
<tr>
<th className="text-left text-[11px] uppercase text-[var(--gray-400)] px-2 py-1.5 w-[80px]">Cantidad</th>
<th className="text-left text-[11px] uppercase text-[var(--gray-400)] px-2 py-1.5">Descripción</th>
<th className="text-left text-[11px] uppercase text-[var(--gray-400)] px-2 py-1.5 w-[90px]">Costo</th>
<th className="w-6" />
</tr>
</thead>
<tbody>
{diagItems.map((it, i) => (
<tr key={i}>
<td className="px-2 py-1">
<input value={it.cantidad} onChange={(e) => actualizarDiagItem(i, "cantidad", e.target.value)} placeholder="1" className="w-full border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[13px]" />
</td>
<td className="px-2 py-1">
<input value={it.descripcion} onChange={(e) => actualizarDiagItem(i, "descripcion", e.target.value)} placeholder="Artículo o servicio" className="w-full border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[13px]" />
</td>
<td className="px-2 py-1">
<input value={it.costo} onChange={(e) => actualizarDiagItem(i, "costo", e.target.value)} placeholder="0.00" className="w-full border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[13px]" />
</td>
<td className="px-1">
<span onClick={() => setDiagItems((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--red)] cursor-pointer text-base px-1.5">
×
</span>
</td>
</tr>
))}
</tbody>
</table>
<div onClick={() => setDiagItems((prev) => [...prev, { cantidad: "", descripcion: "", costo: "" }])} className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--blue)] font-semibold cursor-pointer mb-5">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
Agregar artículo
</div>
</div>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setDiagFolio(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button type="button" onClick={guardarDiagnostico} disabled={guardandoDiag} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
{guardandoDiag ? "Guardando..." : "Guardar"}
</button>
</div>
</div>
</div>
)}
{/* Requisición de Insumos / servicios */}
{reqModalAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[1000px] max-w-[96%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Requisición de insumos / servicios</h3>
<div className="overflow-x-auto mb-2.5">
<table className="w-full border-collapse min-w-max">
<thead>
<tr>
{["Folio", "Fecha de compra", "Cantidad", "Categoría", "Descripción", "Referencia", "Costo unitario", "Costo total", "Proveedor", ""].map((c) => (
<th key={c} className="text-left text-[10.5px] uppercase text-[var(--gray-400)] px-2 py-1.5 whitespace-nowrap">
{c}
</th>
))}
</tr>
</thead>
<tbody>
{reqRows.map((r, i) => (
<tr key={i}>
<td className="px-1 py-1">
<select value={r.folio} onChange={(e) => actualizarReqRow(i, "folio", e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[100px]">
{ordenes.map((o) => (
<option key={o.folio} value={o.folio}>
{o.folio}
</option>
))}
</select>
</td>
<td className="px-1 py-1">
<input type="date" value={r.fecha} onChange={(e) => actualizarReqRow(i, "fecha", e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[130px]" />
</td>
<td className="px-1 py-1">
<input value={r.cantidad} onChange={(e) => actualizarReqRow(i, "cantidad", e.target.value)} placeholder="1" className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[60px]" />
</td>
<td className="px-1 py-1">
<input value={r.categoria} onChange={(e) => actualizarReqRow(i, "categoria", e.target.value)} placeholder="Refacción" className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[100px]" />
</td>
<td className="px-1 py-1">
<input value={r.descripcion} onChange={(e) => actualizarReqRow(i, "descripcion", e.target.value)} placeholder="Descripción" className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[160px]" />
</td>
<td className="px-1 py-1">
<input value={r.referencia} onChange={(e) => actualizarReqRow(i, "referencia", e.target.value)} placeholder="Ref." className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[90px]" />
</td>
<td className="px-1 py-1">
<input value={r.costoUnitario} onChange={(e) => actualizarReqRow(i, "costoUnitario", e.target.value)} placeholder="0.00" className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[80px]" />
</td>
<td className="px-1 py-1">
<input value={r.costoTotal} onChange={(e) => actualizarReqRow(i, "costoTotal", e.target.value)} placeholder="0.00" className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[80px]" />
</td>
<td className="px-1 py-1">
<input value={r.proveedor} onChange={(e) => actualizarReqRow(i, "proveedor", e.target.value)} placeholder="Proveedor" className="border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12.5px] w-[110px]" />
</td>
<td className="px-1 py-1">
<span onClick={() => setReqRows((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--red)] cursor-pointer text-base px-1.5">
×
</span>
</td>
</tr>
))}
</tbody>
</table>
</div>
<div
onClick={() => setReqRows((prev) => [...prev, filaReqVacia(ordenes[0]?.folio || "")])}
className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--blue)] font-semibold cursor-pointer mb-6"
>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
Agregar fila
</div>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setReqModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button type="button" onClick={guardarRequisicion} disabled={guardandoReq} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
{guardandoReq ? "Guardando..." : "Guardar"}
</button>
</div>
</div>
</div>
)}

{/* Autorizaciones pendientes */}
{autModalAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[560px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Autorizaciones pendientes</h3>
{!autDesbloqueado ? (
<>
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Contraseña</label>
<input
type="password"
value={autPassword}
onChange={(e) => setAutPassword(e.target.value)}
onKeyDown={(e) => e.key === "Enter" && validarPassword()}
className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-2"
/>
{autError && <p className="text-[var(--red)] text-[12px] mb-3">{autError}</p>}
<div className="flex gap-2.5 justify-end mt-3">
<button type="button" onClick={() => setAutModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button type="button" onClick={validarPassword} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
Ingresar
</button>
</div>
</>
) : (
<>
{pendientes.length === 0 ? (
<p className="text-[13px] text-[var(--gray-400)] mb-4">No hay folios pendientes por autorizar.</p>
) : (
<div className="flex flex-col gap-2.5 mb-4">
{pendientes.map((o) => (
<div key={o.folio} className="border border-[var(--gray-200)] rounded-lg px-4 py-3 flex items-center justify-between">
<div>
<p className="text-[13.5px] font-bold text-[var(--navy)] m-0">Folio {o.folio}</p>
<p className="text-[12px] text-[var(--gray-400)] m-0">{o.ecoUnidad}</p>
</div>
<button
type="button"
onClick={() => autorizar(o.folio)}
disabled={autorizando === o.folio}
className="bg-[var(--green)] disabled:opacity-60 text-white rounded-lg px-4 py-2 text-[12.5px] font-bold"
>
{autorizando === o.folio ? "Autorizando..." : "Autorizar"}
</button>
</div>
))}
</div>
)}
<div className="flex justify-end">
<button type="button" onClick={() => setAutModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cerrar
</button>
</div>
</>
)}
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
</div>
);
}
