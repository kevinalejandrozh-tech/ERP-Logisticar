"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSesion } from "@/lib/useSesion";
import { compressImage } from "@/lib/imageUtils";
import {
  escribirCampo,
  estiloAjuste,
  intervaloSegundos,
  leerCampo,
  LIMITES,
  NUEVA_DIAPOSITIVA,
  NUEVO_SERVICIO,
  rutaAjuste,
  RutaCampo,
  SitioContenido,
  TELEFONO_NUEVO,
} from "@/lib/sitioData";
import { BotonAccion, Imagen, OpcionesImagen, SitioContext, Texto, useSitio } from "./Editable";
import AjusteImagen from "./AjusteImagen";
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

// Logotipo oficial de Facebook (círculo azul con la "f" blanca).
function IconoFacebookOficial({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <path
        fill="#1877F2"
        d="M20.181 35.87C29.094 34.791 36 27.202 36 18c0-9.941-8.059-18-18-18S0 8.059 0 18c0 8.442 5.811 15.526 13.652 17.471L14 34h5.5l.681 1.87Z"
      />
      <path
        fill="#fff"
        d="M13.651 35.471v-11.97H9.936V18h3.715v-2.37c0-6.127 2.772-8.964 8.784-8.964 1.138 0 3.103.223 3.91.446v4.983c-.425-.043-1.167-.065-2.081-.065-2.952 0-4.09 1.116-4.09 4.025V18h5.883l-1.008 5.5h-4.867v12.37a18.183 18.183 0 0 1-6.53-.399Z"
      />
    </svg>
  );
}

// Ícono oficial de Google Maps (pin de cuatro colores). El tamaño es el alto.
function IconoMapsOficial({ size = 32 }: { size?: number }) {
  return (
    <svg width={Math.round(size * 0.7)} height={size} viewBox="0 0 92.3 132.3" aria-hidden="true">
      <path fill="#1a73e8" d="M60.2 2.2C55.8.8 51 0 46.1 0 32 0 19.3 6.4 10.8 16.5l21.8 18.3L60.2 2.2z" />
      <path fill="#ea4335" d="M10.8 16.5C4.1 24.5 0 34.9 0 46.1c0 8.7 1.7 15.7 4.6 22l28-33.3-21.8-18.3z" />
      <path
        fill="#4285f4"
        d="M46.2 28.5c9.8 0 17.7 7.9 17.7 17.7 0 4.3-1.6 8.3-4.2 11.4 0 0 13.9-16.6 27.5-32.7-5.6-10.8-15.3-19-27-22.7L32.6 34.8c3.3-3.8 8.1-6.3 13.6-6.3"
      />
      <path
        fill="#fbbc04"
        d="M46.2 63.8c-9.8 0-17.7-7.9-17.7-17.7 0-4.3 1.5-8.3 4.1-11.3l-28 33.3c4.8 10.6 12.8 19.2 21 29.9l34.1-40.5c-3.3 3.9-8.1 6.3-13.5 6.3"
      />
      <path
        fill="#34a853"
        d="M59.1 109.2c15.4-24.1 33.3-35 33.3-63 0-7.7-1.9-14.9-5.2-21.3L25.6 98c2.6 3.4 5.3 7.3 7.9 11.3 9.5 14.9 6.9 23.1 12.6 23.1s3.1-8.2 13-23.2"
      />
    </svg>
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
// Con "indice" es uno de los teléfonos adicionales.
function DatoContacto({ tipo, indice, className = "" }: { tipo: "telefono" | "correo"; indice?: number; className?: string }) {
  const { contenido, editando } = useSitio();
  const ruta: RutaCampo = indice === undefined ? ["contacto", tipo] : ["contacto", "telefonosExtra", indice];
  if (editando) return <Texto ruta={ruta} className={className} />;
  const valor = leerCampo(contenido, ruta);
  const href = tipo === "telefono" ? `tel:${valor.replace(/[^\d+]/g, "")}` : `mailto:${valor}`;
  return (
    <a href={href} className={`${className} hover:underline underline-offset-2`}>
      {valor}
    </a>
  );
}

// Teléfono principal + teléfonos adicionales. En modo edición se pueden agregar y eliminar.
function ListaTelefonos({ variante }: { variante: "barra" | "pie" }) {
  const { contenido, editando, actualizar } = useSitio();
  const extras = contenido.contacto.telefonosExtra;
  const agregar = () =>
    actualizar((c) => ({ ...c, contacto: { ...c.contacto, telefonosExtra: [...c.contacto.telefonosExtra, TELEFONO_NUEVO] } }));
  const quitar = (i: number) =>
    actualizar((c) => ({ ...c, contacto: { ...c.contacto, telefonosExtra: c.contacto.telefonosExtra.filter((_, j) => j !== i) } }));
  return (
    <span className={variante === "barra" ? "flex flex-wrap items-center gap-x-3 gap-y-1" : "flex flex-col items-start gap-1"}>
      <DatoContacto tipo="telefono" />
      {extras.map((_, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {variante === "barra" && <span className="w-px h-3.5 bg-white/30" aria-hidden="true" />}
          <DatoContacto tipo="telefono" indice={i} />
          {editando && (
            <button
              type="button"
              onClick={() => quitar(i)}
              title="Eliminar este teléfono"
              aria-label={`Eliminar el teléfono ${i + 2}`}
              className="w-5 h-5 shrink-0 rounded-full bg-white/15 hover:bg-[var(--red)] text-white text-[13px] leading-none flex items-center justify-center"
            >
              ×
            </button>
          )}
        </span>
      ))}
      {editando && extras.length < LIMITES.telefonosExtra && (
        <button type="button" onClick={agregar} className="rounded-full bg-white/15 hover:bg-white/25 text-white text-[11.5px] font-medium px-2.5 py-0.5">
          + Teléfono
        </button>
      )}
    </span>
  );
}

// Junto al teléfono: botón de llamada directa e íconos oficiales de Facebook y Google Maps (enlaces editables por el sysadmin).
function AccesosTelefono({ compacto = false }: { compacto?: boolean }) {
  const { contenido, editando } = useSitio();
  const telefonos = [contenido.contacto.telefono, ...contenido.contacto.telefonosExtra]
    .map((texto) => ({ texto, tel: texto.replace(/[^\d+]/g, "") }))
    .filter((t) => t.tel);
  const tam = compacto ? 40 : 32;
  const claseIcono = "flex items-center justify-center transition-transform hover:scale-110 focus-visible:scale-110";
  const enlace = (url: string, nombre: string, icono: React.ReactNode) =>
    url ? (
      <a href={editando ? undefined : url} onClick={(e) => editando && e.preventDefault()} target="_blank" rel="noopener noreferrer" aria-label={nombre} title={nombre} className={claseIcono}>
        {icono}
      </a>
    ) : null;
  return (
    <span className={`flex items-center gap-2.5 ${compacto ? "flex-wrap" : ""}`}>
      {compacto
        ? telefonos.map((t, i) => (
            <a key={i} href={editando ? undefined : `tel:${t.tel}`} onClick={(e) => editando && e.preventDefault()} className="btn btn-primario py-1.5 text-[13px]" aria-label={`Llamar al ${t.texto}`}>
              Llamar {telefonos.length > 1 ? t.texto : ""}
            </a>
          ))
        : telefonos[0] && (
            <a
              href={editando ? undefined : `tel:${telefonos[0].tel}`}
              onClick={(e) => editando && e.preventDefault()}
              className="rounded-full bg-white/15 hover:bg-white/25 text-white text-[11.5px] font-medium px-2.5 py-0.5"
              aria-label="Llamar ahora"
            >
              Llamar
            </a>
          )}
      {enlace(contenido.accesos.facebook, "Facebook", <IconoFacebookOficial size={tam} />)}
      {enlace(contenido.accesos.maps, "Ubicación en Google Maps", <IconoMapsOficial size={tam + 4} />)}
    </span>
  );
}

function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icono.png" alt="" width={53} height={53} className="w-[53px] h-[53px] object-contain" draggable={false} />
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
    <a href="/login" className="btn btn-primario whitespace-nowrap">
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
          <div className="sw-oscuro hidden md:flex flex-wrap items-center justify-end gap-x-6 gap-y-1 min-h-11 py-1 px-6 lg:px-12 bg-[var(--navy)] text-white text-[12.5px]">
            <span className="flex items-center gap-2">
              <IconoTelefono size={14} />
              <ListaTelefonos variante="barra" />
              <AccesosTelefono />
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
          <div className="pt-3 flex flex-wrap items-center gap-2">
            <AccesosTelefono compacto />
            <span className="flex-1" />
            {enlaceSesion}
          </div>
        </nav>
      )}
    </header>
  );
}

// ---------- Portada (diapositivas que cambian solas) ----------
const VISTAS_PORTADA = [
  { nombre: "Escritorio", aspecto: 8 / 3 },
  { nombre: "Móvil", aspecto: 4 / 5 },
];

function Portada() {
  const { contenido, editando, cambiar, actualizar } = useSitio();
  const diapositivas = contenido.hero.diapositivas;
  const total = diapositivas.length;
  const segundos = intervaloSegundos(contenido.hero.intervalo);
  const [activa, setActiva] = useState(0);
  const [pausa, setPausa] = useState(false);
  const idx = Math.min(activa, total - 1); // si se eliminan diapositivas, la activa nunca queda fuera de rango

  useEffect(() => {
    if (editando || pausa || total < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => setActiva((a) => (Math.min(a, total - 1) + 1) % total), segundos * 1000);
    return () => window.clearInterval(t);
  }, [editando, pausa, total, segundos]);

  const destinos = ["#soluciones", "#servicios", "#contacto"];

  const agregar = () => {
    actualizar((c) => ({ ...c, hero: { ...c.hero, diapositivas: [...c.hero.diapositivas, NUEVA_DIAPOSITIVA] } }));
    setActiva(total);
  };
  const eliminar = () => {
    if (total <= 1) return;
    if (!window.confirm(`¿Eliminar la diapositiva ${idx + 1} ("${diapositivas[idx].titulo}")?`)) return;
    actualizar((c) => ({ ...c, hero: { ...c.hero, diapositivas: c.hero.diapositivas.filter((_, j) => j !== idx) } }));
    setActiva(Math.max(0, idx - 1));
  };
  const fijarIntervalo = (valor: string) => cambiar(["hero", "intervalo"], valor);

  return (
    <>
      {editando && (
        <div className="bg-[var(--gray-100)] border-b border-[var(--gray-200)]">
          <div className={`${CONTENEDOR} py-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[var(--navy)]`}>
            <span className="font-medium">
              Portada · diapositiva {idx + 1} de {total}
            </span>
            <button type="button" onClick={agregar} disabled={total >= LIMITES.diapositivas} className="sw-btn-imagen" title={total >= LIMITES.diapositivas ? `Máximo ${LIMITES.diapositivas} diapositivas` : undefined}>
              + Agregar diapositiva
            </button>
            <button type="button" onClick={eliminar} disabled={total <= 1} className="sw-btn-imagen sw-btn-peligro" title={total <= 1 ? "La portada necesita al menos una diapositiva" : undefined}>
              Eliminar esta diapositiva
            </button>
            <label className="flex items-center gap-2">
              Cambiar de imagen cada
              <input
                type="number"
                inputMode="numeric"
                min={LIMITES.intervaloMin}
                max={LIMITES.intervaloMax}
                value={contenido.hero.intervalo}
                onFocus={(e) => e.currentTarget.select()}
                onChange={(e) => fijarIntervalo(e.target.value.replace(/\D/g, "").slice(0, 2))}
                onBlur={() => {
                  const n = Number(contenido.hero.intervalo);
                  fijarIntervalo(String(Number.isFinite(n) && n > 0 ? Math.min(LIMITES.intervaloMax, Math.max(LIMITES.intervaloMin, n)) : LIMITES.intervaloInicial));
                }}
                className="w-16 border border-[var(--gray-300)] rounded-md px-2 py-1 text-[13px] bg-white"
              />
              segundos
            </label>
          </div>
        </div>
      )}
      <section
        id="inicio"
        aria-roledescription="carrusel"
        className="sw-oscuro relative h-[480px] md:h-[540px] overflow-hidden bg-[var(--navy-dark)]"
        onMouseEnter={() => setPausa(true)}
        onMouseLeave={() => setPausa(false)}
      >
        {diapositivas.map((d, i) => (
          <div
            key={i}
            inert={i !== idx}
            className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100 z-10" : "opacity-0 z-0 pointer-events-none"}`}
          >
            <Imagen
              ruta={["hero", "diapositivas", i, "imagen"]}
              alt={d.titulo}
              anchoMaximo={1920}
              aspecto={VISTAS_PORTADA[0].aspecto}
              vistas={VISTAS_PORTADA}
              className="absolute inset-0 w-full h-full object-cover"
            />
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
        <div className={`absolute z-20 bottom-8 left-0 right-0 ${CONTENEDOR} flex flex-wrap gap-x-5 gap-y-3 ${total > 5 ? "md:gap-x-6" : "gap-x-6"}`}>
          {diapositivas.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiva(i)}
              aria-label={`Ver diapositiva ${i + 1}`}
              aria-current={i === idx}
              className="group flex flex-col items-start gap-2 text-[14px] font-bold"
            >
              <span className={i === idx ? "text-white" : "text-white/60 group-hover:text-white"}>{String(i + 1).padStart(2, "0")}</span>
              <span className={`block h-[2px] ${total > 5 ? "w-9 md:w-12" : "w-14 md:w-20"} ${i === idx ? "bg-[var(--red)]" : "bg-white/40 group-hover:bg-white/70"}`} />
            </button>
          ))}
        </div>
      </section>
    </>
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
                <Imagen ruta={["soluciones", "tarjetas", i, "imagen"]} alt={t.titulo} anchoMaximo={700} aspecto={22 / 13} botonCompacto className="w-full h-full object-cover" />
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

// ---------- Servicios (imagen grande + miniaturas circulares) ----------
const VISTAS_SERVICIOS = [
  { nombre: "Escritorio", aspecto: 1.5 },
  { nombre: "Móvil", aspecto: 1.2 },
  { nombre: "Miniatura", aspecto: 1 },
];

function Servicios() {
  const { contenido, editando, actualizar } = useSitio();
  const items = contenido.servicios.items;
  const total = items.length;
  const [activo, setActivo] = useState(0);
  const idx = Math.min(activo, total - 1); // si se elimina un servicio, el activo nunca queda fuera de rango
  const item = items[idx];
  const lleno = total >= LIMITES.servicios;

  const agregar = () => {
    if (lleno) return;
    actualizar((c) => ({ ...c, servicios: { ...c.servicios, items: [...c.servicios.items, NUEVO_SERVICIO] } }));
    setActivo(total);
  };
  const eliminar = () => {
    if (total <= 1) return;
    if (!window.confirm(`¿Eliminar el servicio "${item.encabezado}"?`)) return;
    actualizar((c) => ({ ...c, servicios: { ...c.servicios, items: c.servicios.items.filter((_, j) => j !== idx) } }));
    setActivo(Math.max(0, idx - 1));
  };

  const medida = total > 5 ? "w-12 h-12 md:w-[48px] md:h-[48px]" : "w-14 h-14 md:w-[60px] md:h-[60px]";

  return (
    <section id="servicios" className="grid md:grid-cols-2 scroll-mt-4">
      <div className="relative min-h-[320px] md:min-h-[480px] bg-[var(--navy-dark)]">
        <div className="absolute inset-0 overflow-hidden">
          <Imagen
            key={idx}
            ruta={["servicios", "items", idx, "imagen"]}
            alt={item.encabezado}
            anchoMaximo={1200}
            aspecto={VISTAS_SERVICIOS[0].aspecto}
            vistas={VISTAS_SERVICIOS}
            className="absolute inset-0 w-full h-full object-cover"
          />
        </div>
        <div className="absolute z-10 bottom-4 left-1/2 -translate-x-1/2 flex flex-row flex-wrap justify-center gap-3 max-w-[92%] md:max-w-none md:bottom-auto md:left-auto md:right-0 md:top-1/2 md:-translate-y-1/2 md:translate-x-1/2 md:flex-col md:flex-nowrap">
          {items.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActivo(i)}
              aria-label={`Ver: ${s.encabezado}`}
              aria-current={i === idx}
              className={`${medida} rounded-full overflow-hidden border-[3px] shadow-[0_4px_14px_rgba(15,24,69,0.25)] ${i === idx ? "border-[var(--red)]" : "border-white hover:border-[#d5e0f7]"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.imagen} alt="" className="w-full h-full object-cover" style={estiloAjuste(s.imagenAjuste)} draggable={false} />
            </button>
          ))}
          {editando && !lleno && (
            <button
              type="button"
              onClick={agregar}
              aria-label="Agregar servicio"
              title="Agregar servicio"
              className={`${medida} rounded-full border-[3px] border-dashed border-white bg-[var(--navy)] text-white text-[26px] leading-none flex items-center justify-center shadow-[0_4px_14px_rgba(15,24,69,0.25)] hover:bg-[var(--red)]`}
            >
              +
            </button>
          )}
        </div>
      </div>
      <div className="bg-[var(--blue-light)] px-6 md:px-14 lg:px-20 py-14 md:py-16 flex items-center">
        <div className="max-w-[500px] w-full">
          {editando && (
            <div className="sw-controles-edicion mb-6">
              <span className="font-medium">
                Servicio {idx + 1} de {total}
              </span>
              <button type="button" onClick={agregar} disabled={lleno} className="sw-btn-imagen" title={lleno ? `Máximo ${LIMITES.servicios} servicios` : undefined}>
                + Agregar servicio
              </button>
              <button type="button" onClick={eliminar} disabled={total <= 1} className="sw-btn-imagen sw-btn-peligro" title={total <= 1 ? "Debe quedar al menos un servicio" : undefined}>
                Eliminar este servicio
              </button>
            </div>
          )}
          <Texto ruta={["servicios", "titulo"]} como="h2" className="block text-[28px] md:text-[32px] font-bold text-[var(--navy)]" />
          <Texto ruta={["servicios", "subtitulo"]} como="p" className="block mt-1 text-[15px] font-medium text-[var(--red)]" />
          <Texto ruta={["servicios", "items", idx, "encabezado"]} como="h3" className="block mt-7 text-[19px] font-bold text-[var(--navy)]" />
          <Texto ruta={["servicios", "items", idx, "parrafo1"]} como="p" multilinea className="block mt-3 text-[14px] leading-[1.65] text-[var(--gray-500)]" />
          <Texto ruta={["servicios", "items", idx, "parrafo2"]} como="p" multilinea className="block mt-3 text-[14px] leading-[1.65] text-[var(--gray-500)]" />
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
              <img src={t.foto} alt="" className="w-full h-full object-cover" style={estiloAjuste(t.fotoAjuste)} draggable={false} />
            </button>
          ))}
        </div>
        {editando && (
          <div className="flex justify-center mt-4">
            <Imagen ruta={["testimonios", "items", activo, "foto"]} alt="" anchoMaximo={300} aspecto={1} soloBoton etiqueta="Cambiar foto del testimonio" />
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
          <Imagen key={activo} ruta={["porque", "items", activo, "imagen"]} alt={item.texto} anchoMaximo={700} aspecto={1.6} botonCompacto className="w-full h-full object-cover" />
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
          { icono: <IconoTelefono size={20} />, etiqueta: "etiquetaTelefono" as const, valor: <ListaTelefonos variante="pie" /> },
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
              : "Modo edición: haz clic en un texto para escribir; en cada imagen puedes cambiarla o ajustar su zoom y posición."
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
  const [ajusteImg, setAjusteImg] = useState<null | { ruta: RutaCampo; src: string; ajuste: string; nueva: boolean; opciones: OpcionesImagen }>(null);
  const [subiendoImg, setSubiendoImg] = useState(false);
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

  // Abre el ajuste de zoom y posición. Con archivo: imagen nueva (aún no se sube; se sube al aplicar). Sin archivo: la imagen actual.
  const editarImagen = useCallback(async (ruta: RutaCampo, archivo: File | null, opciones: OpcionesImagen) => {
    try {
      if (archivo) {
        if (!archivo.type.startsWith("image/")) throw new Error("El archivo debe ser una imagen (JPG, PNG o WEBP).");
        const dataUrl = await compressImage(archivo, opciones.anchoMaximo, 0.82, 1_800_000);
        setAjusteImg({ ruta, src: dataUrl, ajuste: "", nueva: true, opciones });
      } else {
        const actual = contenidoRef.current;
        setAjusteImg({ ruta, src: leerCampo(actual, ruta), ajuste: leerCampo(actual, rutaAjuste(ruta)), nueva: false, opciones });
      }
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo preparar la imagen." });
    }
  }, []);

  const aplicarAjusteImagen = async (ajuste: string) => {
    const a = ajusteImg;
    if (!a) return;
    if (!a.nueva) {
      cambiar(rutaAjuste(a.ruta), ajuste);
      setAjusteImg(null);
      return;
    }
    setSubiendoImg(true);
    try {
      const r = await fetch("/api/sitio/imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl: a.src }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo subir la imagen.");
      setContenido((c) => escribirCampo(escribirCampo(c, a.ruta, d.url), rutaAjuste(a.ruta), ajuste));
      setAjusteImg(null);
      setAviso({ tipo: "ok", texto: "Imagen lista. Recuerda guardar los cambios." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err instanceof Error ? err.message : "No se pudo subir la imagen." });
    } finally {
      setSubiendoImg(false);
    }
  };

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

  const ctx = useMemo(
    () => ({ contenido, editando, cambiar, actualizar: setContenido, editarImagen }),
    [contenido, editando, cambiar, editarImagen]
  );

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
            accesos={contenido.accesos}
            onCerrar={() => setPanel(null)}
            onAplicar={(redes, accesos) => setContenido((c) => ({ ...c, redes, accesos }))}
          />
        )}
        {panel === "suscriptores" && <PanelSuscriptores onCerrar={() => setPanel(null)} />}
        {ajusteImg && (
          <AjusteImagen
            src={ajusteImg.src}
            ajusteInicial={ajusteImg.ajuste}
            aspecto={ajusteImg.opciones.aspecto}
            vistas={ajusteImg.opciones.vistas}
            esNueva={ajusteImg.nueva}
            aplicando={subiendoImg}
            onAplicar={aplicarAjusteImagen}
            onCancelar={() => !subiendoImg && setAjusteImg(null)}
          />
        )}
      </div>
    </SitioContext.Provider>
  );
}
