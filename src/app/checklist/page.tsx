"use client";
import { useMemo, useState } from "react";
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
<div className="px-4 py-4 flex flex-col gap-5">
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
<b className="text-[var(--navy)]">Descripción de unidad:</b> {unidadSeleccionada?.descripcion || "—"}
</span>
<span>
<b className="text-[var(--navy)]">Placas:</b> {unidadSeleccionada?.placa || "—"}
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
</div>
</div>
</div>
);
}
