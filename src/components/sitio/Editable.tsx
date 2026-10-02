"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { leerCampo, RutaCampo, SitioContenido } from "@/lib/sitioData";

type ContextoSitio = {
  contenido: SitioContenido;
  editando: boolean;
  cambiar: (ruta: RutaCampo, valor: string) => void;
  subirImagen: (ruta: RutaCampo, archivo: File, anchoMaximo: number) => Promise<void>;
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

// Imagen editable: en modo edición muestra el botón "Cambiar imagen".
export function Imagen({
  ruta,
  alt,
  className = "",
  anchoMaximo = 1600,
  botonCompacto = false,
  soloBoton = false,
  etiqueta = "Cambiar imagen",
}: {
  ruta: RutaCampo;
  alt: string;
  className?: string;
  anchoMaximo?: number;
  botonCompacto?: boolean;
  soloBoton?: boolean; // solo el botón (la imagen se muestra en otro lugar, p. ej. dentro de otro botón)
  etiqueta?: string;
}) {
  const { contenido, editando, subirImagen } = useSitio();
  const src = leerCampo(contenido, ruta);
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setSubiendo(true);
    try {
      await subirImagen(ruta, archivo, anchoMaximo);
    } finally {
      setSubiendo(false);
    }
  };

  if (soloBoton && !editando) return null;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {!soloBoton && <img src={src} alt={alt} className={className} draggable={false} />}
      {editando && (
        <span className={soloBoton ? "sw-cambiar-imagen-suelto" : "sw-cambiar-imagen"}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              input.current?.click();
            }}
            disabled={subiendo}
            title="Cambiar imagen"
            className={botonCompacto ? "sw-btn-imagen sw-btn-imagen-compacto" : "sw-btn-imagen"}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="10" r="2" />
              <path d="M21 16l-5-5-8 8" />
            </svg>
            {!botonCompacto && (subiendo ? "Subiendo..." : etiqueta)}
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
