"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { CAMPOS_UNIDAD } from "@/lib/unidadFormData";
type RegistroUnidad = Record<string, string>;
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
export default function UnidadesPage() {
const [registros, setRegistros] = useState<RegistroUnidad[]>([]);
const [cargando, setCargando] = useState(true);
const [formAbierto, setFormAbierto] = useState(false);
const [editando, setEditando] = useState<number | null>(null);
const [valores, setValores] = useState<RegistroUnidad>({});
const [guardando, setGuardando] = useState(false);
const [mensaje, setMensaje] = useState("");
const cargar = async () => {
try {
const res = await fetch("/api/unidades/list");
const data = await res.json();
setRegistros(data.registros || []);
} catch {
setMensaje("No se pudieron cargar las unidades. Revisa tu conexión.");
} finally {
setCargando(false);
}
};
useEffect(() => {
cargar();
}, []);
const abrirFormulario = () => {
setEditando(null);
setValores({});
setFormAbierto(true);
};
const editar = (i: number) => {
setEditando(i);
setValores(registros[i]);
setFormAbierto(true);
};
const guardar = async () => {
if (!valores["ECO"]?.trim()) {
alert("Captura al menos el campo ECO.");
return;
}
setGuardando(true);
try {
const res = await fetch("/api/unidades", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify(valores),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al guardar.");
setFormAbierto(false);
await cargar();
} catch (err: any) {
alert(err.message || "Error al guardar la unidad.");
} finally {
setGuardando(false);
}
};
return (
<div className="min-h-screen bg-[#eef1f6]">
<div className="max-w-[1440px] mx-auto px-14 pt-10">
<PageHeader
titulo="Unidades"
subtitulo="Administra y consulta la información de las unidades."
backHref="/"
backLabel="Menú principal"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
/>
<div className="bg-white rounded-[18px] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<div className="flex items-center gap-3 mb-5">
<button type="button" onClick={abrirFormulario} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
Agregar / Editar
</button>
{mensaje && <p className="text-[12.5px] text-[var(--red)] m-0">{mensaje}</p>}
</div>
{cargando ? (
<div className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando unidades...</div>
) : registros.length === 0 ? (
<div className="text-center text-[var(--gray-400)] text-[13.5px] py-10">
Aún no hay unidades registradas. Usa &quot;Agregar / Editar&quot; para crear la primera.
</div>
) : (
<div className="overflow-x-auto">
<table className="border-collapse min-w-max">
<thead>
<tr>
{CAMPOS_UNIDAD.map((c) => (
<th key={c} className="text-left text-[10.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3 py-2.5 whitespace-nowrap">
{c}
</th>
))}
</tr>
</thead>
<tbody>
{registros.map((r, i) => (
<tr key={i} onClick={() => editar(i)} className="cursor-pointer border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)]">
{CAMPOS_UNIDAD.map((c) => (
<td key={c} className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">
{r[c] || "—"}
</td>
))}
</tr>
))}
</tbody>
</table>
</div>
)}
</div>
<PageFooter />
</div>
{formAbierto && (
<div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
<div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[86vh] overflow-y-auto">
<h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">{editando !== null ? "Editar unidad" : "Agregar unidad"}</h3>
<div className="grid grid-cols-2 gap-x-4 gap-y-3.5 mb-6">
{CAMPOS_UNIDAD.map((campo) => (
<div key={campo}>
<label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">{campo}</label>
<input
disabled={editando !== null && campo === "ECO"}
value={valores[campo] || ""}
onChange={(e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }))}
className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] disabled:bg-[var(--gray-100)]"
/>
</div>
))}
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
</div>
);
}
