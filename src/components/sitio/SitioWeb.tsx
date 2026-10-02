"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSesion } from "@/lib/useSesion";
import { compressImage } from "@/lib/imageUtils";
import { escribirCampo, RutaCampo, SitioContenido } from "@/lib/sitioData";
import { BotonAccion, Imagen, SitioContext, Texto, useSitio } from "./Editable";
import { PanelRedes, PanelSuscriptores } from "./PanelesSitio";

const CONTENEDOR = "max-w-[1140px] mx-auto px-5 md:px-8";

const SECCIONES: { id: string; clave: keyof SitioContenido["menu"] }[] = [
  { id: "inicio", clave: "inicio" },
  { id: "soluciones", clave: "soluciones" },
  { id: "servicios", clave: "servicios" },
  { id: "testimonios", clave: "testimonios" },
  { id: "por-que", clave: "porque" },
  { id: "contacto", clave: "contacto" },
];

// ---------- Íconos ----------
const ICONOS_RED: Record<keyof SitioContenido["redes"], { nombre: string; path: React.ReactNode }> = {
  facebook: { nombre: "Facebook", path: <path d="M14 8h3V4h-3a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h3l1-4h-4V8z" fill="currentColor" /> },
  instagram: {
    nombre: "Instagram",
    path: (
      <g fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="4" y="4" width="16" height="16" rx="5" />
        <circle cx="12" cy="12" r="3.6" />
        <circle cx="17" cy="7" r="0.6" fill="currentColor" />
      </g>
    ),
  },
  linkedin: {
    nombre: "LinkedIn",
    path: (
      <g fill="currentColor">
        <rect x="4" y="9" width="3.4" height="11" />
        <circle cx="5.7" cy="5.6" r="1.9" />
        <path d="M10 9h3.2v1.6c.5-.9 1.7-1.9 3.6-1.9 3 0 3.6 2 3.6 4.5V20H17v-5.9c0-1.4 0-3-1.9-3s-2.1 1.4-2.1 2.9v6H10z" />
      </g>
    ),
  },
  whatsapp: {
    nombre: "WhatsApp",
    path: (
      <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        <path d="M4 20l1.3-4A8 8 0 1 1 8.2 19z" />
        <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .8a4 4 0 0 1-2.1-2.1l.8-1-1-2z" strokeWidth="1.4" />
      </g>
    ),
  },
};

function Redes({ claro = false }: { claro?: boolean }) {
  const { contenido, editando } = useSitio();
  const visibles = (Object.keys(ICONOS_RED) as (keyof SitioContenido["redes"])[]).filter((k) => editando || contenido.redes[k]);
  if (visibles.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      {visibles.map((k) => {
        const url = contenido.redes[k];
        const clase = `w-7 h-7 rounded-md flex items-center justify-center ${claro ? "text-white hover:bg-white/15" : "text-white/85 hover:text-white hover:bg-white/10"} ${!url ? "opacity-40" : ""}`;
        const icono = (
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            {ICONOS_RED[k].path}
          </svg>
        );
        if (!url || editando) {
          return (
            <span key={k} className={clase} title={url ? ICONOS_RED[k].nombre : `${ICONOS_RED[k].nombre}: sin enlace (agrégalo en "Redes sociales")`}>
              {icono}
            </span>
          );
        }
        return (
          <a key={k} href={url} target="_blank" rel="noopener noreferrer" aria-label={ICONOS_RED[k].nombre} className={clase}>
            {icono}
          </a>
        );
      })}
    </div>
  );
}

function IconoTelefono({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}
function IconoCorreo({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M22 6l-10 7L2 6" />
    </svg>
  );
}
function IconoUbicacion({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

// Teléfono / correo: enlace en vista pública, texto editable en modo edición.
function DatoContacto({ tipo, className = "" }: { tipo: "telefono" | "correo"; className?: string }) {
  const { contenido, editando } = useSitio();
  const ruta: RutaCampo = ["contacto", tipo];
  if (editando) return <Texto ruta={ruta} className={className} />;
  const valor = contenido.contacto[tipo];
  const href = tipo === "telefono" ? `tel:${valor.replace(/[^\d+]/g, "")}` : `mailto:${valor}`;
  return (
    <a href={href} className={`${className} hover:underline underline-offset-2`}>
      {valor}
    </a>
  );
}

function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icono.png" alt="" width={42} height={42} className="w-[42px] h-[42px] object-contain" draggable={false} />
      <span className="flex flex-col leading-none">
        <span className={`text-[10px] tracking-[0.22em] font-medium ${claro ? "text-[#a9c2ee]" : "text-[var(--red)]"}`}>TRANSPORTES</span>
        <span className={`text-[19px] font-bold tracking-[0.02em] mt-1 ${claro ? "text-white" : "text-[var(--navy)]"}`}>LOGISTICAR</span>
      </span>
    </span>
  );
}

// ---------- Encabezado ----------
function Encabezado({ sesionActiva }: { sesionActiva: boolean }) {
  const { editando } = useSitio();
  const [abierto, setAbierto] = useState(false);
  const enlaceSesion = sesionActiva ? (
    <Link href="/" className="btn btn-primario whitespace-nowrap">
      Ir al sistema
    </Link>
  ) : (
    <a href="/login?destino=%2Fsitio" className="btn btn-primario whitespace-nowrap">
      Iniciar sesión
    </a>
  );

  return (
    <header className="relative z-30 bg-white shadow-[0_1px_0_var(--gray-200)]">
      <div className="flex items-stretch">
        <a href="#inicio" className="flex items-center px-5 md:px-8 lg:pl-12 lg:pr-10 py-3 shrink-0" aria-label="Transportes Logisticar, ir al inicio">
          <Marca />
        </a>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="sw-oscuro hidden md:flex items-center justify-end gap-6 h-9 px-6 lg:px-12 bg-[var(--navy)] text-white text-[12.5px]">
            <span className="flex items-center gap-2">
              <IconoTelefono size={14} />
              <DatoContacto tipo="telefono" />
            </span>
            <span className="flex items-center gap-2">
              <IconoCorreo size={14} />
              <DatoContacto tipo="correo" />
            </span>
            <Redes />
          </div>
          <div className="flex-1 flex items-center justify-end gap-1 px-4 md:px-6 lg:px-12 min-h-[56px]">
            <nav aria-label="Secciones del sitio" className="hidden lg:flex items-center gap-0.5">
              {SECCIONES.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={(e) => editando && e.preventDefault()}
                  className="px-3 py-2 rounded-md text-[13.5px] text-[var(--text)] hover:text-[var(--navy)] hover:bg-[var(--gray-100)]"
                >
                  <Texto ruta={["menu", s.clave]} />
                </a>
              ))}
            </nav>
            <span className="hidden lg:block ml-3">{enlaceSesion}</span>
            <button
              type="button"
              className="lg:hidden w-10 h-10 rounded-md flex items-center justify-center text-[var(--navy)] hover:bg-[var(--gray-100)]"
              aria-label={abierto ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={abierto}
              onClick={() => setAbierto((a) => !a)}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                {abierto ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
              </svg>
            </button>
          </div>
        </div>
      </div>
      {abierto && (
        <nav aria-label="Secciones del sitio" className="lg:hidden border-t border-[var(--gray-200)] bg-white px-5 py-3 flex flex-col">
          {SECCIONES.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => (editando ? e.preventDefault() : setAbierto(false))} className="py-2.5 text-[14px] text-[var(--text)] border-b border-[var(--gray-100)]">
              <Texto ruta={["menu", s.clave]} />
            </a>
          ))}
          <div className="pt-3">{enlaceSesion}</div>
        </nav>
      )}
    </header>
  );
}

// ---------- Portada (3 diapositivas) ----------
function Portada() {
  const { contenido, editando } = useSitio();
  const total = contenido.hero.diapositivas.length;
  const [activa, setActiva] = useState(0);
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (editando || pausa || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setActiva((a) => (a + 1) % total), 7000);
    return () => window.clearInterval(t);
  }, [editando, pausa, total]);

  const destinos = ["#soluciones", "#servicios", "#contacto"];

  return (
    <section
      id="inicio"
      aria-roledescription="carrusel"
      className="sw-oscuro relative h-[480px] md:h-[540px] overflow-hidden bg-[var(--navy-dark)]"
      onMouseEnter={() => setPausa(true)}
      onMouseLeave={() => setPausa(false)}
    >
      {contenido.hero.diapositivas.map((d, i) => (
        <div
          key={i}
          inert={i !== activa}
          className={`absolute inset-0 transition-opacity duration-700 ${i === activa ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
        >
          <Imagen ruta={["hero", "diapositivas", i, "imagen"]} alt={d.titulo} anchoMaximo={1920} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-[rgba(15,24,69,0.55)] md:bg-transparent md:bg-[linear-gradient(90deg,rgba(15,24,69,0.88)_0%,rgba(15,24,69,0.62)_42%,rgba(15,24,69,0.08)_75%)]" />
          <div className={`relative h-full ${CONTENEDOR} flex flex-col justify-center pb-10`}>
            <div className="max-w-[560px] text-white">
              <Texto ruta={["hero", "diapositivas", i, "subtitulo"]} como="p" className="text-[18px] md:text-[22px] font-medium text-[#d5e0f7]" />
              <Texto ruta={["hero", "diapositivas", i, "titulo"]} como="h1" className="block mt-2 text-[30px] md:text-[42px] leading-[1.12] font-bold" />
              <div className="mt-7">
                <BotonAccion ruta={["hero", "diapositivas", i, "boton"]} destino={destinos[i] || "#contacto"} />
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className={`absolute z-20 bottom-8 left-0 right-0 ${CONTENEDOR} flex gap-6`}>
        {contenido.hero.diapositivas.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiva(i)}
            aria-label={`Ver diapositiva ${i + 1}`}
            aria-current={i === activa}
            className="group flex flex-col items-start gap-2 text-[14px] font-bold"
          >
            <span className={i === activa ? "text-white" : "text-white/60 group-hover:text-white"}>{String(i + 1).padStart(2, "0")}</span>
            <span className={`block h-[2px] w-14 md:w-20 ${i === activa ? "bg-[var(--red)]" : "bg-white/40 group-hover:bg-white/70"}`} />
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------- Soluciones (4 tarjetas) ----------
function Soluciones() {
  const { contenido } = useSitio();
  return (
    <section id="soluciones" className="bg-white py-16 md:py-20 scroll-mt-4">
      <div className={CONTENEDOR}>
        <Texto ruta={["soluciones", "titulo"]} como="h2" className="block text-[28px] md:text-[32px] font-bold text-[var(--navy)]" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-10 mt-9">
          {contenido.soluciones.tarjetas.map((t, i) => (
            <article key={i}>
              <div className="relative w-[220px] max-w-full aspect-[22/13] rounded-md overflow-hidden bg-[var(--navy)]">
                <Imagen ruta={["soluciones", "tarjetas", i, "imagen"]} alt={t.titulo} anchoMaximo={700} botonCompacto className="w-full h-full object-cover" />
              </div>
              <Texto ruta={["soluciones", "tarjetas", i, "titulo"]} como="h3" className="block mt-4 text-[16.5px] font-bold text-[var(--navy)]" />
              <Texto ruta={["soluciones", "tarjetas", i, "texto"]} como="p" multilinea className="block mt-2 text-[13.5px] leading-[1.6] text-[var(--gray-500)]" />
            </article>
          ))}
        </div>
        <div className="flex justify-center mt-11">
          <BotonAccion ruta={["soluciones", "boton"]} destino="#contacto" />
        </div>
      </div>
    </section>
  );
}

// ---------- Servicios (imagen grande + 3 miniaturas circulares) ----------
function Servicios() {
  const { contenido } = useSitio();
  const [activo, setActivo] = useState(0);
  const item = contenido.servicios.items[activo];

  return (
    <section id="servicios" className="grid md:grid-cols-2 scroll-mt-4">
      <div className="relative min-h-[320px] md:min-h-[480px] bg-[var(--navy-dark)]">
        <Imagen key={activo} ruta={["servicios", "items", activo, "imagen"]} alt={item.encabezado} anchoMaximo={1200} className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute z-10 bottom-4 left-1/2 -translate-x-1/2 flex flex-row gap-3 md:bottom-auto md:left-auto md:right-0 md:top-1/2 md:-translate-y-1/2 md:translate-x-1/2 md:flex-col">
          {contenido.servicios.items.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivo(i)}
              aria-label={`Ver: ${s.encabezado}`}
              aria-current={i === activo}
              className={`w-14 h-14 md:w-[60px] md:h-[60px] rounded-full overflow-hidden border-[3px] shadow-[0_4px_14px_rgba(15,24,69,0.25)] ${i === activo ? "border-[var(--red)]" : "border-white hover:border-[#d5e0f7]"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imagen} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
      </div>
      <div className="bg-[var(--blue-light)] px-6 md:px-14 lg:px-20 py-14 md:py-16 flex items-center">
        <div className="max-w-[500px]">
          <Texto ruta={["servicios", "titulo"]} como="h2" className="block text-[28px] md:text-[32px] font-bold text-[var(--navy)]" />
          <Texto ruta={["servicios", "subtitulo"]} como="p" className="block mt-1 text-[15px] font-medium text-[var(--red)]" />
          <Texto ruta={["servicios", "items", activo, "encabezado"]} como="h3" className="block mt-7 text-[19px] font-bold text-[var(--navy)]" />
          <Texto ruta={["servicios", "items", activo, "parrafo1"]} como="p" multilinea className="block mt-3 text-[14px] leading-[1.65] text-[var(--gray-500)]" />
          <Texto ruta={["servicios", "items", activo, "parrafo2"]} como="p" multilinea className="block mt-3 text-[14px] leading-[1.65] text-[var(--gray-500)]" />
          <div className="mt-8">
            <BotonAccion ruta={["servicios", "boton"]} destino="#contacto" />
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Testimonios ----------
function Comillas({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 48 36" width="40" height="30" fill="var(--red)" aria-hidden="true" className={className}>
      <path d="M0 36V22C0 9 6 2 18 0l2 5c-6 2-9 6-9 12h8v19zM28 36V22c0-13 6-20 18-22l2 5c-6 2-9 6-9 12h8v19z" />
    </svg>
  );
}

function Testimonios() {
  const { contenido, editando } = useSitio();
  const [activo, setActivo] = useState(0);
  return (
    <section id="testimonios" className="bg-white py-16 md:py-20 scroll-mt-4">
      <div className={`${CONTENEDOR} text-center`}>
        <Texto ruta={["testimonios", "titulo"]} como="h2" className="block text-[28px] md:text-[32px] font-bold text-[var(--navy)]" />
        <div className="relative max-w-[780px] mx-auto mt-9 px-12 md:px-16">
          <Comillas className="absolute left-0 top-0" />
          <Texto ruta={["testimonios", "items", activo, "texto"]} como="p" multilinea className="block text-[15px] italic leading-[1.7] text-[var(--gray-500)]" />
          <Comillas className="absolute right-0 bottom-0 rotate-180" />
        </div>
        <span className="block w-10 h-px bg-[var(--gray-300)] mx-auto mt-7" />
        <Texto ruta={["testimonios", "items", activo, "nombre"]} como="p" className="block mt-4 text-[13.5px] font-bold text-[var(--red)]" />
        <Texto ruta={["testimonios", "items", activo, "puesto"]} como="p" className="block mt-0.5 text-[12.5px] text-[var(--gray-500)]" />
        <div className="flex justify-center items-center gap-3.5 mt-7">
          {contenido.testimonios.items.map((t, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivo(i)}
              aria-label={`Ver testimonio de ${t.nombre}`}
              aria-current={i === activo}
              className={`rounded-full overflow-hidden ${i === activo ? "w-16 h-16 ring-[3px] ring-[var(--red)] ring-offset-2" : "w-14 h-14 opacity-80 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={t.foto} alt="" className="w-full h-full object-cover" draggable={false} />
            </button>
          ))}
        </div>
        {editando && (
          <div className="flex justify-center mt-4">
            <Imagen ruta={["testimonios", "items", activo, "foto"]} alt="" anchoMaximo={300} soloBoton etiqueta="Cambiar foto del testimonio" />
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- Boletín + ¿Por qué elegirnos? ----------
function Boletin() {
  const { contenido, editando } = useSitio();
  const [correo, setCorreo] = useState("");
  const [trampa, setTrampa] = useState("");
  const [estado, setEstado] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editando) return;
    setEnviando(true);
    setEstado(null);
    try {
      const r = await fetch("/api/sitio/boletin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, sitio: trampa }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo registrar el correo. Intenta de nuevo.");
      setEstado({ tipo: "ok", texto: contenido.boletin.exito });
      setCorreo("");
    } catch (err) {
      setEstado({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo registrar el correo." });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div>
      <Texto ruta={["boletin", "titulo"]} como="h2" className="block text-[28px] md:text-[32px] font-bold text-[var(--navy)]" />
      <Texto ruta={["boletin", "texto"]} como="p" multilinea className="block mt-3 max-w-[440px] text-[14px] leading-[1.65] text-[var(--gray-500)]" />
      {editando ? (
        <>
          <div className="flex mt-6 max-w-[440px]">
            <span className="flex-1 bg-white border border-[var(--gray-300)] border-r-0 rounded-l-md px-3.5 py-2.5 text-[13.5px] text-[var(--gray-400)]">
              <Texto ruta={["boletin", "placeholder"]} />
            </span>
            <span className="sw-btn rounded-l-none">
              <Texto ruta={["boletin", "boton"]} />
            </span>
          </div>
          <p className="mt-3 text-[12.5px] text-[var(--gray-500)]">
            Mensaje al suscribirse: <Texto ruta={["boletin", "exito"]} className="text-[var(--green)] font-medium" />
          </p>
        </>
      ) : (
        <form onSubmit={enviar} className="mt-6 max-w-[440px]" noValidate>
          <div className="flex">
            <label htmlFor="boletin-correo" className="sr-only">
              Correo electrónico
            </label>
            <input
              id="boletin-correo"
              type="email"
              required
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder={contenido.boletin.placeholder}
              className="flex-1 min-w-0 bg-white border border-[var(--gray-300)] border-r-0 rounded-l-md px-3.5 py-2.5 text-[13.5px]"
            />
            <button type="submit" disabled={enviando} className="sw-btn rounded-l-none whitespace-nowrap">
              {enviando ? "Enviando..." : contenido.boletin.boton}
            </button>
          </div>
          {/* Campo trampa para bots: oculto para las personas */}
          <input type="text" name="sitio" tabIndex={-1} autoComplete="off" value={trampa} onChange={(e) => setTrampa(e.target.value)} className="absolute -left-[9999px] w-px h-px opacity-0" aria-hidden="true" />
          {estado && (
            <p role="status" className={`mt-3 text-[13px] font-medium ${estado.tipo === "ok" ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
              {estado.texto}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function PorQue() {
  const { contenido } = useSitio();
  const total = contenido.porque.items.length;
  const [activo, setActivo] = useState(0);
  const flecha = (dir: -1 | 1) => (
    <button
      type="button"
      onClick={() => setActivo((a) => (a + dir + total) % total)}
      aria-label={dir < 0 ? "Anterior" : "Siguiente"}
      className="w-8 h-8 rounded-full border border-[var(--gray-300)] bg-white text-[var(--navy)] flex items-center justify-center hover:border-[var(--navy)]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
  const item = contenido.porque.items[activo];

  return (
    <div id="por-que" className="scroll-mt-4">
      <div className="flex items-start justify-between gap-4">
        <Texto ruta={["porque", "titulo"]} como="h2" className="block text-[28px] md:text-[32px] font-bold text-[var(--navy)]" />
        <div className="flex gap-2 mt-2 shrink-0">
          {flecha(-1)}
          {flecha(1)}
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-5 mt-6">
        <div className="relative w-full sm:w-[190px] shrink-0 aspect-[16/10] rounded-md overflow-hidden bg-[var(--navy)]">
          <Imagen key={activo} ruta={["porque", "items", activo, "imagen"]} alt={item.texto} anchoMaximo={700} botonCompacto className="w-full h-full object-cover" />
        </div>
        <Texto ruta={["porque", "items", activo, "texto"]} como="p" multilinea className="block text-[15px] leading-[1.6] font-medium text-[var(--navy)] sm:pt-1" />
      </div>
      <p className="mt-3 text-[12px] text-[var(--gray-400)]" aria-live="polite">
        {activo + 1} de {total}
      </p>
      <div className="flex justify-center mt-6">
        <BotonAccion ruta={["porque", "boton"]} destino="#contacto" />
      </div>
    </div>
  );
}

// ---------- Pie de página / Contacto ----------
function Pie() {
  const { editando } = useSitio();
  return (
    <footer id="contacto" className="sw-oscuro bg-[var(--navy-dark)] text-white scroll-mt-4">
      <div className={`${CONTENEDOR} pt-12 flex justify-center`}>
        <Marca claro />
      </div>
      <nav aria-label="Secciones del sitio" className="mt-9 border-y border-white/10">
        <div className={`${CONTENEDOR} flex flex-wrap justify-center gap-x-7 gap-y-2 py-4 text-[12.5px] text-[#a9c2ee]`}>
          {SECCIONES.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => editando && e.preventDefault()} className="hover:text-white">
              <Texto ruta={["menu", s.clave]} />
            </a>
          ))}
        </div>
      </nav>
      <div className={`${CONTENEDOR} grid sm:grid-cols-3 gap-7 py-9`}>
        {[
          { icono: <IconoUbicacion size={20} />, etiqueta: "etiquetaDireccion" as const, valor: <Texto ruta={["contacto", "direccion"]} multilinea /> },
          { icono: <IconoTelefono size={20} />, etiqueta: "etiquetaTelefono" as const, valor: <DatoContacto tipo="telefono" /> },
          { icono: <IconoCorreo size={20} />, etiqueta: "etiquetaCorreo" as const, valor: <DatoContacto tipo="correo" className="break-all" /> },
        ].map((c) => (
          <div key={c.etiqueta} className="flex gap-3.5">
            <span className="w-10 h-10 shrink-0 rounded-full bg-white/10 text-[#d5e0f7] flex items-center justify-center">{c.icono}</span>
            <div className="text-[13px] leading-[1.55]">
              <Texto ruta={["contacto", c.etiqueta]} como="p" className="block text-[#a9c2ee]" />
              <div className="text-white">{c.valor}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className={`${CONTENEDOR} relative flex flex-col-reverse sm:flex-row items-center justify-between gap-4 py-5`}>
          <Texto ruta={["pie", "copyright"]} como="p" className="block text-[12px] text-[#8fa3c9]" />
          <a
            href="#inicio"
            onClick={(e) => editando && e.preventDefault()}
            className="sm:absolute sm:left-1/2 sm:-translate-x-1/2 flex items-center gap-2 text-[12px] text-[#a9c2ee] hover:text-white"
          >
            <span className="w-8 h-8 rounded-full border border-white/25 flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="M6 15l6-6 6 6" />
              </svg>
            </span>
            <Texto ruta={["pie", "volverArriba"]} />
          </a>
          <Redes claro />
        </div>
      </div>
    </footer>
  );
}

// ---------- Barra de administración (solo sysadmin) ----------
function BarraAdmin({
  editando,
  hayCambios,
  guardando,
  onEditar,
  onGuardar,
  onDescartar,
  onRedes,
  onSuscriptores,
}: {
  editando: boolean;
  hayCambios: boolean;
  guardando: boolean;
  onEditar: () => void;
  onGuardar: () => void;
  onDescartar: () => void;
  onRedes: () => void;
  onSuscriptores: () => void;
}) {
  const cerrarSesion = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.reload();
  };
  return (
    <div className="sticky top-0 z-[60] bg-[var(--navy-dark)] text-white border-b border-white/10">
      <div className="max-w-[1440px] mx-auto px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px]">
        <p className="flex-1 min-w-[200px] text-[#d5e0f7]">
          {editando
            ? hayCambios
              ? "Tienes cambios sin guardar."
              : "Modo edición: haz clic en un texto para escribir o en una imagen para cambiarla."
            : "Estás viendo el sitio como lo ven tus visitantes."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {editando ? (
            <>
              <button type="button" onClick={onRedes} className="sw-barra-btn">
                Redes sociales
              </button>
              <button type="button" onClick={onSuscriptores} className="sw-barra-btn">
                Suscriptores
              </button>
              <button type="button" onClick={onDescartar} disabled={guardando} className="sw-barra-btn">
                {hayCambios ? "Descartar cambios" : "Salir de edición"}
              </button>
              <button type="button" onClick={onGuardar} disabled={!hayCambios || guardando} className="sw-btn py-1.5">
                {guardando ? "Guardando..." : "Guardar cambios"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={onSuscriptores} className="sw-barra-btn">
                Suscriptores
              </button>
              <Link href="/" className="sw-barra-btn">
                Ir al sistema
              </Link>
              <button type="button" onClick={cerrarSesion} className="sw-barra-btn">
                Cerrar sesión
              </button>
              <button type="button" onClick={onEditar} className="sw-btn py-1.5">
                Editar sitio
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Página ----------
export default function SitioWeb({ inicial }: { inicial: SitioContenido }) {
  const sesion = useSesion();
  const esAdmin = sesion.ok && sesion.rol === "sysadmin";
  const [guardado, setGuardado] = useState<SitioContenido>(inicial);
  const [contenido, setContenido] = useState<SitioContenido>(inicial);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [panel, setPanel] = useState<null | "redes" | "suscriptores">(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);

  // Siempre el contenido más reciente (para guardar justo después de terminar de escribir un texto).
  const contenidoRef = useRef(contenido);
  useLayoutEffect(() => {
    contenidoRef.current = contenido;
  }, [contenido]);

  const hayCambios = useMemo(() => JSON.stringify(contenido) !== JSON.stringify(guardado), [contenido, guardado]);

  // Evita perder cambios al cerrar o recargar la pestaña.
  useEffect(() => {
    if (!hayCambios) return;
    const antes = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", antes);
    return () => window.removeEventListener("beforeunload", antes);
  }, [hayCambios]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 4500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  const cambiar = useCallback((ruta: RutaCampo, valor: string) => {
    setContenido((c) => escribirCampo(c, ruta, valor));
  }, []);

  const subirImagen = useCallback(async (ruta: RutaCampo, archivo: File, anchoMaximo: number) => {
    try {
      if (!archivo.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen (JPG, PNG o WEBP).");
      const dataUrl = await compressImage(archivo, anchoMaximo, 0.82, 1_800_000);
      const r = await fetch("/api/sitio/imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo subir la imagen.");
      setContenido((c) => escribirCampo(c, ruta, d.url));
      setAviso({ tipo: "ok", texto: "Imagen lista. Recuerda guardar los cambios." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo subir la imagen." });
    }
  }, []);

  const guardar = async () => {
    // Asegura que el texto que se está escribiendo se registre antes de guardar.
    (document.activeElement as HTMLElement | null)?.blur?.();
    await new Promise((r) => setTimeout(r, 0));
    setGuardando(true);
    try {
      const r = await fetch("/api/sitio/contenido", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: contenidoRef.current }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudieron guardar los cambios.");
      setGuardado(d.contenido);
      setContenido(d.contenido);
      setEditando(false);
      setAviso({ tipo: "ok", texto: "Cambios guardados. El sitio ya está actualizado." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudieron guardar los cambios." });
    } finally {
      setGuardando(false);
    }
  };

  const descartar = () => {
    if (hayCambios && !window.confirm("¿Descartar los cambios que no has guardado?")) return;
    setContenido(guardado);
    setEditando(false);
  };

  const ctx = useMemo(() => ({ contenido, editando, cambiar, subirImagen }), [contenido, editando, cambiar, subirImagen]);

  return (
    <SitioContext.Provider value={ctx}>
      <div className={`sitio-web ${editando ? "sw-modo-edicion" : ""}`}>
        {esAdmin && (
          <BarraAdmin
            editando={editando}
            hayCambios={hayCambios}
            guardando={guardando}
            onEditar={() => setEditando(true)}
            onGuardar={guardar}
            onDescartar={descartar}
            onRedes={() => setPanel("redes")}
            onSuscriptores={() => setPanel("suscriptores")}
          />
        )}
        <Encabezado sesionActiva={sesion.ok} />
        <main>
          <Portada />
          <Soluciones />
          <Servicios />
          <Testimonios />
          <section className="bg-[var(--blue-light)] py-16 md:py-20">
            <div className={`${CONTENEDOR} grid md:grid-cols-2 gap-14`}>
              <Boletin />
              <PorQue />
            </div>
          </section>
        </main>
        <Pie />

        {aviso && (
          <div
            role="status"
            className={`fixed z-[110] bottom-5 left-1/2 -translate-x-1/2 max-w-[92vw] px-4 py-2.5 rounded-md shadow-[0_8px_24px_rgba(15,24,69,0.25)] text-[13.5px] font-medium text-white ${aviso.tipo === "ok" ? "bg-[var(--navy)]" : "bg-[var(--red)]"}`}
          >
            {aviso.texto}
          </div>
        )}
        {panel === "redes" && (
          <PanelRedes
            redes={contenido.redes}
            onCerrar={() => setPanel(null)}
            onAplicar={(redes) => setContenido((c) => ({ ...c, redes }))}
          />
        )}
        {panel === "suscriptores" && <PanelSuscriptores onCerrar={() => setPanel(null)} />}
      </div>
    </SitioContext.Provider>
  );
}
