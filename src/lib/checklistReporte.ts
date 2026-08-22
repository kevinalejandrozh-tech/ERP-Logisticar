// Genera una página de "Informe Técnico" para un registro del Check List Diario de Unidades,
// dibujada dentro de un documento jsPDF ya creado (permite generar 1 o varias páginas seguidas).
// Todos los "iconos" se dibujan con primitivas vectoriales de jsPDF (líneas/círculos/rectángulos):
// los glifos Unicode/emoji no son confiables en la generación de PDF.
import { SECCIONES, NIVELES_LABELS, NIVEL_OPCIONES, OPCIONES_CABINA } from "@/lib/checklistData";

export type Evidencia = { foto: string; descripcion: string };
export type RegistroChecklist = {
  id: number;
  folio: string;
  eco_unidad: string;
  descripcion_unidad: string;
  placas: string;
  fecha_hora: string;
  kilometraje_actual: string | number | null;
  niveles: Record<string, { nivel: string; litros: string; observaciones: string }> | null;
  checklist: Record<string, { valor: "si" | "no" | null; comentario: string; comentarioActivo: boolean }> | null;
  porcentaje_llenado: string | number | null;
};

const COLUMNAS_CHECKLIST = SECCIONES.map((s) => [s]);

const NAVY: [number, number, number] = [22, 33, 92];
const BLUE: [number, number, number] = [47, 111, 237];
const RED: [number, number, number] = [226, 65, 44];
const GREEN: [number, number, number] = [33, 168, 102];
const AMBER: [number, number, number] = [242, 177, 52];
const GRAY_200: [number, number, number] = [229, 232, 238];
const GRAY_300: [number, number, number] = [205, 210, 220];
const GRAY_400: [number, number, number] = [154, 161, 176];
const WHITE: [number, number, number] = [255, 255, 255];

function cargarQRiousLib(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).QRious) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrious/4.0.2/qrious.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el generador de código QR."));
    document.body.appendChild(script);
  });
}
async function generarImagenQR(valor: string): Promise<string> {
  await cargarQRiousLib();
  const canvas = document.createElement("canvas");
  new (window as any).QRious({ element: canvas, value: valor, size: 300, level: "M" });
  return canvas.toDataURL("image/png");
}

// =================== ICONOS VECTORIALES (dibujados con primitivas, sin emoji) ===================

function badge(doc: any, cx: number, cy: number, r: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.circle(cx, cy, r, "F");
}

function iconoCamion(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  const x = cx - s / 2;
  const y = cy - s * 0.32;
  doc.rect(x, y, s * 0.6, s * 0.4);
  doc.rect(x + s * 0.6, y + s * 0.14, s * 0.32, s * 0.26);
  doc.setFillColor(...color);
  doc.circle(x + s * 0.16, y + s * 0.4, s * 0.09, "F");
  doc.circle(x + s * 0.68, y + s * 0.4, s * 0.09, "F");
}
function iconoAuto(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  const x = cx - s / 2;
  const y = cy - s * 0.22;
  doc.roundedRect(x, y, s, s * 0.34, s * 0.08, s * 0.08, "S");
  doc.setFillColor(...color);
  doc.circle(x + s * 0.22, y + s * 0.34, s * 0.09, "F");
  doc.circle(x + s * 0.78, y + s * 0.34, s * 0.09, "F");
}
function iconoPlaca(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  doc.roundedRect(cx - s / 2, cy - s * 0.32, s, s * 0.64, s * 0.08, s * 0.08, "S");
  doc.line(cx - s * 0.15, cy - s * 0.32, cx - s * 0.15, cy + s * 0.32);
}
function iconoVelocimetro(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  doc.circle(cx, cy, s * 0.42, "S");
  doc.line(cx, cy, cx + s * 0.24, cy - s * 0.2);
  doc.setFillColor(...color);
  doc.circle(cx, cy, s * 0.05, "F");
}
function iconoCombustible(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  const x = cx - s * 0.32;
  const y = cy - s * 0.4;
  doc.roundedRect(x, y, s * 0.5, s * 0.8, s * 0.06, s * 0.06, "S");
  doc.line(x + s * 0.5, y + s * 0.15, x + s * 0.72, y + s * 0.3);
  doc.line(x + s * 0.72, y + s * 0.3, x + s * 0.72, y + s * 0.55);
  doc.line(x + s * 0.12, y + s * 0.18, x + s * 0.38, y + s * 0.18);
}
function iconoCalendario(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  const x = cx - s / 2;
  const y = cy - s * 0.4;
  doc.roundedRect(x, y, s, s * 0.8, s * 0.06, s * 0.06, "S");
  doc.line(x, y + s * 0.24, x + s, y + s * 0.24);
  doc.line(x + s * 0.24, y - s * 0.08, x + s * 0.24, y + s * 0.1);
  doc.line(x + s * 0.76, y - s * 0.08, x + s * 0.76, y + s * 0.1);
}
function iconoGota(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setFillColor(...color);
  doc.circle(cx, cy + s * 0.08, s * 0.34, "F");
  doc.triangle(cx - s * 0.22, cy, cx + s * 0.22, cy, cx, cy - s * 0.42, "F");
}
function iconoLupa(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.05);
  doc.circle(cx - s * 0.06, cy - s * 0.06, s * 0.3, "S");
  doc.line(cx + s * 0.14, cy + s * 0.14, cx + s * 0.36, cy + s * 0.36);
}
function iconoMas(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.05);
  doc.roundedRect(cx - s / 2, cy - s / 2, s, s, s * 0.14, s * 0.14, "S");
  doc.line(cx - s * 0.22, cy, cx + s * 0.22, cy);
  doc.line(cx, cy - s * 0.22, cx, cy + s * 0.22);
}
function iconoDocumento(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  const x = cx - s * 0.32;
  const y = cy - s * 0.4;
  doc.rect(x, y, s * 0.64, s * 0.8, "S");
  doc.line(x + s * 0.12, y + s * 0.24, x + s * 0.52, y + s * 0.24);
  doc.line(x + s * 0.12, y + s * 0.42, x + s * 0.52, y + s * 0.42);
  doc.line(x + s * 0.12, y + s * 0.6, x + s * 0.36, y + s * 0.6);
}
function iconoCheckCirculo(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.05);
  doc.circle(cx, cy, s * 0.42, "S");
  doc.line(cx - s * 0.18, cy, cx - s * 0.04, cy + s * 0.16);
  doc.line(cx - s * 0.04, cy + s * 0.16, cx + s * 0.2, cy - s * 0.16);
}
function iconoAlerta(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.05);
  doc.triangle(cx, cy - s * 0.42, cx - s * 0.42, cy + s * 0.3, cx + s * 0.42, cy + s * 0.3, "S");
  doc.setFillColor(...color);
  doc.rect(cx - s * 0.035, cy - s * 0.16, s * 0.07, s * 0.26, "F");
  doc.circle(cx, cy + s * 0.19, s * 0.045, "F");
}
function iconoPersona(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  doc.circle(cx, cy - s * 0.2, s * 0.18, "S");
  doc.roundedRect(cx - s * 0.28, cy + s * 0.02, s * 0.56, s * 0.4, s * 0.14, s * 0.14, "S");
}
function iconoLapiz(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  doc.line(cx - s * 0.32, cy + s * 0.32, cx + s * 0.24, cy - s * 0.24);
  doc.setFillColor(...color);
  doc.triangle(cx + s * 0.24, cy - s * 0.24, cx + s * 0.36, cy - s * 0.12, cx + s * 0.28, cy - s * 0.04, "F");
}
function iconoComentario(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  doc.roundedRect(cx - s / 2, cy - s * 0.34, s, s * 0.6, s * 0.1, s * 0.1, "S");
  doc.setFillColor(...color);
  doc.triangle(cx - s * 0.28, cy + s * 0.2, cx - s * 0.1, cy + s * 0.2, cx - s * 0.24, cy + s * 0.4, "F");
}
function iconoTijeras(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.045);
  doc.line(cx - s * 0.3, cy - s * 0.28, cx + s * 0.3, cy + s * 0.28);
  doc.line(cx - s * 0.3, cy + s * 0.28, cx + s * 0.3, cy - s * 0.28);
  doc.circle(cx - s * 0.32, cy - s * 0.3, s * 0.09, "S");
  doc.circle(cx - s * 0.32, cy + s * 0.3, s * 0.09, "S");
}
function iconoEngrane(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) {
  doc.setDrawColor(...color);
  doc.setLineWidth(0.04);
  doc.circle(cx, cy, s * 0.28, "S");
  doc.setFillColor(...color);
  for (let i = 0; i < 8; i++) {
    const ang = (i * Math.PI) / 4;
    doc.circle(cx + Math.cos(ang) * s * 0.4, cy + Math.sin(ang) * s * 0.4, s * 0.05, "F");
  }
}

// =================== Lógica de textos ===================

function textoObservacion(seccionKey: string, punto: string, comentario: string): string {
  const comentarioLimpio = comentario.trim();
  if (seccionKey === "adicionales") {
    const base = `Falta en la unidad: ${punto}`;
    return comentarioLimpio ? `${base} — ${comentarioLimpio}` : base;
  }
  if (seccionKey === "cabina") {
    const opciones = OPCIONES_CABINA[punto];
    const textoNegativo = opciones ? opciones[1] : "Marcado como No";
    return comentarioLimpio ? `${textoNegativo} — ${comentarioLimpio}` : textoNegativo;
  }
  return comentarioLimpio || "Marcado como No";
}

const ICONO_SECCION: Record<string, (doc: any, cx: number, cy: number, s: number, color: [number, number, number]) => void> = {
  cabina: iconoLupa,
  adicionales: iconoMas,
  documentacion: iconoDocumento,
};

// =================== Dibujo principal ===================

export async function dibujarInformeChecklist(doc: any, registro: RegistroChecklist, yBase: number) {
  const pageW = 21.59;
  const pageH = 27.94;
  const altoMitad = pageH / 2;
  const marginX = 1.0;
  const contentW = pageW - marginX * 2;

  // ---------- Encabezado ----------
  const altoHeader = 1.85;
  doc.setFillColor(...NAVY);
  doc.rect(0, yBase, pageW, altoHeader, "F");
  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("INFORME TÉCNICO", marginX, yBase + 0.72);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(169, 194, 238);
  doc.text("CHECK LIST DIARIO DE UNIDADES", marginX, yBase + 1.12);

  // Pill blanca con el folio
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  const anchoFolio = doc.getTextWidth(registro.folio) + 0.7;
  doc.setFillColor(...WHITE);
  doc.roundedRect(pageW - marginX - anchoFolio, yBase + 0.32, anchoFolio, 0.5, 0.25, 0.25, "F");
  doc.setTextColor(...NAVY);
  doc.text(registro.folio, pageW - marginX - anchoFolio / 2, yBase + 0.62, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...WHITE);
  const fecha = new Date(registro.fecha_hora).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  iconoCalendario(doc, pageW - marginX - anchoFolio + 0.18, yBase + 1.14, 0.22, WHITE);
  doc.text(fecha, pageW - marginX - anchoFolio + 0.36, yBase + 1.18);

  // ---------- Datos generales (icono + etiqueta + valor) + QR ----------
  let y = yBase + altoHeader + 0.34;
  const qrSize = 1.85;
  const datosW = contentW - qrSize - 0.35;
  const campos: [(doc: any, cx: number, cy: number, s: number, color: [number, number, number]) => void, string, string][] = [
    [iconoCamion, "Unidad", registro.eco_unidad || "—"],
    [iconoAuto, "Descripción", registro.descripcion_unidad || "—"],
    [iconoPlaca, "Placas", registro.placas || "—"],
    [iconoVelocimetro, "Kilometraje", registro.kilometraje_actual ? `${Number(registro.kilometraje_actual).toLocaleString("es-MX")} km` : "—"],
    [iconoCombustible, "% Llenado", `${registro.porcentaje_llenado ?? 0}%`],
    [iconoCalendario, "Fecha y hora", fecha],
  ];
  const colW = datosW / 3;
  campos.forEach(([icono, label, valor], i) => {
    const col = i % 3;
    const fila = Math.floor(i / 3);
    const x = marginX + col * colW;
    const yy = y + 0.28 + fila * 0.95;
    icono(doc, x + 0.26, yy, 0.46, BLUE);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(...GRAY_400);
    doc.text(label.toUpperCase(), x + 0.6, yy - 0.12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...NAVY);
    doc.text(String(valor), x + 0.6, yy + 0.24, { maxWidth: colW - 0.65 });
  });

  const qrX = marginX + datosW + 0.35;
  const altoQrImagen = qrSize - 0.4;
  doc.setDrawColor(...GRAY_300);
  doc.setLineWidth(0.015);
  doc.roundedRect(qrX, y, qrSize, altoQrImagen, 0.08, 0.08, "S");
  try {
    const qrUrl = `${window.location.origin}/checklist-evidencias?id=${registro.id}`;
    const imagenQR = await generarImagenQR(qrUrl);
    doc.addImage(imagenQR, "PNG", qrX + 0.12, y + 0.12, qrSize - 0.24, altoQrImagen - 0.24);
  } catch {
    // si falla la generacion del QR, se omite sin interrumpir el reporte
  }
  doc.setFillColor(...NAVY);
  doc.roundedRect(qrX, y + altoQrImagen, qrSize, 0.4, 0.08, 0.08, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(...WHITE);
  doc.text("VER FOTOS", qrX + qrSize / 2, y + altoQrImagen + 0.24, { align: "center" });

  // ---------- Niveles de fluidos ----------
  y += qrSize + 0.3;
  doc.setFillColor(...NAVY);
  doc.roundedRect(marginX, y, contentW, 0.42, 0.08, 0.08, "F");
  iconoGota(doc, marginX + 0.26, y + 0.21, 0.24, WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text("NIVELES DE FLUIDOS", marginX + 0.5, y + 0.27);
  y += 0.42 + 0.24;

  const niveles = registro.niveles || {};
  const filaNivel = 0.38;
  NIVELES_LABELS.forEach((n) => {
    const dato = niveles[n.key];
    const nivelIdx = dato ? NIVEL_OPCIONES.indexOf(dato.nivel) + 1 : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.4);
    doc.setTextColor(40, 40, 40);
    doc.text(n.label, marginX, y + 0.22, { maxWidth: 5.3 });

    const barX = marginX + 5.6;
    const segTotal = 5;
    const segW = 0.42;
    const segH = 0.28;
    const segLlenos = nivelIdx > 0 ? Math.round((nivelIdx / NIVEL_OPCIONES.length) * segTotal) : 0;
    for (let s = 0; s < segTotal; s++) {
      const relleno = s < segLlenos;
      doc.setFillColor(...(relleno ? BLUE : GRAY_200));
      doc.rect(barX + s * (segW + 0.04), y, segW, segH, "F");
    }
    const finBarraX = barX + segTotal * (segW + 0.04) + 0.16;
    const bajoOVacio = nivelIdx > 0 && nivelIdx <= 2;
    if (nivelIdx === 0 || bajoOVacio) {
      iconoAlerta(doc, finBarraX, y + 0.14, 0.28, AMBER);
    } else {
      iconoCheckCirculo(doc, finBarraX, y + 0.14, 0.28, GREEN);
    }

    const detalle = [dato?.litros ? `${dato.litros} L` : "", dato?.observaciones || ""].filter(Boolean).join(" · ");
    if (detalle) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(6.4);
      doc.setTextColor(...GRAY_400);
      doc.text(detalle, marginX, y + 0.42, { maxWidth: contentW });
      y += filaNivel + 0.16;
    } else {
      y += filaNivel;
    }
  });

  // Leyenda de la barra
  y += 0.06;
  const leyenda: [string, [number, number, number]][] = [
    ["LLENO", BLUE],
    ["BAJO", GRAY_300],
    ["VACÍO", WHITE],
  ];
  let xl = marginX;
  leyenda.forEach(([texto, color]) => {
    doc.setFillColor(...color);
    if (texto === "VACÍO") {
      doc.setDrawColor(...GRAY_300);
      doc.setLineWidth(0.012);
      doc.rect(xl, y - 0.14, 0.3, 0.16, "S");
    } else {
      doc.rect(xl, y - 0.14, 0.3, 0.16, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(90, 90, 90);
    doc.text(texto, xl + 0.4, y - 0.02);
    xl += doc.getTextWidth(texto) + 0.85;
  });
  y += 0.32;

  // ---------- Checklist de inspección ----------
  doc.setFillColor(...NAVY);
  doc.roundedRect(marginX, y, contentW, 0.42, 0.08, 0.08, "F");
  iconoLupa(doc, marginX + 0.26, y + 0.21, 0.24, WHITE);
  const totalPuntos = SECCIONES.reduce((a, s) => a + s.puntos.length, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...WHITE);
  doc.text(`CHECKLIST DE INSPECCIÓN (${totalPuntos} PUNTOS)`, marginX + 0.5, y + 0.27);
  y += 0.42 + 0.3;

  const checklist = registro.checklist || {};
  const colGap = 0.35;
  const numCols = COLUMNAS_CHECKLIST.length;
  const checkColW = (contentW - colGap * (numCols - 1)) / numCols;
  const yInicioChecklist = y;
  const yCol = COLUMNAS_CHECKLIST.map(() => yInicioChecklist);
  const filaPunto = 0.3;
  const observaciones: { comentario: string }[] = [];

  COLUMNAS_CHECKLIST.forEach((secciones, colIdx) => {
    const xCol = marginX + colIdx * (checkColW + colGap);
    secciones.forEach((sec) => {
      const iconoFn = ICONO_SECCION[sec.key] || iconoLupa;
      iconoFn(doc, xCol + 0.17, yCol[colIdx] - 0.05, 0.34, BLUE);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.6);
      doc.setTextColor(...BLUE);
      doc.text(sec.titulo, xCol + 0.4, yCol[colIdx]);
      yCol[colIdx] += 0.32;

      sec.puntos.forEach((punto) => {
        const key = `${sec.key}__${punto}`;
        const dato = checklist[key];
        const valor = dato?.valor ?? null;
        const esNo = valor === "no";
        doc.setFillColor(...(esNo ? RED : BLUE));
        doc.circle(xCol + 0.06, yCol[colIdx] - 0.06, 0.03, "F");
        doc.setFont("helvetica", esNo ? "bold" : "normal");
        doc.setFontSize(7.2);
        doc.setTextColor(...(esNo ? RED : valor === "si" ? [40, 40, 40] : GRAY_400));
        doc.text(punto, xCol + 0.18, yCol[colIdx], { maxWidth: checkColW - 0.22 });
        yCol[colIdx] += filaPunto;

        if (esNo || (dato?.comentario && dato.comentario.trim())) {
          observaciones.push({ comentario: textoObservacion(sec.key, punto, dato?.comentario || "") });
        }
      });
      yCol[colIdx] += 0.16;
    });
  });

  y = Math.max(...yCol) + 0.05;

  if (observaciones.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.4);
    doc.setTextColor(...RED);
    doc.text("OBSERVACIONES", marginX, y);
    y += 0.24;
    observaciones.forEach((o) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.7);
      doc.setTextColor(90, 90, 90);
      doc.text(`•  ${o.comentario}`, marginX, y, { maxWidth: contentW });
      y += 0.25;
    });
  }

  // ---------- Comentarios + Nombre/Firma ----------
  const espacioDisponible = yBase + altoMitad - 0.42 - y;
  const alturaCaja = Math.max(0.85, Math.min(1.5, espacioDisponible));
  const yCajas = y + 0.16;
  const anchoComentarios = contentW * 0.52;
  const anchoFirma = contentW - anchoComentarios - 0.3;

  doc.setDrawColor(...GRAY_300);
  doc.setLineWidth(0.015);
  doc.roundedRect(marginX, yCajas, anchoComentarios, alturaCaja, 0.08, 0.08, "S");
  iconoComentario(doc, marginX + 0.24, yCajas + 0.24, 0.24, GRAY_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...GRAY_400);
  doc.text("COMENTARIOS (una vez impresa la hoja)", marginX + 0.44, yCajas + 0.28);
  const lineasComentario = alturaCaja > 1.1 ? 3 : 2;
  for (let i = 1; i <= lineasComentario; i++) {
    const yl = yCajas + 0.28 + i * ((alturaCaja - 0.28) / (lineasComentario + 0.4));
    doc.setDrawColor(...GRAY_200);
    doc.line(marginX + 0.2, yl, marginX + anchoComentarios - 0.2, yl);
  }

  const xFirma = marginX + anchoComentarios + 0.3;
  doc.setDrawColor(...GRAY_300);
  doc.roundedRect(xFirma, yCajas, anchoFirma, alturaCaja, 0.08, 0.08, "S");
  const mitadCaja = alturaCaja / 2;
  iconoPersona(doc, xFirma + 0.24, yCajas + 0.24, 0.24, GRAY_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...GRAY_400);
  doc.text("NOMBRE DE QUIEN REALIZÓ LA INSPECCIÓN", xFirma + 0.44, yCajas + 0.28, { maxWidth: anchoFirma - 0.6 });
  doc.setDrawColor(...GRAY_200);
  doc.line(xFirma + 0.2, yCajas + mitadCaja - 0.08, xFirma + anchoFirma - 0.2, yCajas + mitadCaja - 0.08);

  iconoLapiz(doc, xFirma + 0.24, yCajas + mitadCaja + 0.28, 0.22, GRAY_400);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.setTextColor(...GRAY_400);
  doc.text("FIRMA", xFirma + 0.44, yCajas + mitadCaja + 0.32);
  doc.line(xFirma + 0.2, yCajas + alturaCaja - 0.16, xFirma + anchoFirma - 0.2, yCajas + alturaCaja - 0.16);

  // ---------- Pie de esta mitad ----------
  const yPie = yBase + altoMitad - 0.4;
  doc.setFillColor(...NAVY);
  doc.rect(0, yPie, pageW, 0.4, "F");
  iconoEngrane(doc, marginX + 0.14, yPie + 0.2, 0.2, [169, 194, 238]);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.6);
  doc.setTextColor(169, 194, 238);
  doc.text(`GENERADO EL ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" }).toUpperCase()}  ·  TRANSPORTES LOGISTICAR`, marginX + 0.34, yPie + 0.24);
  // franjas decorativas (rectángulos verticales alternados, dentro de los límites del pie)
  doc.setFillColor(37, 49, 112);
  const anchoFranjas = 3.0;
  for (let i = 0; i < 6; i++) {
    const xf = pageW - anchoFranjas + i * 0.52;
    doc.rect(xf, yPie + 0.06, 0.24, 0.28, "F");
  }
}

// Dibuja la línea guía de corte al centro de la hoja, entre los dos informes
export function dibujarDivisor(doc: any) {
  const pageW = 21.59;
  const pageH = 27.94;
  const yMedio = pageH / 2;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.01);
  doc.setLineDashPattern([0.15, 0.1], 0);
  doc.line(1.0, yMedio, pageW - 0.5, yMedio);
  doc.setLineDashPattern([], 0);
  iconoTijeras(doc, 0.5, yMedio, 0.34, [150, 150, 150]);
}
