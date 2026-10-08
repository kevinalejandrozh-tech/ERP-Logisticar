// Enlace general de documentos de candidatos: configuración editable por el sysadmin (sin acceso a BD; seguro en cliente).
import { documentosRequeridos, type DocumentoRequerido } from "@/lib/evaluacionCandidatosData";

// Por documento: si es obligatorio (solo lo ve el sysadmin) y un texto de ayuda con link al portal oficial.
export type ConfigDocumento = { obligatorio: boolean; texto: string; url: string };
export type ConfigCargaDocumentos = { documentos: Record<string, ConfigDocumento>; cita_fecha: string; cita_hora: string };
export type DocumentoConfigurado = DocumentoRequerido & ConfigDocumento;

export const CONFIG_DOC_DEFECTO: ConfigDocumento = { obligatorio: true, texto: "", url: "" };
export const CONFIG_CARGA_DEFECTO: ConfigCargaDocumentos = { documentos: {}, cita_fecha: "", cita_hora: "" };

export const URL_VALIDA = /^https?:\/\/[^\s]{3,500}$/i;
export const FECHA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;
export const HORA_VALIDA = /^\d{2}:\d{2}$/;

// Folio consecutivo: RLKA01, RLKA02 … RLKA99, RLKA100 …
export const formatoFolio = (n: number) => `RLKA${String(n).padStart(2, "0")}`;

export function documentosConfigurados(puesto: string, config: ConfigCargaDocumentos): DocumentoConfigurado[] {
  return documentosRequeridos(puesto).map((d) => ({ ...d, ...CONFIG_DOC_DEFECTO, ...(config.documentos[d.id] || {}) }));
}

// Completo = todos los obligatorios con al menos un archivo (si no hay obligatorios, basta con uno cargado).
export function estaCompleto(docs: DocumentoConfigurado[], tiposCargados: string[]) {
  const obligatorios = docs.filter((d) => d.obligatorio);
  if (!obligatorios.length) return tiposCargados.length > 0;
  return obligatorios.every((d) => tiposCargados.includes(d.id));
}

// "2026-07-22" → "22/07/2026"; "08:00" → "08:00:00"
export const fechaCita = (f: string) => (FECHA_VALIDA.test(f) ? f.split("-").reverse().join("/") : "");
export const horaCita = (h: string) => (HORA_VALIDA.test(h) ? `${h}:00` : "");

// El QR lleva a la página privada (requiere sesión de sysadmin), que arma el PDF con todos sus documentos.
export const rutaExpedienteFolio = (folio: string) => `/personas/documentos-candidatos?folio=${encodeURIComponent(folio)}`;
