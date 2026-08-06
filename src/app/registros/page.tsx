"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { exportarExcel } from "@/lib/exportExcel";
type Registro = {
id: number;
folio: string;
eco_unidad: string;
descripcion_unidad: string | null;
placas: string | null;
fecha_hora: string;
porcentaje_llenado: number | null;
};
export default function RegistrosPage() {
const [registros, setRegistros] = useState<Registro[]>([]);
const [cargando, setCargando] = useState(true);
const [descargando, setDescargando] = useState(false);
const [liberando, setLiberando] = useState(false);
const [mensaje, setMensaje] = useState("");
const cargar = async () => {
setCargando(true);
const res = await fetch("/api/checklist/list");
const data = await res.json();
setRegistros(data.registros || []);
setCargando(false);
};
useEffect(() => {
cargar();
}, []);
const descargar = async () => {
setDescargando(true);
setMensaje("");
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
a.download = `Checklist_Unidades_${new Date()
.toISOString()
.slice(0, 10)}.zip`;
document.body.appendChild(a);
a.click();
a.remove();
URL.revokeObjectURL(url);
setMensaje("Descarga completa. Guárdala en tu PC antes de liberar espacio.");
} catch (err: any) {
setMensaje(err.message);
} finally {
setDescargando(false);
}
};
const liberarEspacio = async () => {
if (
!confirm(
"¿Ya guardaste el archivo descargado en tu PC? Esto borrará todos los registros de la nube de forma permanente."
)
)
return;
setLiberando(true);
setMensaje("");
try {
const res = await fetch("/api/checklist/clear", { method: "POST" });
const data = await res.json();
if (!res.ok) throw new Error(data.error);
setMensaje(`Se liberaron ${data.borrados} registros de la nube.`);
cargar();
} catch (err: any) {
setMensaje(err.message);
} finally {
setLiberando(false);
}
};
const eliminarRegistro = async (id: number, eco: string) => {
if (!confirm(`¿Eliminar el registro de ${eco}? Esta acción no se puede deshacer.`)) return;
try {
const res = await fetch("/api/checklist/clear", {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({ ids: [id] }),
});
const data = await res.json();
if (!res.ok) throw new Error(data.error || "Error al eliminar.");
await cargar();
} catch (err: any) {
setMensaje(err.message || "Error al eliminar el registro.");
}
};
const exportarSoloExcel = () => {
exportarExcel(`Checklist_Unidades_${new Date().toISOString().slice(0, 10)}.xlsx`, [
{
nombre: "Registros",
filas: registros.map((r) => ({
Folio: r.folio,
"ECO Unidad": r.eco_unidad,
"Descripción de unidad": r.descripcion_unidad || "",
Placas: r.placas || "",
"Fecha y hora": new Date(r.fecha_hora).toLocaleString("es-MX"),
"% Llenado": r.porcentaje_llenado ?? 0,
})),
},
]);
};
return (
<div className="min-h-screen bg-[#dcdfe6] px-4 py-6 pb-24">
<div className="max-w-[430px] mx-auto">
<div className="flex items-center gap-3 mb-6">
<Logo size={32} />
<div>
<p className="font-display font-bold text-sm text-[var(--navy)]">Registros guardados</p>
<p className="text-xs text-[var(--gray-400)]">Checklist de unidades</p>
</div>
</div>
<Link href="/checklist" className="text-xs text-[var(--blue)] font-semibold">
← Volver al checklist
</Link>
<div className="mt-5 bg-white rounded-xl border border-[var(--gray-200)] p-4">
<div className="flex items-center justify-between mb-3">
<h2 className="font-display text-sm font-bold text-[var(--navy)]">
{cargando ? "Cargando..." : `${registros.length} registros en la nube`}
</h2>
<button onClick={cargar} className="text-xs text-[var(--blue)] font-semibold">
Actualizar
</button>
</div>
{!cargando && registros.length > 0 && (
<button onClick={exportarSoloExcel} className="inline-flex items-center gap-1.5 text-[11px] text-[var(--gray-400)] mb-2">
<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
Exportar Excel
</button>
)}
{!cargando && registros.length === 0 && (
<p className="text-sm text-[var(--gray-400)]">Aún no hay registros guardados.</p>
)}
<div className="divide-y divide-[var(--gray-200)]">
{registros.map((r) => (
<div key={r.id} className="py-2 text-sm">
<div className="flex justify-between items-start gap-2">
<span className="font-semibold">{r.eco_unidad}</span>
<div className="flex items-center gap-2 shrink-0">
<span className="text-[var(--gray-400)] text-xs">
{new Date(r.fecha_hora).toLocaleString("es-MX")}
</span>
<span onClick={() => eliminarRegistro(r.id, r.eco_unidad)} className="text-[var(--red)] cursor-pointer">
<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
</span>
</div>
</div>
<div className="text-xs text-[var(--gray-400)]">
Folio: {r.folio} · Placas: {r.placas || "—"} · {r.porcentaje_llenado ?? 0}% llenado
</div>
</div>
))}
</div>
</div>
{mensaje && <p className="mt-4 text-xs text-[var(--blue)]">{mensaje}</p>}
<div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[var(--gray-200)] p-4 space-y-2 max-w-[430px] mx-auto">
<button
onClick={descargar}
disabled={descargando || registros.length === 0}
className="w-full bg-[var(--navy)] disabled:opacity-50 text-white font-display font-bold rounded-lg py-3"
>
{descargando ? "Generando descarga..." : "Descargar todo (Excel + fotos)"}
</button>
<button
onClick={liberarEspacio}
disabled={liberando || registros.length === 0}
className="w-full bg-[var(--red)] disabled:opacity-50 text-white font-display font-bold rounded-lg py-3"
>
{liberando ? "Liberando..." : "Liberar espacio en la nube"}
</button>
</div>
</div>
</div>
);
}
