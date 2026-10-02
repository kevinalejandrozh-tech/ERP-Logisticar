"use client";
// Recursos Humanos → Documentos (cliente): análisis de archivos, sustitución de datos e impresión.
// - Word (.docx): se detectan marcadores {{Campo}}, «Campo», [CAMPO] y renglones "Etiqueta: ______";
//   al imprimir se reemplazan por los datos capturados (se convierte a HTML con mammoth).
// - PDF con formulario: se detectan sus campos y se llenan con pdf-lib.
// - Imágenes y PDF sin formulario: se imprimen tal cual.
// Las librerías de conversión (mammoth y pdf.js) se cargan bajo demanda desde cdnjs, igual que QRious.

export type TipoCampo = "texto" | "fecha" | "fecha_auto";
export type CampoDocumento = { clave: string; etiqueta: string; marcador: string; valor: string; tipo: TipoCampo };
export type DocumentoArchivo = { id: number; nombre: string; archivo_nombre: string; mime: string; archivo: string; campos: CampoDocumento[] };

export const MIME_WORD = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const ACEPTA = "application/pdf,image/png,image/jpeg,image/webp,.docx," + MIME_WORD;

type Mammoth = { convertToHtml: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }>; extractRawText: (i: { arrayBuffer: ArrayBuffer }) => Promise<{ value: string }> };
type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (o: { data: Uint8Array }) => { promise: Promise<{ numPages: number; getPage: (n: number) => Promise<PdfPagina> }> };
};
type PdfPagina = {
  getViewport: (o: { scale: number }) => { width: number; height: number };
  render: (o: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => { promise: Promise<void> };
};

const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const MAMMOTH = "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js";

function cargarScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[data-src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.dataset.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("No se pudo cargar el convertidor de documentos. Revisa tu conexión."));
    document.body.appendChild(s);
  });
}

async function mammoth(): Promise<Mammoth> {
  await cargarScript(MAMMOTH);
  return (window as unknown as { mammoth: Mammoth }).mammoth;
}

async function pdfjs(): Promise<PdfJs> {
  await cargarScript(PDFJS);
  const lib = (window as unknown as { pdfjsLib: PdfJs }).pdfjsLib;
  lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  return lib;
}

export function dataUrlABytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function leerComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("No se pudo leer el archivo."));
    r.readAsDataURL(file);
  });
}

export function mimeDe(file: File): string {
  if (file.type) return file.type;
  return /\.docx$/i.test(file.name) ? MIME_WORD : "";
}

const normal = (t: string) => t.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const esFecha = (t: string) => /fecha/i.test(t);
const titulo = (t: string) => {
  const x = t.replace(/[_\s]+/g, " ").trim().toLowerCase();
  return x.charAt(0).toUpperCase() + x.slice(1);
};

// Analiza el archivo y propone los campos editables (información importante del documento).
export async function analizarDocumento(dataUrl: string, mime: string): Promise<CampoDocumento[]> {
  const campos: CampoDocumento[] = [];
  const agregar = (etiqueta: string, marcador: string) => {
    const e = titulo(etiqueta);
    if (!e || campos.some((c) => c.marcador === marcador)) return;
    campos.push({ clave: `c${campos.length + 1}`, etiqueta: e, marcador, valor: "", tipo: esFecha(e) ? "fecha_auto" : "texto" });
  };
  if (mime === MIME_WORD) {
    const m = await mammoth();
    const { value: texto } = await m.extractRawText({ arrayBuffer: dataUrlABytes(dataUrl).buffer as ArrayBuffer });
    for (const x of texto.matchAll(/\{\{\s*([^{}]{1,60}?)\s*\}\}/g)) agregar(x[1], x[0]);
    for (const x of texto.matchAll(/«([^«»]{1,60})»/g)) agregar(x[1], x[0]);
    for (const x of texto.matchAll(/\[([A-ZÁÉÍÓÚÑ0-9 _]{3,60})\]/g)) agregar(x[1], x[0]);
    for (const x of texto.matchAll(/([A-Za-zÁÉÍÓÚÑáéíóúñ][A-Za-zÁÉÍÓÚÑáéíóúñ .()/]{1,50}):\s*(_{3,}|\.{5,})/g)) agregar(x[1], x[0]);
  } else if (mime === "application/pdf") {
    try {
      const { PDFDocument, PDFTextField } = await import("pdf-lib");
      const pdf = await PDFDocument.load(dataUrlABytes(dataUrl), { ignoreEncryption: true });
      for (const f of pdf.getForm().getFields()) {
        if (f instanceof PDFTextField) agregar(f.getName(), `pdf:${f.getName()}`);
      }
    } catch {
      // PDF sin formulario o protegido: se imprime tal cual.
    }
  }
  if (!campos.some((c) => c.tipo === "fecha_auto")) {
    campos.push({ clave: "fecha", etiqueta: "Fecha", marcador: "", valor: "", tipo: "fecha_auto" });
  }
  return campos;
}

export function fechaLarga(d = new Date()): string {
  return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Mexico_City" });
}

// Valor final de un campo (la fecha automática toma el día de hoy si está vacía).
export function valorCampo(c: CampoDocumento): string {
  if (c.tipo === "fecha_auto") return c.valor || fechaLarga();
  if (c.tipo === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(c.valor)) return fechaLarga(new Date(c.valor + "T12:00:00"));
  return c.valor;
}

// Une los campos de varios documentos por etiqueta (para pedir los datos una sola vez en un grupo).
export function camposUnicos(docs: { campos: CampoDocumento[] }[]): CampoDocumento[] {
  const mapa = new Map<string, CampoDocumento>();
  for (const d of docs) for (const c of d.campos || []) if (!mapa.has(normal(c.etiqueta))) mapa.set(normal(c.etiqueta), { ...c });
  return Array.from(mapa.values());
}

export function aplicarValores(campos: CampoDocumento[], valores: CampoDocumento[]): CampoDocumento[] {
  return campos.map((c) => {
    const v = valores.find((x) => normal(x.etiqueta) === normal(c.etiqueta));
    return v ? { ...c, valor: v.valor, tipo: v.tipo } : c;
  });
}

function esc(t: string) {
  return t.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

async function paginasPdf(bytes: Uint8Array): Promise<string[]> {
  const lib = await pdfjs();
  const doc = await lib.getDocument({ data: bytes }).promise;
  const imgs: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pag = await doc.getPage(i);
    const vp = pag.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = vp.width;
    canvas.height = vp.height;
    await pag.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;
    imgs.push(canvas.toDataURL("image/jpeg", 0.9));
  }
  return imgs;
}

// Construye el HTML de impresión de uno o varios documentos con los datos ya aplicados.
export async function htmlImpresion(docs: DocumentoArchivo[], titulo: string): Promise<string> {
  const secciones: string[] = [];
  for (const d of docs) {
    if (d.mime === MIME_WORD) {
      const m = await mammoth();
      let html = (await m.convertToHtml({ arrayBuffer: dataUrlABytes(d.archivo).buffer as ArrayBuffer })).value;
      for (const c of d.campos) {
        if (!c.marcador) continue;
        const valor = esc(valorCampo(c));
        const reemplazo = /:\s*(_{3,}|\.{5,})$/.test(c.marcador) ? `${esc(c.marcador.replace(/:\s*(_{3,}|\.{5,})$/, ""))}: <b>${valor}</b>` : `<b>${valor}</b>`;
        html = html.split(esc(c.marcador)).join(reemplazo).split(c.marcador).join(reemplazo);
      }
      secciones.push(`<section class="hoja word">${html}</section>`);
    } else if (d.mime === "application/pdf") {
      let bytes = dataUrlABytes(d.archivo);
      const conFormulario = d.campos.filter((c) => c.marcador.startsWith("pdf:"));
      if (conFormulario.length) {
        try {
          const { PDFDocument } = await import("pdf-lib");
          const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
          const form = pdf.getForm();
          for (const c of conFormulario) {
            try {
              form.getTextField(c.marcador.slice(4)).setText(valorCampo(c));
            } catch {
              // campo no encontrado
            }
          }
          form.flatten();
          bytes = await pdf.save();
        } catch {
          // si no se puede llenar, se imprime el original
        }
      }
      for (const img of await paginasPdf(bytes)) secciones.push(`<section class="hoja img"><img src="${img}" alt="" /></section>`);
    } else {
      secciones.push(`<section class="hoja img"><img src="${d.archivo}" alt="" /></section>`);
    }
  }
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" /><title>${esc(titulo)}</title>
<style>
  @page { size: letter; margin: 0.5in; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #eef0f4; font-family: Roboto, "Segoe UI", Arial, sans-serif; color: #111827; }
  .hoja { background: #fff; width: 8.5in; min-height: 11in; margin: 16px auto; padding: 0.6in; box-shadow: 0 1px 6px rgba(0,0,0,.12); page-break-after: always; }
  .hoja:last-of-type { page-break-after: auto; }
  .hoja.img { padding: 0.3in; display: flex; align-items: flex-start; justify-content: center; }
  .hoja.img img { max-width: 100%; max-height: 10.4in; object-fit: contain; }
  .word { font-size: 12pt; line-height: 1.5; } .word table { border-collapse: collapse; } .word td, .word th { border: 1px solid #999; padding: 4px; }
  .word img { max-width: 100%; }
  @media print { body { background: #fff; } .hoja { margin: 0; box-shadow: none; width: auto; min-height: 0; padding: 0; } .hoja.img { padding: 0; } }
</style></head><body>${secciones.join("\n")}</body></html>`;
}
