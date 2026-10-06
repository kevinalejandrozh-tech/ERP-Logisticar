"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import MenuCard from "@/components/MenuCard";
import { useSesion } from "@/lib/useSesion";
import { coincideBusqueda } from "@/lib/paginas";
import BuscadorPaginas from "@/components/inicio/BuscadorPaginas";
import CampanaNotificaciones from "@/components/inicio/CampanaNotificaciones";
import AccesosDirectos from "@/components/inicio/AccesosDirectos";
import PerfilModal from "@/components/inicio/PerfilModal";
import BotonesPersonalizados from "@/components/inicio/BotonesPersonalizados";
import BuzonIcono from "@/components/inicio/BuzonIcono";
import { Arrastrable, OrdenInicioProvider } from "@/components/inicio/Ordenable";
import { puedeVerSeccion } from "@/lib/permisos";
const ICON_STROKE = "#2f6fed";
const sw = { fill: "none", stroke: ICON_STROKE, strokeWidth: 2 };
export default function Home() {
const sesion = useSesion();
const [menuUsuarioAbierto, setMenuUsuarioAbierto] = useState(false);
const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);
const [consulta, setConsulta] = useState("");
const [perfilAbierto, setPerfilAbierto] = useState(false);
// El engrane global (todas las páginas) abre el perfil con /?perfil=1.
useEffect(() => {
  if (new URLSearchParams(window.location.search).get("perfil") === "1") {
    setPerfilAbierto(true);
    window.history.replaceState(null, "", "/");
  }
}, []);
const [foto, setFoto] = useState<string | null>(null);
useEffect(() => {
fetch("/api/auth/perfil", { cache: "no-store" })
.then((r) => r.json())
.then((d) => setFoto(d.foto || null))
.catch(() => {});
}, []);
// Secciones que el rol puede ver (Gestión de usuarios → Roles y permisos).
const sec = (clave: string) => puedeVerSeccion(clave, sesion.rol, sesion.secciones);
// Filtra botones y tarjetas del inicio según el texto de la barra "Buscar..."
const ver = (texto: string) => coincideBusqueda(texto, consulta);
const iniciales = (sesion.nombre || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
const rolEtiqueta = sesion.rol === "sysadmin" ? "Sysadmin" : sesion.rol === "supervisor_tms" ? "Supervisor TMS" : sesion.rol === "personal" ? "Personal" : "";
const cerrarSesion = async () => {
await fetch("/api/auth/logout", { method: "POST" });
window.location.href = "/login";
};
const [almacenamiento, setAlmacenamiento] = useState<{ porcentaje: number; mbUsados: number; mbLimite: number } | null>(null);
useEffect(() => {
fetch("/api/sistema/almacenamiento", { cache: "no-store" })
.then((r) => r.json())
.then((d) => {
if (d.ok) setAlmacenamiento({ porcentaje: d.porcentaje, mbUsados: d.mbUsados, mbLimite: d.mbLimite });
})
.catch(() => {});
}, []);
// Menú lateral (celular): bloquea el scroll de fondo, cierra con Escape y al pasar a pantalla mediana o mayor
useEffect(() => {
if (!menuMovilAbierto) return;
const overflowPrevio = document.body.style.overflow;
document.body.style.overflow = "hidden";
const alPresionarTecla = (e: KeyboardEvent) => {
if (e.key === "Escape") setMenuMovilAbierto(false);
};
const mq = window.matchMedia("(min-width: 768px)");
const alCambiarTamano = () => {
if (mq.matches) setMenuMovilAbierto(false);
};
window.addEventListener("keydown", alPresionarTecla);
mq.addEventListener("change", alCambiarTamano);
return () => {
document.body.style.overflow = overflowPrevio;
window.removeEventListener("keydown", alPresionarTecla);
mq.removeEventListener("change", alCambiarTamano);
};
}, [menuMovilAbierto]);
return (
<div className="min-h-screen">
<div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14">
<div className="tarjeta-encabezado flex flex-row items-center justify-between gap-4 mt-3 md:mt-4 mb-8 md:mb-12 px-4 sm:px-6 md:px-9 py-3 md:py-[18px]">
<div className="flex items-center gap-2.5 md:gap-3.5">
<Logo size={46} />
<div>
<h1 className="font-display text-[19px] md:text-[25px] font-bold text-[var(--navy)] m-0 leading-tight">Gestión Logística</h1>
<p className="text-[12px] md:text-[15.5px] text-[var(--gray-500)] m-0">Transportes Logisticar</p>
</div>
</div>
<div className="md:hidden flex items-center gap-1.5">
{sesion.rol !== "supervisor_tms" && sec("buzon") && <BuzonIcono className="flex" />}
<CampanaNotificaciones />
<button
type="button"
onClick={() => setMenuMovilAbierto(true)}
aria-label="Abrir menú"
aria-expanded={menuMovilAbierto}
aria-controls="menu-lateral-movil"
className="w-10 h-10 shrink-0 flex items-center justify-center bg-white border border-[var(--gray-200)] rounded-lg"
>
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
</button>
</div>
<div className="hidden md:flex items-center gap-3 md:gap-5">
<Link href="/sitio" title="Ir al sitio web" className="flex items-center gap-1 text-[12px] text-[var(--gray-500)] no-underline hover:text-[var(--blue)] whitespace-nowrap">
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
Sitio web
</Link>
<BuscadorPaginas valor={consulta} onCambio={setConsulta} rol={sesion.rol} secciones={sesion.secciones} className="hidden sm:block w-full sm:w-[220px] lg:w-[316px]" />
<div className="hidden md:block w-px h-8 bg-[var(--gray-200)]" />
<CampanaNotificaciones />
<div className="hidden md:block w-px h-8 bg-[var(--gray-200)]" />

<div className="relative">
<div onClick={() => setMenuUsuarioAbierto((v) => !v)} className="flex items-center gap-2 cursor-pointer">
<div className="w-11 h-11 rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0 text-[15px] font-medium text-[var(--blue)] overflow-hidden">
{/* eslint-disable-next-line @next/next/no-img-element */}
{foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : iniciales || <svg width="18" height="18" viewBox="0 0 24 24" {...sw}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>}
</div>
<div className="hidden lg:block leading-tight">
<span className="block text-[14px] font-bold text-[var(--navy)]">{sesion.nombre || "..."}</span>
<span className="block text-[12px] text-[var(--gray-500)]">{rolEtiqueta}</span>
</div>
<svg className="hidden lg:block ml-1" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>
</div>
{menuUsuarioAbierto && (
<>
<div onClick={() => setMenuUsuarioAbierto(false)} className="fixed inset-0 z-40" />
<div className="absolute right-0 top-14 bg-white border border-[var(--gray-200)] rounded-xl shadow-lg w-[220px] z-50 overflow-hidden">
<div className="px-3.5 py-3 border-b border-[var(--gray-200)]">
<p className="text-[12.5px] font-bold text-[var(--navy)] m-0">{sesion.nombre}</p>
<p className="text-[10.5px] text-[var(--gray-400)] m-0">{sesion.correo}</p>
</div>
{almacenamiento && (
<div className="px-3.5 py-2.5 border-b border-[var(--gray-200)]" title={`${almacenamiento.mbUsados.toFixed(1)} MB de ${almacenamiento.mbLimite.toFixed(0)} MB usados en la nube`}>
<div className="flex items-center justify-between mb-1.5"><span className="text-[11px] font-medium text-[var(--navy)]">Almacenamiento</span><span className="text-[11px] font-bold text-[var(--gray-400)]">{almacenamiento.porcentaje.toFixed(0)}%</span></div>
<div className="w-full h-[6px] bg-[var(--gray-200)] rounded-full overflow-hidden">
<div className="h-full rounded-full" style={{ width: `${Math.min(100, almacenamiento.porcentaje)}%`, backgroundColor: almacenamiento.porcentaje > 85 ? "var(--red)" : almacenamiento.porcentaje > 60 ? "var(--amber)" : "var(--blue)" }} />
</div>
</div>
)}
{sesion.rol === "sysadmin" && (
<Link href="/admin/usuarios" className="block px-3.5 py-2.5 text-[12.5px] text-[var(--navy)] font-semibold no-underline hover:bg-[var(--gray-100)]">
Gestión de usuarios
</Link>
)}
<span onClick={cerrarSesion} className="block px-3.5 py-2.5 text-[12.5px] text-[var(--red)] font-semibold cursor-pointer hover:bg-[var(--gray-100)]">
Cerrar sesión
</span>
</div>
</>
)}
</div>
{sesion.rol !== "supervisor_tms" && sec("buzon") && <BuzonIcono className="hidden sm:flex shrink-0 ml-2" />}
</div>
</div>
<div className={`md:hidden fixed inset-0 z-[10000] ${menuMovilAbierto ? "" : "pointer-events-none"}`} aria-hidden={!menuMovilAbierto}>
<div onClick={() => setMenuMovilAbierto(false)} className={`absolute inset-0 bg-[rgba(22,33,92,0.45)] transition-opacity duration-200 ${menuMovilAbierto ? "opacity-100" : "opacity-0"}`} />
<aside
id="menu-lateral-movil"
role="dialog"
aria-modal="true"
aria-label="Menú de usuario"
className={`absolute right-0 top-0 h-full w-[85%] max-w-[320px] bg-white shadow-xl flex flex-col transition-transform duration-200 ${menuMovilAbierto ? "translate-x-0" : "translate-x-full"}`}
>
<div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--gray-200)]">
<span className="font-display text-[15px] font-bold text-[var(--navy)]">Menú</span>
<button type="button" onClick={() => setMenuMovilAbierto(false)} aria-label="Cerrar menú" className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--gray-100)]">
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
</button>
</div>
<div className="flex-1 overflow-y-auto">
<div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--gray-200)]">
<div className="w-11 h-11 rounded-full bg-[var(--blue-light)] flex items-center justify-center shrink-0 overflow-hidden">
{/* eslint-disable-next-line @next/next/no-img-element */}
{foto ? <img src={foto} alt="" className="w-full h-full object-cover" /> : <svg width="20" height="20" viewBox="0 0 24 24" {...sw}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></svg>}
</div>
<div className="min-w-0 leading-tight">
<p className="text-[14px] font-bold text-[var(--navy)] m-0 truncate">{sesion.nombre || "..."}</p>
{rolEtiqueta && <p className="text-[11px] text-[var(--gray-400)] m-0 mt-0.5">{rolEtiqueta}</p>}
{sesion.correo && <p className="text-[11.5px] text-[var(--gray-400)] m-0 mt-0.5 truncate">{sesion.correo}</p>}
</div>
</div>
<div className="px-4 py-4 border-b border-[var(--gray-200)]">
<BuscadorPaginas valor={consulta} onCambio={setConsulta} rol={sesion.rol} secciones={sesion.secciones} onNavegar={() => setMenuMovilAbierto(false)} />
</div>
{almacenamiento && (
<div className="px-4 py-4 border-b border-[var(--gray-200)]">
<div className="flex items-center justify-between mb-2">
<div className="flex items-center gap-2">
<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M20 16.58A5 5 0 0018 7h-1.26A8 8 0 104 15.25" /><path d="M12 12v9M9 18l3 3 3-3" /></svg>
<span className="text-[12px] font-semibold text-[var(--navy)]">Almacenamiento en la nube</span>
</div>
<span className="text-[11px] font-bold text-[var(--gray-400)]">{almacenamiento.porcentaje.toFixed(0)}%</span>
</div>
<div className="w-full h-[6px] bg-[var(--gray-200)] rounded-full overflow-hidden">
<div className="h-full rounded-full" style={{ width: `${Math.min(100, almacenamiento.porcentaje)}%`, backgroundColor: almacenamiento.porcentaje > 85 ? "var(--red)" : almacenamiento.porcentaje > 60 ? "var(--amber)" : "var(--blue)" }} />
</div>
<p className="text-[10.5px] text-[var(--gray-400)] m-0 mt-1.5">{`${almacenamiento.mbUsados.toFixed(1)} MB de ${almacenamiento.mbLimite.toFixed(0)} MB usados`}</p>
</div>
)}
<div className="py-2 border-b border-[var(--gray-200)]">
<button type="button" onClick={() => { setMenuMovilAbierto(false); setPerfilAbierto(true); }} className="w-full flex items-center gap-3 px-4 py-3 text-[13.5px] text-[var(--navy)] font-semibold hover:bg-[var(--gray-100)]">
<svg width="18" height="18" viewBox="0 0 24 24" {...sw}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></svg>
Mi perfil
</button>
<Link href="/sitio" onClick={() => setMenuMovilAbierto(false)} className="flex items-center gap-3 px-4 py-3 text-[13px] text-[var(--gray-500)] no-underline hover:bg-[var(--gray-100)]">
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
Sitio web
</Link>
</div>
{sesion.rol === "sysadmin" && (
<div className="py-2 border-b border-[var(--gray-200)]">
<Link href="/admin/usuarios" onClick={() => setMenuMovilAbierto(false)} className="flex items-center gap-3 px-4 py-3 text-[13.5px] text-[var(--navy)] font-semibold no-underline hover:bg-[var(--gray-100)]">
<svg width="18" height="18" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15 14c2.6.2 5 2.1 5 6" /></svg>
Gestión de usuarios
</Link>
</div>
)}
</div>
<div className="p-4 border-t border-[var(--gray-200)]">
<button type="button" onClick={cerrarSesion} className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--red)] text-[var(--red)] font-bold text-[13.5px] py-3 hover:bg-[var(--gray-100)]">
<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>
Cerrar sesión
</button>
</div>
</aside>
</div>
<OrdenInicioProvider>
<div className="px-0 md:px-4">
<p className="text-[12px] md:text-[14px] font-medium tracking-[0.18em] uppercase text-[var(--blue)] m-0 mb-4 md:mb-6">Centro de operaciones</p>
<p className="text-[20px] md:text-[27px] text-[var(--gray-500)] m-0 mb-6 md:mb-9">Gestiona tu operación desde un solo lugar.</p>
<div className="flex flex-wrap gap-3 md:gap-4 mb-7 md:mb-9">
{sesion.rol !== "supervisor_tms" && (
<>
{sec("monitoreo_rutas") && ver("Monitoreo de Rutas planeación programa de cargas") && <Arrastrable id="btn-rutas" grupo="acciones"><Link href="/planeacion-cargas" draggable={false} className="btn btn-primario text-[13.5px]! md:text-[16.5px]! md:px-7! md:py-3.5! rounded-lg! shadow-[0_2px_6px_rgba(22,33,92,0.2)]">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M3 10h18M8 4v18M8 15h13" /></svg>
Monitoreo de Rutas
</Link></Arrastrable>}
{sec("menu_dia") && ver("Menú del día comida") && <Arrastrable id="btn-menu" grupo="acciones"><Link href="/menu-dia" draggable={false} className="btn btn-secundario text-[13.5px]! md:text-[16.5px]! md:px-7! md:py-3.5! rounded-lg!">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><path d="M6 2v20M6 2c-2 0-3 1.5-3 3.5S4 9 6 9M18 2v20M18 2a3.5 3.5 0 013.5 3.5v3a3.5 3.5 0 01-3.5 3.5" /></svg>
Menú del día
</Link></Arrastrable>}
{sec("notas") && ver("Notas recordatorios") && <Arrastrable id="btn-notas" grupo="acciones"><Link href="/notas" draggable={false} className="btn btn-secundario text-[13.5px]! md:text-[16.5px]! md:px-7! md:py-3.5! rounded-lg!">
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--navy)" strokeWidth="2"><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" /><path d="M14 3v6h6M8 13h8M8 17h5" /></svg>
Notas
</Link></Arrastrable>}
</>
)}
</div>
<AccesosDirectos consulta={consulta} />
<div className="pb-8">
{consulta.trim() && (
<p className="text-[13px] text-[var(--gray-500)] m-0 mb-3">Resultados para “{consulta}” · <button type="button" onClick={() => setConsulta("")} className="text-[var(--blue)] underline">Limpiar búsqueda</button></p>
)}
<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-[22px]">
{sec("unidades") && ver("Unidades flota placas aceite eco Administra y consulta la información de las unidades.") && (
<Arrastrable id="unidades" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/unidades"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
titulo="Unidades"
descripcion="Administra y consulta la información de las unidades."
/>
</Arrastrable>
)}
{sesion.rol === "supervisor_tms" ? (
sec("expedientes") && ver("Expedientes Consulta los expedientes del personal (cuenta TMS).") && (
<Arrastrable id="expedientes" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/personas/expedientes"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>}
titulo="Expedientes"
descripcion="Consulta los expedientes del personal (cuenta TMS)."
/>
</Arrastrable>
)
) : (
<>
{(sec("expedientes") || sec("organigrama") || sec("recursos_humanos") || sec("nomina")) && ver("Recursos Humanos personas expedientes nómina capacitaciones uniformes organigrama candidatos documentos mochilas Gestiona la información del personal del sistema.") && (
<Arrastrable id="rh" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/personas"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><circle cx="9" cy="8" r="3.2" /><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17.5" cy="9" r="2.4" /><path d="M15 14c2.6.2 5 2.1 5 6" /></svg>}
titulo="Recursos Humanos"
descripcion="Gestiona la información del personal del sistema."
/>
</Arrastrable>
)}
{sec("asistencia") && ver("Asistencia vacaciones descansos Registro por QR, vacaciones, permisos y faltas.") && (
<Arrastrable id="asistencia" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/asistencia"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /><path d="M8 15l2.5 2.5L16 13" /></svg>}
titulo="Asistencia"
descripcion="Registro por QR, vacaciones, permisos y faltas."
/>
</Arrastrable>
)}
{sec("informe_general") && ver("Informe General asistencia del día reporte de monitoreo bitácora entrega de turno incidencias liquidación de viajes") && (
<Arrastrable id="informe-general" grupo="tarjetas" className="h-full">
<MenuCard
compactoMovil
href="/informe-general"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h5M8 9h2" /></svg>}
titulo="Informe General"
descripcion="Asistencia del día, monitoreo, incidencias y liquidación de viajes."
/>
</Arrastrable>
)}
{sec("viajes") && ver("Control de Viajes rutas calendario gastos viáticos casetas combustible monitoreo Organiza y consulta la información de tus viajes.") && (
<Arrastrable id="viajes" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/control-viajes"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
titulo="Control de Viajes"
descripcion="Organiza y consulta la información de tus viajes."
/>
</Arrastrable>
)}
{sec("compras") && ver("Compras comparativo cotizaciones Gestiona y da seguimiento a tus compras.") && (
<Arrastrable id="compras" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/compras"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>}
titulo="Compras"
descripcion="Gestiona y da seguimiento a tus compras."
/>
</Arrastrable>
)}

{sec("inventario") && ver("Control de inventario categorías Consulta equipos, mobiliario y sus códigos QR.") && (
<Arrastrable id="inventario" grupo="tarjetas" className="h-full"><MenuCard
compactoMovil
href="/inventario"
icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M21 8l-9-5-9 5 9 5 9-5z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></svg>}
titulo="Control de inventario"
descripcion="Consulta equipos, mobiliario y sus códigos QR."
/>
</Arrastrable>
)}
</>
)}
{!consulta.trim() && <BotonesPersonalizados esSysadmin={sesion.rol === "sysadmin"} />}

</div>
</div>
</div>
</OrdenInicioProvider>
</div>
{perfilAbierto && <PerfilModal nombre={sesion.nombre || ""} foto={foto} onFotoCambiada={setFoto} onCerrar={() => setPerfilAbierto(false)} />}
</div>
);
}
