"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import FotoCard from "@/components/FotoCard";
import { OPCIONES_CONTENIDO_MOCHILA } from "@/lib/mochilasData";
import { exportarExcel } from "@/lib/exportExcel";
type Articulo = { cantidad: string; descripcion: string };
type Mochila = { folio: string; operador: string; contenido: Articulo[]; foto: string | null; unidad?: string; responsable?: string };
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
declare global {
interface Window {
jspdf: any;
QRious: any;
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
function cargarQRious(): Promise<void> {
return new Promise((resolve, reject) => {
if (window.QRious) {
resolve();
return;
}
const script = document.createElement("script");
script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
script.onload = () => resolve();
script.onerror = () => reject(new Error("No se pudo cargar el generador de código QR."));
document.body.appendChild(script);
});
}
export default function MochilasCovidPage() {
const [mochilas, setMochilas] = useState<Mochila[]>([]);
const [cargando, setCargando] = useState(true);
const [editando, setEditando] = useState<number | null>(null);
const [formAbierto, setFormAbierto] = useState(false);
const [fFolio, setFFolio] = useState("");
const [fOperador, setFOperador] = useState("");
const [fContenido, setFContenido] = useState<Articulo[]>([{ cantidad: "", descripcion: "" }]);
const [fFoto, setFFoto] = useState<string | null>(null);
const [guardando, setGuardando] = useState(false);
const [contenidoVer, setContenidoVer] = useState<Mochila | null>(null);
const [folioModalAbierto, setFolioModalAbierto] = useState(false);
const [folioElegido, setFolioElegido] = useState("");
const [pdfUrl, setPdfUrl] = useState<string | null>(null);
const [pdfFolio, setPdfFolio] = useState("");
const [generando, setGenerando] = useState(false);
const cargar = async () => {
try {
const res = await fetch("/api/mochilas/list");
const data = await res.json();
setMochilas(data.registros || []);
} catch {
// si falla, la lista queda vacia y se puede reintentar
} finally {
setCargando(false);
}
};
useEffect(() => {
cargar();
}, []);
const abrirAgregar = () => {
setEditando(null);
setFFolio("");
setFOperador("");
setFContenido([{ cantidad: "", descripcion: "" }]);
setFFoto(null);
setFormAbierto(true);
};
const abrirEditar = (i: number) => {
const m = mochilas[i];
setEditando(i);
setFFolio(m.folio);
setFOperador(m.operador);
setFContenido(m.contenido.length ? m.contenido : [{ cantidad: "", descripcion: "" }]);
setFFoto(m.foto);
setFormAbierto(true);
};
const guardar = async () => {
if (!fFolio.trim() || !fOperador.trim()) {
alert("Captura el folio y el operador asignado.");
return;
}
const contenido = fContenido.filter((a) => a.descripcion.trim());
setGuardando(true);
try {
const res = await fetch("/api/mochilas", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio: fFolio.trim(), operador: fOperador.trim(), contenido, foto: fFoto }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al guardar.");
setFormAbierto(false);
await cargar();
} catch (err: any) {
alert(err.message || "Error al guardar la mochila.");
} finally {
setGuardando(false);
}
};
const generarPdfParaFolio = async (folio: string) => {
const m = mochilas.find((x) => x.folio === folio);
if (!m) return;
setGenerando(true);
try {
await cargarJsPDF();
const { jsPDF } = window.jspdf;
const doc = new jsPDF({ unit: "pt", format: "letter" });
const marginX = 48;
let y = 50;
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
doc.addImage(logoImg, "PNG", marginX, y - 14, 32, 32);
doc.setFont("helvetica", "bold");
doc.setFontSize(13);
doc.setTextColor(20, 20, 20);
doc.text("TRANSPORTES LOGISTICAR", marginX + 42, y + 6);
const fecha = new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(47, 111, 237);
doc.text(fecha, 612 - marginX, y + 6, { align: "right" });
y += 44;
doc.setDrawColor(229, 232, 238);
doc.line(marginX, y, 612 - marginX, y);
y += 26;
doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.setTextColor(22, 33, 92);
doc.text("Responsiva de asignación de mochila Covid", marginX, y);
y += 26;
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(30, 30, 30);
const p1 = `Por medio del presente documento yo ${m.operador} hago constar que he recibido en calidad de resguardo la mochila foliada como ${m.folio}, la cual contiene equipo de trabajo y equipo de protección personal (EPP), propiedad de la empresa, para el desempeño de las actividades propias de mi puesto.`;
const l1 = doc.splitTextToSize(p1, 612 - marginX * 2);
doc.text(l1, marginX, y);
y += l1.length * 13 + 14;
doc.setFont("helvetica", "bold");
doc.text("Me comprometo a:", marginX, y);
y += 16;
doc.setFont("helvetica", "normal");
const compromisos = [
"Utilice el equipo asignado exclusivamente para fines laborales.",
"Conservar la mochila, herramientas y equipo en buenas condiciones de uso, dando un manejo adecuado conforme a las instrucciones y políticas de la empresa.",
"Reportar de manera inmediata cualquier pérdida, robo, daño o mal funcionamiento de los artículos asignados.",
"No prestar, transferir o permitir el uso del equipo a personas no autorizadas.",
"Mantenga completo el contenido de la mochila conforme al inventario anexo.",
"Devolver la totalidad del equipo en caso de cambio de puesto, sustitución de equipo o al término de la relación laboral, en las mismas condiciones en que fue recibido, considerando el desgaste normal por uso.",
];
compromisos.forEach((c, idx) => {
const lx = doc.splitTextToSize(`${idx + 1}. ${c}`, 612 - marginX * 2 - 14);
doc.text(lx, marginX + 14, y);
y += lx.length * 12.5 + 5;
});
y += 14;
const headerY = y;
doc.setFont("helvetica", "bold");
doc.setFontSize(10.5);
doc.setTextColor(22, 33, 92);
doc.text("Contenido de la mochila", marginX, headerY);
if (m.foto) doc.text("Evidencia", 340, headerY);
y += 16;
let leftY = y;
doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(90, 90, 90);
doc.text("CANT.", marginX, leftY);
doc.text("DESCRIPCIÓN", marginX + 55, leftY);
leftY += 12;
doc.setDrawColor(240, 240, 240);
doc.line(marginX, leftY - 8, 300, leftY - 8);
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(30, 30, 30);
if (m.contenido.length === 0) {
doc.setTextColor(150, 150, 150);
doc.text("Sin artículos registrados.", marginX, leftY);
leftY += 16;
} else {
m.contenido.forEach((c) => {
doc.text(String(c.cantidad || ""), marginX, leftY);
const ld = doc.splitTextToSize(c.descripcion, 300 - marginX - 55);
doc.text(ld, marginX + 55, leftY);
leftY += Math.max(14, ld.length * 13);
});
}
let rightY = y;
if (m.foto) {
try {
doc.addImage(m.foto, "JPEG", 340, rightY, 190, 140);
rightY += 150;
} catch {
// si la imagen falla, se omite sin interrumpir el documento
}
}
y = Math.max(leftY, rightY) + 26;
doc.setFont("helvetica", "normal");
doc.setFontSize(10);
doc.setTextColor(30, 30, 30);
const cierre =
"Declaro haber recibido los artículos descritos en el inventario adjunto, verificando que se encuentran completos y en condiciones adecuadas para su uso, aceptando la responsabilidad de su resguardo y cuidado mientras permanezcan bajo mi custodia.";
const lc = doc.splitTextToSize(cierre, 612 - marginX * 2);
doc.text(lc, marginX, y);
const firmasY = 700;
doc.setDrawColor(60, 60, 60);
doc.line(marginX, firmasY, marginX + 190, firmasY);
doc.line(340, firmasY, 340 + 190, firmasY);
doc.setFont("helvetica", "normal");
doc.setFontSize(9.5);
doc.setTextColor(30, 30, 30);
doc.text(m.operador, marginX + 95, firmasY + 16, { align: "center" });
doc.text("Quien entrega", 340 + 95, firmasY + 16, { align: "center" });
const blob = doc.output("blob");
if (pdfUrl) URL.revokeObjectURL(pdfUrl);
const url = URL.createObjectURL(blob);
setPdfUrl(url);
setPdfFolio(m.folio);
setFolioModalAbierto(false);
} catch (err: any) {
alert(err.message || "No se pudo generar el PDF.");
} finally {
setGenerando(false);
}
};
const abrirSelectorFolio = () => {
if (mochilas.length === 0) {
alert("Primero agrega al menos una mochila.");
return;
}
setFolioElegido(mochilas[0].folio);
setFolioModalAbierto(true);
};
const descargarPdf = () => {
if (!pdfUrl) return;
const a = document.createElement("a");
a.href = pdfUrl;
a.download = `Responsiva_${pdfFolio || "mochila"}.pdf`;
document.body.appendChild(a);
a.click();
a.remove();
};
const actualizarArticulo = (i: number, campo: keyof Articulo, valor: string) => {
setFContenido((prev) => prev.map((a, idx) => (idx === i ? { ...a, [campo]: valor } : a)));
};
const eliminar = async (e: React.MouseEvent, folio: string) => {
e.stopPropagation();
if (!confirm(`¿Eliminar la mochila ${folio}? Esta acción no se puede deshacer.`)) return;
try {
const res = await fetch("/api/mochilas/delete", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al eliminar.");
await cargar();
} catch (err: any) {
alert(err.message || "Error al eliminar la mochila.");
}
};
const exportar = () => {
exportarExcel(`Mochilas_Covid_${new Date().toISOString().slice(0, 10)}.xlsx`, [
{
nombre: "Mochilas",
filas: mochilas.map((m) => ({
Folio: m.folio,
Operador: m.operador,
"Cantidad de artículos": m.contenido.length,
Contenido: m.contenido.map((c) => `${c.cantidad} ${c.descripcion}`).join(", "),
})),
},
]);
};

// ---- Generar Etiqueta (gafete PDF 8x10cm con QR) ----
const [etiquetaModalAbierto, setEtiquetaModalAbierto] = useState(false);
const [etFolio, setEtFolio] = useState("");
const [etUnidad, setEtUnidad] = useState("");
const [etResponsable, setEtResponsable] = useState("");
const [generandoEtiqueta, setGenerandoEtiqueta] = useState(false);
const [etiquetaPdfUrl, setEtiquetaPdfUrl] = useState<string | null>(null);
const [etiquetaPdfNombre, setEtiquetaPdfNombre] = useState("");

const abrirEtiqueta = () => {
if (mochilas.length === 0) {
alert("Primero agrega al menos una mochila.");
return;
}
setEtFolio(mochilas[0].folio);
setEtUnidad(mochilas[0].unidad || "");
setEtResponsable(mochilas[0].operador || mochilas[0].responsable || "");
setEtiquetaModalAbierto(true);
};

const cambiarEtFolio = (folio: string) => {
setEtFolio(folio);
const m = mochilas.find((x) => x.folio === folio);
setEtUnidad(m?.unidad || "");
setEtResponsable(m?.operador || m?.responsable || "");
};

const generarEtiquetaPdf = async (m: Mochila, unidad: string, responsable: string) => {
await cargarJsPDF();
await cargarQRious();
const { jsPDF } = window.jspdf;
const cardW = 8;
const cardH = 10;
const doc = new jsPDF({ unit: "cm", format: "a4" });
const pageW = 21;
const fechaTexto = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase();

const gap = 1.5;
const totalW = cardW * 2 + gap;
const offY = 4.2;
const offXFrente = (pageW - totalW) / 2;
const offXReverso = offXFrente + cardW + gap;

// Título de la hoja
doc.setTextColor(22, 33, 92);
doc.setFont("helvetica", "bold");
doc.setFontSize(13);
doc.text(`Gafete — Mochila ${m.folio}`, pageW / 2, 2.2, { align: "center" });
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.setTextColor(120, 120, 120);
doc.text("Recorta por la línea punteada y pega ambas caras espalda con espalda para laminar.", pageW / 2, 2.9, { align: "center" });

const guiaCorte = (x: number, y: number) => {
doc.setDrawColor(150, 150, 150);
doc.setLineWidth(0.015);
doc.setLineDashPattern([0.15, 0.1], 0);
doc.rect(x - 0.08, y - 0.08, cardW + 0.16, cardH + 0.16);
doc.setLineDashPattern([], 0);
};

const etiquetaCara = (x: number, texto: string) => {
doc.setFont("helvetica", "bold");
doc.setFontSize(9);
doc.setTextColor(22, 33, 92);
doc.text(texto, x + cardW / 2, offY - 0.35, { align: "center" });
};

// ---------- FRENTE ----------
guiaCorte(offXFrente, offY);
etiquetaCara(offXFrente, "FRENTE");
{
const x = offXFrente;
const y = offY;
doc.setFillColor(22, 33, 92);
doc.rect(x, y, cardW, 1.0, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text(`MOCHILA COVID - ${m.folio}`, x + cardW / 2, y + 0.62, { align: "center" });

doc.setFillColor(245, 246, 248);
doc.rect(x, y + 1.0, cardW, 0.9, "F");
doc.setTextColor(22, 33, 92);
doc.setFont("helvetica", "bold");
doc.setFontSize(7.5);
doc.text(`UNIDAD: ${unidad || "—"}`, x + cardW / 2, y + 1.38, { align: "center" });
doc.text(`RESPONSABLE: ${responsable || "—"}`, x + cardW / 2, y + 1.75, { align: "center" });

doc.setTextColor(226, 65, 44);
doc.setFont("helvetica", "bold");
doc.setFontSize(9.5);
doc.text("CONTENIDO", x + cardW / 2, y + 2.25, { align: "center" });
doc.setDrawColor(22, 33, 92);
doc.setLineWidth(0.02);
doc.line(x, y + 2.45, x + cardW, y + 2.45);

const photoX = x + 0.3;
const photoY = y + 2.6;
const photoW = cardW - 0.6;
const photoH = y + 9.15 - photoY;
if (m.foto) {
try {
doc.addImage(m.foto, "JPEG", photoX, photoY, photoW, photoH);
} catch {
// si la imagen falla, se deja el recuadro vacio
}
} else {
doc.setDrawColor(210, 210, 210);
doc.rect(photoX, photoY, photoW, photoH);
doc.setTextColor(150, 150, 150);
doc.setFontSize(8);
doc.text("Sin foto de evidencia", x + cardW / 2, photoY + photoH / 2, { align: "center" });
}

doc.setFillColor(22, 33, 92);
doc.rect(x, y + 9.2, cardW, 0.8, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(8);
doc.text(`ACTUALIZACIÓN ${fechaTexto}`, x + cardW / 2, y + 9.68, { align: "center" });
}

// ---------- REVERSO ----------
guiaCorte(offXReverso, offY);
etiquetaCara(offXReverso, "REVERSO");
{
const x = offXReverso;
const y = offY;
doc.setFillColor(22, 33, 92);
doc.rect(x, y, cardW, 1.0, "F");
doc.setTextColor(255, 255, 255);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text(`MOCHILA COVID - ${m.folio}`, x + cardW / 2, y + 0.62, { align: "center" });

doc.setTextColor(226, 65, 44);
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text("CONTENIDO", x + cardW / 2, y + 1.55, { align: "center" });

const tableTop = y + 1.9;
const tableBottom = y + 7.7;
const items = m.contenido || [];
if (items.length === 0) {
doc.setTextColor(150, 150, 150);
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text("Sin artículos registrados.", x + cardW / 2, (tableTop + tableBottom) / 2, { align: "center" });
} else {
const availableH = tableBottom - tableTop;
const rowH = Math.min(0.9, Math.max(0.35, availableH / items.length));
const fontSize = Math.max(8, Math.min(13, rowH * 14));
doc.setFont("helvetica", "normal");
doc.setTextColor(30, 30, 30);
const usedH = rowH * items.length;
let rowY = tableTop + Math.max(0, (availableH - usedH) / 2) + rowH * 0.68;
items.forEach((it) => {
if (rowY > tableBottom + rowH) return;
doc.setFontSize(fontSize);
const texto = `${it.cantidad ? it.cantidad + " " : ""}${it.descripcion}`;
doc.text(texto, x + cardW / 2, rowY, { align: "center" });
rowY += rowH;
});
}

const qrValue = `${window.location.origin}/auditoria-mochila-covid?folio=${encodeURIComponent(m.folio)}`;
const canvas = document.createElement("canvas");
new window.QRious({ element: canvas, value: qrValue, size: 300, level: "M" });
const qrDataUrl = canvas.toDataURL("image/png");
const qrSize = 1.1;
const qrX = x + (cardW - qrSize) / 2;
const qrY = y + 8.0;
doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
doc.setTextColor(90, 90, 90);
doc.setFont("helvetica", "normal");
doc.setFontSize(5.5);
doc.text("Escanea para auditoría", x + cardW / 2, qrY + qrSize + 0.24, { align: "center" });
}

return doc.output("blob");
};

const generarEtiqueta = async () => {
if (!etFolio) {
alert("Selecciona una mochila.");
return;
}
setGenerandoEtiqueta(true);
try {
const res = await fetch("/api/mochilas/etiqueta", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ folio: etFolio, unidad: etUnidad.trim(), responsable: etResponsable.trim() }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al guardar la etiqueta.");
await cargar();
const resListado = await fetch("/api/mochilas/list");
const dataListado = await resListado.json();
const m = (dataListado.registros || []).find((x: Mochila) => x.folio === etFolio);
if (!m) throw new Error("No se encontró la mochila actualizada.");
const blob = await generarEtiquetaPdf(m, etUnidad.trim(), etResponsable.trim());
if (etiquetaPdfUrl) URL.revokeObjectURL(etiquetaPdfUrl);
const url = URL.createObjectURL(blob);
setEtiquetaPdfUrl(url);
setEtiquetaPdfNombre(`Gafete_${etFolio}.pdf`);
setEtiquetaModalAbierto(false);
} catch (err: any) {
alert(err.message || "No se pudo generar la etiqueta.");
} finally {
setGenerandoEtiqueta(false);
}
};

const descargarEtiquetaPdf = () => {
if (!etiquetaPdfUrl) return;
const a = document.createElement("a");
a.href = etiquetaPdfUrl;
a.download = etiquetaPdfNombre || "gafete.pdf";
document.body.appendChild(a);
a.click();
a.remove();
};
return (
<div className="min-h-screen bg-[#eef1f6]">
<div className="max-w-[1440px] mx-auto px-14 pt-10">
<PageHeader
titulo="Mochilas Covid"
subtitulo="Administra la asignación y contenido de las mochilas Covid."
backHref="/personas"
backLabel="Personas"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>}
/>
<div className="bg-white rounded-[18px] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<div className="flex gap-3 mb-4">
<button type="button" onClick={abrirAgregar} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
Agregar / Editar
</button>
<button type="button" onClick={abrirSelectorFolio} disabled={generando} className="flex items-center gap-2 bg-[var(--amber)] text-[#52350a] disabled:opacity-60 rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#52350a" strokeWidth="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
Generar responsiva
</button>
<button type="button" onClick={abrirEtiqueta} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 3v2a1 1 0 001 1h4a1 1 0 001-1V3" /><rect x="8" y="10" width="8" height="6" /></svg>
Generar Etiqueta
</button>
{!cargando && mochilas.length > 0 && (
<button type="button" onClick={exportar} className="ml-auto inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Exportar Excel
</button>
)}
</div>
{cargando ? (
<div className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando mochilas...</div>
) : (
<>
<table className="w-full border-collapse">
<thead>
<tr>
<th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-l-lg">Folio de mochila</th>
<th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3">Operador asignado</th>
<th className="text-left text-[11.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3.5 py-3 rounded-r-lg w-[220px]">Acciones</th>
</tr>
</thead>
<tbody>
{mochilas.map((m, i) => (
<tr key={i} className="border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
<td className="px-3.5 py-3 text-[13.5px]">{m.folio}</td>
<td className="px-3.5 py-3 text-[13.5px]">{m.operador}</td>
<td className="px-3.5 py-3">
<div className="flex items-center gap-4">
<span onClick={() => setContenidoVer(m)} className="inline-flex items-center gap-1.5 text-[var(--blue)] text-[12.5px] font-semibold cursor-pointer">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>
Ver contenido
</span>
<span onClick={() => abrirEditar(i)} className="inline-flex items-center gap-1.5 text-[var(--gray-400)] text-[12.5px] font-semibold cursor-pointer">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
Editar
</span>
<span onClick={(e) => eliminar(e, m.folio)} className="inline-flex items-center gap-1.5 text-[var(--red)] text-[12.5px] font-semibold cursor-pointer">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
Eliminar
</span>
</div>
</td>
</tr>
))}
</tbody>
</table>
{mochilas.length === 0 && (
<div className="text-center text-[var(--gray-400)] text-[13.5px] py-10">
Aún no hay mochilas registradas. Usa &quot;Agregar / Editar&quot; para crear la primera.
</div>
)}
</>
)}
</div>
<PageFooter />
</div>
{formAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[640px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">{editando !== null ? "Editar mochila" : "Agregar mochila"}</h3>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Folio de mochila</label>
<input disabled={editando !== null} value={fFolio} onChange={(e) => setFFolio(e.target.value)} placeholder="MCH-001" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] disabled:bg-[var(--gray-100)]" />
</div>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Operador asignado</label>
<input value={fOperador} onChange={(e) => setFOperador(e.target.value)} placeholder="Nombre del operador" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="mb-2">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Contenido</label>
<datalist id="opcionesContenido">
{OPCIONES_CONTENIDO_MOCHILA.map((op) => (
<option key={op} value={op} />
))}
</datalist>
<table className="w-full border-collapse mb-2.5">
<thead>
<tr>
<th className="text-left text-[11px] uppercase text-[var(--gray-400)] px-2 py-1.5 w-[90px]">Cantidad</th>
<th className="text-left text-[11px] uppercase text-[var(--gray-400)] px-2 py-1.5">Descripción</th>
<th className="w-6" />
</tr>
</thead>
<tbody>
{fContenido.map((a, i) => (
<tr key={i}>
<td className="px-2 py-1">
<input
value={a.cantidad}
onChange={(e) => actualizarArticulo(i, "cantidad", e.target.value)}
placeholder="1"
className="w-full border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[13px]"
/>
</td>
<td className="px-2 py-1">
<input
value={a.descripcion}
onChange={(e) => actualizarArticulo(i, "descripcion", e.target.value)}
placeholder="Artículo (escribe o elige de la lista)"
list="opcionesContenido"
className="w-full border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[13px]"
/>
</td>
<td className="px-1">
<span
onClick={() => setFContenido((prev) => prev.filter((_, idx) => idx !== i))}
className="text-[var(--red)] cursor-pointer text-base px-1.5"
>
×
</span>
</td>
</tr>
))}
</tbody>
</table>
<div
onClick={() => setFContenido((prev) => [...prev, { cantidad: "", descripcion: "" }])}
className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--blue)] font-semibold cursor-pointer mb-5"
>
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
Agregar artículo
</div>
</div>
<div className="mb-5">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-2">Foto de evidencia</label>
<div className="w-24">
<FotoCard label="Evidencia" foto={fFoto} onFoto={(url) => setFFoto(url)} />
</div>
</div>
<div className="flex gap-2.5 justify-end">
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
{contenidoVer && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
<div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Contenido — {contenidoVer.folio}</h3>
{(contenidoVer.unidad || contenidoVer.responsable) && (
<div className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[12.5px] flex flex-col gap-1 mb-4">
{contenidoVer.unidad && (
<span>
<b className="text-[var(--navy)]">Unidad:</b> {contenidoVer.unidad}
</span>
)}
{contenidoVer.responsable && (
<span>
<b className="text-[var(--navy)]">Responsable:</b> {contenidoVer.responsable}
</span>
)}
</div>
)}
<table className="w-full border-collapse mb-2">
<thead>
<tr>
<th className="text-left text-[11px] text-[var(--gray-400)] px-1 py-1.5 border-b border-[var(--gray-200)]">Cantidad</th>
<th className="text-left text-[11px] text-[var(--gray-400)] px-1 py-1.5 border-b border-[var(--gray-200)]">Descripción</th>
</tr>
</thead>
<tbody>
{contenidoVer.contenido.length === 0 ? (
<tr>
<td colSpan={2} className="py-2.5 text-[var(--gray-400)] text-[13px]">Sin artículos registrados.</td>
</tr>
) : (
contenidoVer.contenido.map((c, i) => (
<tr key={i}>
<td className="py-2 px-1 border-b border-[var(--gray-100)] text-[13px]">{c.cantidad}</td>
<td className="py-2 px-1 border-b border-[var(--gray-100)] text-[13px]">{c.descripcion}</td>
</tr>
))
)}
</tbody>
</table>
{contenidoVer.foto && (
// eslint-disable-next-line @next/next/no-img-element
<img src={contenidoVer.foto} alt="Evidencia" className="w-full rounded-lg border border-[var(--gray-200)] mb-3" />
)}
<div className="flex justify-end">
<button type="button" onClick={() => setContenidoVer(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cerrar
</button>
</div>
</div>
</div>
)}
{folioModalAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
<div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Generar responsiva</h3>
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Folio de la mochila</label>
<select
value={folioElegido}
onChange={(e) => setFolioElegido(e.target.value)}
className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-6"
>
{mochilas.map((m) => (
<option key={m.folio} value={m.folio}>
{m.folio} — {m.operador}
</option>
))}
</select>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setFolioModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button
type="button"
onClick={() => generarPdfParaFolio(folioElegido)}
disabled={generando}
className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
>
{generando ? "Generando..." : "Generar"}
</button>
</div>
</div>
</div>
)}
{pdfUrl && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
<div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Previsualización — Responsiva</h3>
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
<button type="button" onClick={descargarPdf} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Descargar PDF
</button>
</div>
</div>
</div>
)}
{etiquetaModalAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Generar Etiqueta</h3>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Selecciona Mochila</label>
<select
value={etFolio}
onChange={(e) => cambiarEtFolio(e.target.value)}
className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]"
>
{mochilas.map((m) => (
<option key={m.folio} value={m.folio}>
{m.folio} — {m.operador}
</option>
))}
</select>
</div>
<div className="mb-4">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Unidad</label>
<input value={etUnidad} onChange={(e) => setEtUnidad(e.target.value)} placeholder="Ej. ECO-15" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="mb-6">
<label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Responsable</label>
<input value={etResponsable} onChange={(e) => setEtResponsable(e.target.value)} placeholder="Nombre del responsable" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
</div>
<div className="flex gap-2.5 justify-end">
<button type="button" onClick={() => setEtiquetaModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
Cancelar
</button>
<button type="button" onClick={generarEtiqueta} disabled={generandoEtiqueta} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
{generandoEtiqueta ? "Generando..." : "Guardar"}
</button>
</div>
</div>
</div>
)}
{etiquetaPdfUrl && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
<div className="bg-white rounded-2xl w-[520px] max-w-[94%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Gafete generado — Frente y reverso</h3>
<iframe src={etiquetaPdfUrl} className="w-full h-[560px] border border-[var(--gray-200)] rounded-lg" />
<div className="flex gap-2.5 justify-end mt-4">
<button
type="button"
onClick={() => {
URL.revokeObjectURL(etiquetaPdfUrl);
setEtiquetaPdfUrl(null);
}}
className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold"
>
Cerrar
</button>
<button type="button" onClick={descargarEtiquetaPdf} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Descargar PDF
</button>
</div>
</div>
</div>
)}
</div>
);
}
