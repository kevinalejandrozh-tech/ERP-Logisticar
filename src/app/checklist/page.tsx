"use client";
import { useEffect, useMemo, useState } from "react";
import Logo from "@/components/Logo";
import PuntoChecklist from "@/components/PuntoChecklist";
import BarraNivel from "@/components/BarraNivel";
import FotoCard from "@/components/FotoCard";
import MultiFotoUploader from "@/components/MultiFotoUploader";
import {
SECCIONES,
TOTAL_PUNTOS,
NIVELES_LABELS,
NIVEL_OPCIONES,
SwitchState,
} from "@/lib/checklistData";
import { UNIDADES, DICTAMEN_OPCIONES, imagenLlantaPorClave } from "@/lib/unidadesData";
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
const FOTOS_LABELS = [
"Vista Frontal",
"Vista lateral izquierda",
"Vista trasera",
"Vista lateral derecha",
];
const FOTOS_INTERIOR_LABELS = ["Vista interior cabina", "Vista interior de caja"];
export default function ChecklistPage() {
const [ecoUnidad, setEcoUnidad] = useState(UNIDADES[0]?.eco || "");
const [kmActual, setKmActual] = useState("");
const [modoSoloLectura, setModoSoloLectura] = useState(false);
const [registroVista, setRegistroVista] = useState<{ folio: string; descripcion_unidad: string | null; placas: string | null; fecha_hora: string } | null>(null);
const [cargandoVista, setCargandoVista] = useState(false);
const [reporteAbierto, setReporteAbierto] = useState(false);
const [cargandoReporte, setCargandoReporte] = useState(false);
const [filasReporte, setFilasReporte] = useState<FilaReporte[]>([]);
const [filtroReporte, setFiltroReporte] = useState<"todas" | "ok" | "con_detalles">("todas");
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
return {
eco: u.eco,
descripcion: r?.descripcion_unidad || u.descripcion || "",
placas: r?.placas || u.placa || "",
estado,
fechaHora: r?.fecha_hora || null,
detalles,
};
});
setFilasReporte(filas);
} catch {
setFilasReporte([]);
} finally {
setCargandoReporte(false);
}
};
const unidadSeleccionada = useMemo(
() => UNIDADES.find((u) => u.eco === ecoUnidad),
[ecoUnidad]
);
const [fotos, setFotos] = useState<Record<string, string | null>>({});
const [fotosLibres, setFotosLibres] = useState<string[]>([]);
const [llantasComentario, setLlantasComentario] = useState("");
const [llantasDictamen, setLlantasDictamen] = useState(DICTAMEN_OPCIONES[0]);
const [llantasFotos, setLlantasFotos] = useState<string[]>([]);
const [niveles, setNiveles] = useState<Record<string, number>>({});
const [nivelesLitros, setNivelesLitros] = useState<Record<string, string>>({});
const [nivelesObs, setNivelesObs] = useState<Record<string, string>>({});
const [checklist, setChecklist] = useState<Record<string, PuntoState>>({});
const [guardando, setGuardando] = useState(false);
const [mensaje, setMensaje] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
const setPunto = (key: string, valor: SwitchState) =>
setChecklist((prev) => ({
...prev,
[key]: {
valor,
comentarioActivo: prev[key]?.comentarioActivo ?? false,
comentario: prev[key]?.comentario ?? "",
},
}));
const toggleComentario = (key: string) =>
setChecklist((prev) => ({
...prev,
[key]: {
valor: prev[key]?.valor ?? null,
comentarioActivo: !(prev[key]?.comentarioActivo ?? false),
comentario: prev[key]?.comentario ?? "",
},
}));
const setComentario = (key: string, comentario: string) =>
setChecklist((prev) => ({
...prev,
[key]: {
valor: prev[key]?.valor ?? null,
comentarioActivo: prev[key]?.comentarioActivo ?? false,
comentario,
},
}));
useEffect(() => {
const params = new URLSearchParams(window.location.search);
const id = params.get("id");
if (!id) return;
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
const estadoLlantas = r.estado_llantas || {};
setLlantasComentario(estadoLlantas.comentario || "");
setLlantasDictamen(estadoLlantas.dictamen || DICTAMEN_OPCIONES[0]);
setLlantasFotos(estadoLlantas.fotos || []);
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
})
.catch(() => setMensaje({ tipo: "error", texto: "No se pudo cargar el registro." }))
.finally(() => setCargandoVista(false));
}, []);
const porcentajeLlenado = useMemo(() => {
const respondidos = Object.values(checklist).filter(
(p) => p.valor === "si" || p.valor === "no"
).length;
return Math.round((respondidos / TOTAL_PUNTOS) * 100);
}, [checklist]);
const guardar = async () => {
if (!ecoUnidad) {
setMensaje({ tipo: "error", texto: "Selecciona el ECO de la unidad." });
return;
}
setGuardando(true);
setMensaje(null);
try {
const nivelesConEtiqueta: Record<string, { nivel: string; litros: string; observaciones: string }> = {};
NIVELES_LABELS.forEach((n) => {
const v = niveles[n.key] || 0;
nivelesConEtiqueta[n.key] = {
nivel: v > 0 ? NIVEL_OPCIONES[v - 1] : "",
litros: nivelesLitros[n.key] ?? "",
observaciones: nivelesObs[n.key] ?? "",
};
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
fotos_libres: fotosLibres,
estado_llantas: {
comentario: llantasComentario,
dictamen: llantasDictamen,
fotos: llantasFotos,
},
niveles: nivelesConEtiqueta,
checklist,
porcentaje_llenado: porcentajeLlenado,
}),
});
let data: any = {};
try {
data = await res.json();
} catch {
throw new Error(
res.status === 413
? "Las fotos son muy pesadas. Vuelve a tomarlas e intenta de nuevo."
: `Error del servidor (${res.status}). Intenta de nuevo.`
);
}
if (!res.ok) throw new Error(data.error || "Error al guardar.");
setMensaje({ tipo: "ok", texto: `Guardado correctamente. Folio: ${data.folio}` });
} catch (err: any) {
setMensaje({ tipo: "error", texto: err?.message || "Error al guardar. Revisa tu conexión." });
} finally {
setGuardando(false);
}
};
return (
<div className="min-h-screen flex justify-center bg-[#dcdfe6] py-6">
<div className="w-full max-w-[430px] bg-white min-h-screen sm:min-h-0 sm:rounded-3xl sm:shadow-xl overflow-hidden pb-28 relative">
<div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-[var(--gray-200)]">
<a href="/" className="text-[var(--blue)] text-xs font-semibold">
← Menú principal
</a>
<div className="flex items-center gap-2">
<Logo size={32} />
<div className="leading-tight">
<p className="font-display font-extrabold text-[var(--red)] text-[12px]">TRANSPORTES</p>
<p className="font-display font-extrabold text-[var(--red)] text-[12px]">LOGISTICAR</p>
</div>
</div>
</div>
<div className="text-center py-2 border-b border-[var(--gray-200)]">
<h1 className="font-display font-extrabold text-[var(--navy)] text-base uppercase tracking-wide">
Check List Diario de Unidades
</h1>
</div>
{!modoSoloLectura && (
<div className="px-4 py-2.5 border-b border-[var(--gray-200)]">
<button
type="button"
onClick={abrirReporte}
className="w-full flex items-center justify-center gap-1.5 bg-[var(--blue-light)] text-[var(--blue)] font-display font-bold text-[11.5px] rounded-lg py-2"
>
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
Reporte de estado de unidades
</button>
</div>
)}
{modoSoloLectura && (
<div className="bg-[var(--blue-light)] px-4 py-2.5 flex items-center justify-between gap-2 border-b border-[var(--gray-200)]">
<span className="text-[11px] font-bold text-[var(--navy)]">
👁 Viendo registro {registroVista ? `· Folio: ${registroVista.folio}` : ""} (solo lectura)
</span>
<a href="/registros" className="text-[11px] text-[var(--blue)] font-bold whitespace-nowrap">
← Registros
</a>
</div>
)}
{cargandoVista && <p className="text-center text-xs text-[var(--gray-400)] py-3">Cargando registro...</p>}
<div className={`px-4 py-4 flex flex-col gap-5 ${modoSoloLectura ? "pointer-events-none" : ""}`}>
<div className="flex items-center gap-3">
<label className="font-display font-extrabold text-[var(--navy)] text-xs whitespace-nowrap">
ECO. UNIDAD
</label>
<select
value={ecoUnidad}
onChange={(e) => setEcoUnidad(e.target.value)}
className="flex-1 h-9 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-2 text-sm"
>
{UNIDADES.map((u) => (
<option key={u.eco} value={u.eco}>
{u.eco}
</option>
))}
</select>
</div>
<div className="flex items-center gap-3">
<label className="font-display font-extrabold text-[var(--navy)] text-xs whitespace-nowrap">
Kilometraje actual
</label>
<input
type="number"
value={kmActual}
onChange={(e) => setKmActual(e.target.value)}
placeholder="0"
className="flex-1 h-9 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md px-3 text-sm"
/>
</div>
<div className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 text-[11.5px] flex flex-col gap-1">
<span>
<b className="text-[var(--navy)]">Descripción de unidad:</b> {(modoSoloLectura ? registroVista?.descripcion_unidad : unidadSeleccionada?.descripcion) || "—"}
</span>
<span>
<b className="text-[var(--navy)]">Placas:</b> {(modoSoloLectura ? registroVista?.placas : unidadSeleccionada?.placa) || "—"}
</span>
</div>
<div>
<div className="flex justify-between text-[11px] text-[var(--text)] mb-1">
<span>Llenado del formato</span>
<span className="font-semibold text-[var(--blue)]">{porcentajeLlenado}%</span>
</div>
<div className="h-2 rounded-full bg-[var(--gray-200)] overflow-hidden">
<div className="h-full bg-[var(--blue)]" style={{ width: `${porcentajeLlenado}%` }} />
</div>
</div>
<div>
<p className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-2.5">
Evidencia de estado físico de la unidad
</p>
<div className="grid grid-cols-4 gap-2">
{FOTOS_LABELS.map((label) => (
<FotoCard
key={label}
label={label}
foto={fotos[label] || null}
onFoto={(dataUrl) => setFotos((prev) => ({ ...prev, [label]: dataUrl }))}
/>
))}
</div>
</div>
<div>
<p className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-2.5">
Estado de llantas
</p>
<div className="border border-[var(--gray-200)] rounded-lg p-3.5 flex gap-3">
<div className="w-[42%] shrink-0">
{unidadSeleccionada && (
// eslint-disable-next-line @next/next/no-img-element
<img
src={imagenLlantaPorClave(unidadSeleccionada.clave)}
alt="Configuración de llantas"
className="w-full rounded-md"
/>
)}
</div>
<div className="flex-1 flex flex-col gap-2">
<h3 className="font-display font-extrabold text-[var(--navy)] text-xs">
Estado en general de las llantas
</h3>
<label className="text-[11px] font-bold text-[var(--blue)]">Comentarios</label>
<textarea
value={llantasComentario}
onChange={(e) => setLlantasComentario(e.target.value)}
placeholder="Captura libre"
rows={2}
className="w-full bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md p-2 text-[11.5px] outline-none"
/>
<div className="flex items-center gap-2">
<label className="text-[11px] font-bold whitespace-nowrap">Dictamen</label>
<select
value={llantasDictamen}
onChange={(e) => setLlantasDictamen(e.target.value)}
className="flex-1 h-7 bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-md text-[11px] px-1"
>
{DICTAMEN_OPCIONES.map((op) => (
<option key={op} value={op}>
{op}
</option>
))}
</select>
</div>
<span className="text-[10.5px] font-bold text-[var(--blue)]">Evidencia de estado de llantas</span>
<MultiFotoUploader fotos={llantasFotos} onChange={setLlantasFotos} />
</div>
</div>
</div>
<div>
<p className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-2.5">
Revisión de niveles
</p>
<div className="border border-[var(--gray-200)] rounded-lg overflow-hidden">
<div className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-[var(--green)] border-b border-[var(--gray-200)]">
✎ Revisión de niveles
</div>
<table className="w-full border-collapse">
<thead>
<tr>
{["Punto a revisar", "Nivel", "Litros", "Observaciones"].map((h) => (
<th
key={h}
className="bg-[var(--navy)] text-white text-[8.5px] uppercase font-bold px-1.5 py-2 text-left"
>
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
<BarraNivel
label={n.label}
value={niveles[n.key] || 0}
onChange={(v) => setNiveles((prev) => ({ ...prev, [n.key]: v }))}
/>
</td>
<td className="px-1.5 py-2 w-[40px]">
<input
type="number"
value={nivelesLitros[n.key] ?? ""}
onChange={(e) => setNivelesLitros((prev) => ({ ...prev, [n.key]: e.target.value }))}
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
{SECCIONES.map((sec) => (
<div key={sec.key}>
<div className="border border-[var(--gray-200)] rounded-lg p-3.5">
<h2 className="font-display font-extrabold text-[var(--navy)] text-[13px] uppercase mb-1">
{sec.titulo}
</h2>
{sec.key === "cabina" && (
<div className="grid grid-cols-2 gap-2 mb-3">
{FOTOS_INTERIOR_LABELS.map((label) => (
<FotoCard
key={label}
label={label}
foto={fotos[label] || null}
onFoto={(dataUrl) => setFotos((prev) => ({ ...prev, [label]: dataUrl }))}
/>
))}
</div>
)}
{sec.puntos.map((p) => {
const key = `${sec.key}__${p}`;
const estado = checklist[key];
return (
<PuntoChecklist
key={key}
label={p}
value={estado?.valor ?? null}
comentarioActivo={estado?.comentarioActivo ?? false}
comentario={estado?.comentario ?? ""}
onChange={(v) => setPunto(key, v)}
onToggleComentario={() => toggleComentario(key)}
onComentarioChange={(v) => setComentario(key, v)}
/>
);
})}
</div>
{sec.key === "cabina" && (
<div className="mt-5">
<MultiFotoUploader
titulo="Agrega fotos de los detalles encontrados (si hay)"
fotos={fotosLibres}
onChange={setFotosLibres}
/>
</div>
)}
</div>
))}
</div>
<div className="fixed bottom-0 left-0 right-0 sm:absolute bg-white border-t border-[var(--gray-200)] p-4 max-w-[430px] mx-auto">
{mensaje && (
<p className={`text-xs mb-2 ${mensaje.tipo === "ok" ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
{mensaje.texto}
</p>
)}
{modoSoloLectura ? (
<a
href="/registros"
className="block text-center w-full bg-[var(--navy)] text-white font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3"
>
← Volver a registros guardados
</a>
) : (
<div className="flex gap-2">
<button
type="button"
onClick={guardar}
disabled={guardando}
className="flex-1 bg-[var(--navy)] disabled:opacity-60 text-white font-display font-extrabold uppercase text-xs tracking-wide rounded-lg py-3"
>
{guardando ? "Guardando..." : "Guardar checklist"}
</button>
<button
type="button"
className="flex-1 bg-[var(--amber)] text-white font-display font-extrabold uppercase text-[10.5px] tracking-wide rounded-lg py-3"
>
Generar Orden de Mantenimiento
</button>
</div>
)}
</div>
</div>

{reporteAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.5)] z-50 flex items-end sm:items-center justify-center">
<div className="bg-white w-full sm:max-w-[440px] sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
<div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--gray-200)]">
<h2 className="font-display font-extrabold text-[var(--navy)] text-[13.5px] uppercase">Reporte de estado de unidades</h2>
<span onClick={() => setReporteAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">✕</span>
</div>
<div className="flex gap-1.5 px-4 py-2.5 border-b border-[var(--gray-200)]">
{([
["todas", "Todas"],
["ok", "OK"],
["con_detalles", "Con detalles"],
] as const).map(([key, label]) => (
<button
key={key}
type="button"
onClick={() => setFiltroReporte(key)}
className={`text-[10.5px] font-bold px-2.5 py-1.5 rounded-full ${filtroReporte === key ? "bg-[var(--navy)] text-white" : "bg-[var(--gray-100)] text-[var(--navy)]"}`}
>
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
<span
className={`text-[9.5px] font-bold uppercase px-2 py-0.5 rounded-full whitespace-nowrap ${
f.estado === "ok" ? "bg-[var(--green)] text-white" : f.estado === "con_detalles" ? "bg-[var(--red)] text-white" : "bg-[var(--gray-200)] text-[var(--gray-400)]"
}`}
>
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
</div>
);
}
