"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import MenuCard from "@/components/MenuCard";
import PageFooter from "@/components/PageFooter";
const ICON_STROKE = "#2f6fed";
const sw = { fill: "none", stroke: ICON_STROKE, strokeWidth: 2 };
export default function Home() {
const [almacenamiento, setAlmacenamiento] = useState<{ porcentaje: number; mbUsados: number; mbLimite: number } | null>(null);
useEffect(() => {
fetch("/api/sistema/almacenamiento", { cache: "no-store" })
.then((r) => r.json())
.then((d) => {
if (d.ok) setAlmacenamiento({ porcentaje: d.porcentaje, mbUsados: d.mbUsados, mbLimite: d.mbLimite });
})
.catch(() => {});
}, []);
return (
<div className="min-h-screen bg-[#eef1f6]">
<div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6 md:mb-7">
<div className="flex items-center gap-2.5 md:gap-3.5">
<Logo size={38} />
<div>
<h1 className="font-display text-[17px] md:text-[22px] font-bold text-[var(--navy)] m-0">Gestión Logística</h1>
<p className="text-[11.5px] md:text-[13px] text-[var(--gray-400)] m-0">Transportes Logisticar</p>
</div>
</div>
<div className="flex items-center gap-3 md:gap-5">
<div className="hidden sm:flex items-center gap-2 bg-white border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 w-full sm:w-[200px] md:w-[260px] text-[var(--gray-400)] text-[13.5px]">
<svg width="16" height="16" viewBox="0 0 24 24" {...sw} stroke="#9aa1b0"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
Buscar...
</div>
<div className="hidden md:block w-px h-7 bg-[var(--gray-200)]" />
{almacenamiento && (
<div className="hidden md:flex items-center gap-2" title={`${almacenamiento.mbUsados.toFixed(1)} MB de ${almacenamiento.mbLimite.toFixed(0)} MB usados en la nube`}>
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" /><path d="M12 12v9M9 18l3 3 3-3" /></svg>
<div className="w-[70px] h-[6px] bg-[var(--gray-200)] rounded-full overflow-hidden">
<div className="h-full rounded-full" style={{ width: `${Math.min(100, almacenamiento.porcentaje)}%`, backgroundColor: almacenamiento.porcentaje > 85 ? "var(--red)" : almacenamiento.porcentaje > 60 ? "var(--amber)" : "var(--blue)" }} />
</div>
<span className="text-[11px] font-bold text-[var(--gray-400)]">{almacenamiento.porcentaje.toFixed(0)}%</span>
</div>
)}
<div className="hidden md:block w-px h-7 bg-[var(--gray-200)]" />
<div className="flex items-center gap-2">
<div className="w-8 h-8 rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0">
<svg width="16" height="16" viewBox="0 0 24 24" {...sw}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>
</div>
<span className="hidden lg:inline text-[13.5px] font-semibold text-[var(--navy)]">Nombre de usuario</span>
<svg className="hidden lg:block" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
</div>
<svg className="hidden sm:block shrink-0" width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.9 2 2 0 11-2.8 2.8 1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.6 1.7 1.7 0 00-1.9.3 2 2 0 11-2.8-2.8 1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.9 2 2 0 112.8-2.8 1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3 2 2 0 112.8 2.8 1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
</div>
</div>
<div className="flex flex-wrap gap-2.5 md:gap-3.5 mb-6">
<Link href="/menu-dia" className="flex items-center gap-2 bg-[var(--blue)] text-white rounded-full px-4 md:px-6 py-2.5 md:py-3 text-[11.5px] md:text-[13px] font-bold uppercase tracking-wide no-underline">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M6 2v20M6 2c-2 0-3 1.5-3 3.5S4 9 6 9M18 2v20M18 2a3.5 3.5 0 013.5 3.5v3a3.5 3.5 0 01-3.5 3.5" /></svg>
Menú del día
</Link>
</div>
<div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-[18px]">
<MenuCard
href="/unidades"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
titulo="Unidades"
descripcion="Administra y consulta la información de las unidades."
/>
<MenuCard
href="/personas"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15 14c2.6.2 5 2.1 5 6" /></svg>}
titulo="Personas"
descripcion="Gestiona la información del personal del sistema."
/>
<MenuCard
href="/buzon-sugerencias"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><path d="M12 2C7 2 3 5 3 9c0 2.4 1.4 4.5 3.5 5.8V21l4-2.2c.5.1 1 .2 1.5.2 5 0 9-3 9-7s-4-7-9-7z" /></svg>}
titulo="Buzón de sugerencias e ideas de mejora"
descripcion="Comparte o consulta sugerencias e ideas de mejora del equipo, vía código QR."
/>
</div>
</div>
<PageFooter />
</div>
</div>
);
}
