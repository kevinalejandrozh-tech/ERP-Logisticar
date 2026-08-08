import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import MenuCard from "@/components/MenuCard";
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
export default function PersonasPage() {
return (
<div className="min-h-screen bg-[#eef1f6]">
<div className="max-w-[1440px] mx-auto px-14 pt-10">
<PageHeader
titulo="Personas"
subtitulo="Gestiona la información y trámites del personal."
backHref="/"
backLabel="Menú principal"
icono={
<svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
<circle cx="9" cy="8" r="3.5" />
<path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" />
<circle cx="18" cy="9" r="2.6" />
<path d="M15 14c2.9.2 5.5 2.4 5.5 6.5" />
</svg>
}
/>
<div className="bg-white rounded-[18px] p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
<div className="grid grid-cols-3 gap-5">
<MenuCard
icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M9 15l2 2 4-4" /></svg>}
titulo="Registrar asistencia"
descripcion="Registra entradas, salidas y asistencia del personal."
/>
<MenuCard
href="/personas/mochilas-covid"
icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" /></svg>}
titulo="Mochilas Covid"
descripcion="Administra la asignación y revisión de mochilas Covid."
/>
<MenuCard
icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><rect x="5" y="2" width="14" height="20" rx="2" /><path d="M9 8h.01M9 12h.01M9 16h.01M13 8h2M13 12h2M13 16h2" /></svg>}
titulo="Asignación de radios"
descripcion="Gestiona la asignación de radios de comunicación."
/>
<MenuCard
icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
titulo="Expedientes"
descripcion="Consulta y administra los expedientes del personal."
/>
<MenuCard
href="/personas/operadores"
icono={<svg width="22" height="22" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.5" /><path d="M2 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /><path d="M19 8v6M22 11h-6" /></svg>}
titulo="Agregar / Administrar personas"
descripcion="Da de alta o edita la información del personal."
/>
</div>
</div>
<PageFooter />
</div>
</div>
);
}
