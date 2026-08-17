"use client";
import Link from "next/link";
import Logo from "@/components/Logo";
import MenuCard from "@/components/MenuCard";
import PageFooter from "@/components/PageFooter";
const ICON_STROKE = "#2f6fed";
const sw = { fill: "none", stroke: ICON_STROKE, strokeWidth: 2 };
function semanaISO(fecha: Date): number {
  const d = new Date(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()));
  const diaSemana = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - diaSemana);
  const inicioAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - inicioAnio.getTime()) / 86400000 + 1) / 7);
}
export default function Home() {
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
<Link href="/monitoreo-viajes" className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-full px-4 md:px-6 py-2.5 md:py-3 text-[11.5px] md:text-[13px] font-bold uppercase tracking-wide no-underline">
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>
PLAN DE CARGAS SEM. {semanaISO(new Date())}
</Link>
<button type="button" className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-full px-4 md:px-6 py-2.5 md:py-3 text-[11.5px] md:text-[13px] font-bold uppercase tracking-wide">
<svg width="16" height="16" viewBox="0 0 24 24" {...sw}><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>
Check list de accesorios GPS
</button>
</div>
<div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 md:gap-[18px]">
<MenuCard
href="/plan-trabajo"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
titulo="Plan de trabajo y seguimiento"
descripcion="Crea, asigna y da seguimiento a los planes de trabajo."
/>
<MenuCard
href="/ordenes-servicio/inventario"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>}
titulo="Almacén de insumos y refacciones"
descripcion="Controla el inventario de insumos y refacciones."
/>
<MenuCard
href="/monitoreo-viajes"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><path d="M21 10c0 6-9 12-9 12s-9-6-9-12a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>}
titulo="Monitoreo de viajes y rutas"
descripcion="Consulta el monitoreo en tiempo real de viajes y rutas."
/>
<MenuCard
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><path d="M3 11l18-5v12L3 14v-3z" /><path d="M11 13v4a2 2 0 002 2" /></svg>}
titulo="Atención a clientes / Facturación"
descripcion="Gestiona solicitudes y da seguimiento a facturación."
/>
<MenuCard
href="/ordenes-servicio"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 4H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-3" /><path d="M9 14l2 2 4-4" /></svg>}
titulo="Órdenes de servicio y mantenimiento"
descripcion="Gestiona órdenes de servicio y mantenimiento."
/>
<MenuCard
href="/scanner"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" /><circle cx="12" cy="12.5" r="3" /><path d="M3 10h18" /></svg>}
titulo="Logis SCANNER"
descripcion="Escanea documentos y expórtalos a PDF con calidad profesional."
/>
<MenuCard
href="/unidades"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
titulo="Unidades"
descripcion="Administra y consulta la información de las unidades."
/>
<MenuCard
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
titulo="Liquidaciones"
descripcion="Administra las liquidaciones de viajes y gastos."
/>
<MenuCard
href="/personas"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15 14c2.6.2 5 2.1 5 6" /></svg>}
titulo="Personas"
descripcion="Gestiona la información del personal del sistema."
/>
<MenuCard
href="/reportes"
icono={<svg width="20" height="20" viewBox="0 0 24 24" {...sw}><path d="M3 3v18h18M8 17V9M13 17V5M18 17v-7" /></svg>}
titulo="Reportes"
descripcion="Consulta y genera reportes clave del sistema."
/>
</div>
<Link
href="/registros"
className="mt-4 border border-[var(--gray-200)] rounded-xl px-5 py-4 flex items-center gap-3.5 no-underline"
>
<div className="w-10 h-10 rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0">
<svg width="18" height="18" viewBox="0 0 24 24" {...sw}><path d="M7 18a4.5 4.5 0 01-1-8.9A5 5 0 0116 8a4 4 0 011 7.9" /><path d="M12 12v8M9 17l3 3 3-3" /></svg>
</div>
<div>
<h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0 mb-0.5">Ver / Descargar registros</h3>
<p className="text-[12.5px] text-[var(--gray-400)] m-0">Accede y descarga registros y reportes del sistema.</p>
</div>
</Link>
</div>
<PageFooter />
</div>
</div>
);
}
