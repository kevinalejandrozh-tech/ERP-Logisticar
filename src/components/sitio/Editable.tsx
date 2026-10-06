"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { estiloAjuste, leerCampo, rutaAjuste, RutaCampo, SitioContenido } from "@/lib/sitioData";
import type { VistaImagen } from "./AjusteImagen";

export type OpcionesImagen = {
  anchoMaximo: number; // ancho máximo al que se comprime una imagen nueva
  aspecto: number; // proporción (ancho / alto) del marco donde se muestra
  vistas?: VistaImagen[]; // proporciones alternativas para la vista previa (p. ej. escritorio y móvil)
};

type ContextoSitio = {
  contenido: SitioContenido;
  editando: boolean;
  cambiar: (ruta: RutaCampo, valor: string) => void;
  // Cambios que afectan varias partes del contenido a la vez (agregar o eliminar elementos de una lista).
  actualizar: (fn: (c: SitioContenido) => SitioContenido) => void;
  // Abre el ajuste de zoom y posición: con un archivo nuevo, o (archivo = null) con la imagen que ya está puesta.
  editarImagen: (ruta: RutaCampo, archivo: File | null, opciones: OpcionesImagen) => Promise<void>;
};

export const SitioContext = createContext<ContextoSitio | null>(null);

export function useSitio(): ContextoSitio {
  const ctx = useContext(SitioContext);
  if (!ctx) throw new Error("useSitio debe usarse dentro de SitioContext.");
  return ctx;
}

// Texto editable: en vista pública es texto normal; en modo edición se escribe directo sobre la página.
export function Texto({
  ruta,
  como = "span",
  className = "",
  multilinea = false,
}: {
  ruta: RutaCampo;
  como?: string;
  className?: string;
  multilinea?: boolean;
}) {
  const { contenido, editando, cambiar } = useSitio();
  const valor = leerCampo(contenido, ruta);
  const ref = useRef<HTMLElement | null>(null);

  // El elemento editable no es controlado por React mientras se escribe; solo se sincroniza cuando no tiene el foco.
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== valor) el.innerText = valor;
  }, [valor, editando]);

  const estilo = multilinea ? { whiteSpace: "pre-line" as const } : undefined;
  const Etiqueta = como as React.ElementType;
  if (!editando) {
    return (
      <Etiqueta className={className} style={estilo}>
        {valor}
      </Etiqueta>
    );
  }

  return (
    <Etiqueta
      ref={ref}
      className={`${className} sw-editable`}
      style={estilo}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      role="textbox"
      aria-label="Texto editable"
      aria-multiline={multilinea}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const nuevo = e.currentTarget.innerText.replace(/\u00a0/g, " ").trim();
        if (nuevo !== valor) cambiar(ruta, nuevo);
      }}
      onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" && !multilinea) {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.currentTarget.innerText = valor;
          e.currentTarget.blur();
        }
      }}
      // Pegar siempre como texto simple (sin formato de Word o del navegador).
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        e.preventDefault();
        const texto = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, multilinea ? texto : texto.replace(/\s*\n\s*/g, " "));
      }}
    />
  );
}

// Imagen editable: en modo edición muestra los botones "Cambiar imagen" y "Ajustar" (zoom, posición y recorte).
// El encuadre se guarda aparte ("<campo>Ajuste"), sin modificar el archivo.
export function Imagen({
  ruta,
  alt,
  className = "",
  anchoMaximo = 1600,
  aspecto = 16 / 9,
  vistas,
  botonCompacto = false,
  soloBoton = false,
  etiqueta = "Cambiar imagen",
}: {
  ruta: RutaCampo;
  alt: string;
  className?: string;
  anchoMaximo?: number;
  aspecto?: number;
  vistas?: VistaImagen[];
  botonCompacto?: boolean;
  soloBoton?: boolean; // solo los botones (la imagen se muestra en otro lugar, p. ej. dentro de otro botón)
  etiqueta?: string;
}) {
  const { contenido, editando, editarImagen } = useSitio();
  const src = leerCampo(contenido, ruta);
  const ajuste = leerCampo(contenido, rutaAjuste(ruta));
  const input = useRef<HTMLInputElement>(null);
  const [ocupado, setOcupado] = useState(false);
  const opciones: OpcionesImagen = { anchoMaximo, aspecto, vistas };

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setOcupado(true);
    try {
      await editarImagen(ruta, archivo, opciones);
    } finally {
      setOcupado(false);
    }
  };

  const detener = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  if (soloBoton && !editando) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!soloBoton && <img src={src} alt={alt} className={className} style={estiloAjuste(ajuste)} draggable={false} />}
      {editando && (
        <span className={soloBoton ? "sw-cambiar-imagen-suelto" : "sw-cambiar-imagen"}>
          <button
            type="button"
            onClick={(e) => {
              detener(e);
              input.current?.click();
            }}
            disabled={ocupado}
            title="Cambiar imagen"
            aria-label={botonCompacto ? "Cambiar imagen" : undefined}
            className={botonCompacto ? "sw-btn-imagen sw-btn-imagen-compacto" : "sw-btn-imagen"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 16l-5-5-8 8" />
            </svg>
            {!botonCompacto && (ocupado ? "Cargando..." : etiqueta)}
          </button>
          <button
            type="button"
            onClick={(e) => {
              detener(e);
              void editarImagen(ruta, null, opciones);
            }}
            disabled={ocupado}
            title="Ajustar zoom, posición y recorte"
            aria-label={botonCompacto ? "Ajustar zoom, posición y recorte" : undefined}
            className={botonCompacto ? "sw-btn-imagen sw-btn-imagen-compacto" : "sw-btn-imagen"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 2v14a2 2 0 0 0 2 2h14" />
              <path d="M18 22V8a2 2 0 0 0-2-2H2" />
            </svg>
            {!botonCompacto && "Ajustar"}
          </button>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={elegir} />
        </span>
      )}
    </>
  );
}

// Botón de llamada a la acción: lleva a una sección del sitio; en modo edición solo se edita su texto.
export function BotonAccion({ ruta, destino, className = "" }: { ruta: RutaCampo; destino: string; className?: string }) {
  const { editando } = useSitio();
  if (editando) {
    return (
      <span className={`sw-btn ${className}`}>
        <Texto ruta={ruta} />
      </span>
    );
  }
  return (
    <a href={destino} className={`sw-btn ${className}`}>
      <Texto ruta={ruta} />
    </a>
  );
}
