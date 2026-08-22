// Genera una página de "Informe Técnico" para un registro del Check List Diario de Unidades,
// dibujada dentro de un documento jsPDF ya creado (permite generar 1 o varias páginas seguidas).
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

// Ahora que solo hay 3 secciones (Inspección completa, Adicionales, Documentación),
// cada una ocupa su propia columna.
const COLUMNAS_CHECKLIST = SECCIONES.map((s) => [s]);

const NAVY: [number, number, number] = [22, 33, 92];
const BLUE: [number, number, number] = [47, 111, 237];
const RED: [number, number, number] = [226, 65, 44];
const GRAY_200: [number, number, number] = [229, 232, 238];
const GRAY_400: [number, number, number] = [154, 161, 176];

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

// Determina el texto de observación que se imprime para un punto marcado como "No",
// según la sección a la que pertenece.
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

export async function dibujarInformeChecklist(doc: any, registro: RegistroChecklist, yBase: number) {
  const pageW = 21.59;
  const pageH = 27.94;
  const altoMitad = pageH / 2;
  const marginX = 1.0;
  const contentW = pageW - marginX * 2;

  // ---------- Encabezado ----------
  const altoHeader = 1.55;
  doc.setFillColor(...NAVY);
  doc.rect(0, yBase, pageW, altoHeader, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13.5);
  doc.text("INFORME TÉCNICO", marginX, yBase + 0.62);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(169, 194, 238);
  doc.text("Check List Diario de Unidades", marginX, yBase + 1.08);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(255, 255, 255);
  doc.text(registro.folio, pageW - marginX, yBase + 0.62, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(169, 194, 238);
  const fecha = new Date(registro.fecha_hora).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.text(fecha, pageW - marginX, yBase + 1.08, { align: "right" });

  // ---------- Datos generales + QR ----------
  let y = yBase + altoHeader + 0.28;
  const qrSize = 1.9;
  const datosW = contentW - qrSize - 0.3;
  const altoDatos = qrSize;
  doc.setFillColor(244, 245, 248);
  doc.roundedRect(marginX, y, datosW, altoDatos, 0.1, 0.1, "F");
  const campos: [string, string][] = [
    ["Unidad", registro.eco_unidad || "—"],
    ["Descripción", registro.descripcion_unidad || "—"],
    ["Placas", registro.placas || "—"],
    ["Kilometraje", registro.kilometraje_actual ? `${Number(registro.kilometraje_actual).toLocaleString("es-MX")} km` : "—"],
    ["% Llenado", `${registro.porcentaje_llenado ?? 0}%`],
    ["Fecha y hora", fecha],
  ];
  const colW = datosW / 3;
  campos.forEach(([label, valor], i) => {
    const col = i % 3;
    const fila = Math.floor(i / 3);
    const x = marginX + 0.25 + col * colW;
    const yy = y + 0.5 + fila * 0.95;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(...GRAY_400);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(String(valor), x, yy + 0.36, { maxWidth: colW - 0.3 });
  });

  const qrX = marginX + datosW + 0.3;
  try {
    const qrUrl = `${window.location.origin}/checklist-evidencias?id=${registro.id}`;
    const imagenQR = await generarImagenQR(qrUrl);
    doc.addImage(imagenQR, "PNG", qrX, y, qrSize, qrSize);
  } catch {
    // si falla la generacion del QR, se omite sin interrumpir el reporte
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...GRAY_400);
  doc.text("Ver fotos", qrX + qrSize / 2, y + qrSize + 0.2, { align: "center" });

  // ---------- Niveles de fluidos (con barras) ----------
  y += altoDatos + 0.3;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...NAVY);
  doc.text("NIVELES DE FLUIDOS", marginX, y);
  y += 0.3;
  const niveles = registro.niveles || {};
  const filaNivel = 0.36;
  NIVELES_LABELS.forEach((n) => {
    const dato = niveles[n.key];
    const nivelIdx = dato ? NIVEL_OPCIONES.indexOf(dato.nivel) + 1 : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.2);
    doc.setTextColor(40, 40, 40);
    doc.text(n.label, marginX, y + 0.24, { maxWidth: 5.6 });

    const barX = marginX + 5.9;
    const segW = 0.6;
    const segH = 0.26;
    for (let s = 0; s < 4; s++) {
      const relleno = s < nivelIdx;
      doc.setFillColor(...(relleno ? BLUE : GRAY_200));
      doc.rect(barX + s * (segW + 0.06), y, segW, segH, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.setTextColor(...NAVY);
    doc.text(dato?.nivel || "Sin dato", barX + 4 * (segW + 0.06) + 0.14, y + 0.19);
    let obsX = barX + 2.5;
    if (dato?.litros) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.6);
      doc.setTextColor(90, 90, 90);
      doc.text(`${dato.litros} L`, obsX, y + 0.19);
      obsX += 0.7;
    }
    if (dato?.observaciones) {
      doc.setFontSize(6.6);
      doc.setTextColor(...GRAY_400);
      doc.text(dato.observaciones, obsX, y + 0.19, { maxWidth: marginX + contentW - obsX });
    }
    y += filaNivel;
  });

  // ---------- Checklist de inspección (una columna por sección) ----------
  y += 0.22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...NAVY);
  const totalPuntos = SECCIONES.reduce((a, s) => a + s.puntos.length, 0);
  doc.text(`CHECKLIST DE INSPECCIÓN (${totalPuntos} PUNTOS)`, marginX, y);
  y += 0.32;

  const checklist = registro.checklist || {};
  const colGap = 0.35;
  const numCols = COLUMNAS_CHECKLIST.length;
  const checkColW = (contentW - colGap * (numCols - 1)) / numCols;
  const yInicioChecklist = y;
  const yCol = COLUMNAS_CHECKLIST.map(() => yInicioChecklist);
  const filaPunto = 0.3;
  const observaciones: { punto: string; comentario: string }[] = [];

  COLUMNAS_CHECKLIST.forEach((secciones, colIdx) => {
    const xCol = marginX + colIdx * (checkColW + colGap);
    secciones.forEach((sec) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.3);
      doc.setTextColor(...BLUE);
      doc.text(sec.titulo, xCol, yCol[colIdx]);
      yCol[colIdx] += 0.28;

      sec.puntos.forEach((punto) => {
        const key = `${sec.key}__${punto}`;
        const dato = checklist[key];
        const valor = dato?.valor ?? null;
        const esNo = valor === "no";
        doc.setFont("helvetica", esNo ? "bold" : "normal");
        doc.setFontSize(7);
        doc.setTextColor(...(esNo ? RED : valor === "si" ? [40, 40, 40] : GRAY_400));
        const marca = esNo ? "x" : valor === "si" ? "\u2713" : "-";
        doc.text(`${marca} ${punto}`, xCol, yCol[colIdx], { maxWidth: checkColW - 0.1 });
        yCol[colIdx] += filaPunto;

        if (esNo || (dato?.comentario && dato.comentario.trim())) {
          observaciones.push({ punto, comentario: textoObservacion(sec.key, punto, dato?.comentario || "") });
        }
      });
      yCol[colIdx] += 0.14;
    });
  });

  y = Math.max(...yCol) + 0.15;

  // ---------- Observaciones registradas ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.8);
  doc.setTextColor(...RED);
  doc.text("OBSERVACIONES", marginX, y);
  y += 0.26;
  if (observaciones.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...GRAY_400);
    doc.text("Sin observaciones. Todos los puntos revisados en orden.", marginX, y);
    y += 0.22;
  } else {
    observaciones.forEach((o) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(90, 90, 90);
      doc.text(`•  ${o.comentario}`, marginX, y, { maxWidth: contentW });
      y += 0.26;
    });
  }

  // ---------- Cuadro de comentarios + firma ----------
  const espacioDisponible = yBase + altoMitad - 0.3 - y;
  const alturaComentarios = Math.max(0.6, Math.min(1.3, espacioDisponible - 0.55));
  const yComentarios = y + 0.12;
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.015);
  doc.rect(marginX, yComentarios, contentW, alturaComentarios);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  doc.setTextColor(...GRAY_400);
  doc.text("COMENTARIOS (una vez impresa la hoja)", marginX + 0.15, yComentarios + 0.22);
  doc.setDrawColor(...GRAY_200);
  const lineasComentario = alturaComentarios > 0.95 ? 2 : 1;
  for (let i = 1; i <= lineasComentario; i++) {
    const yl = yComentarios + 0.22 + i * ((alturaComentarios - 0.22) / (lineasComentario + 0.3));
    doc.line(marginX + 0.15, yl, marginX + contentW - 0.15, yl);
  }

  const yFirma = yComentarios + alturaComentarios + 0.32;
  const mitad = contentW / 2;
  doc.setDrawColor(90, 90, 90);
  doc.line(marginX, yFirma, marginX + mitad - 0.3, yFirma);
  doc.line(marginX + mitad + 0.3, yFirma, marginX + contentW, yFirma);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...GRAY_400);
  doc.text("Nombre de quien realizó la inspección", marginX, yFirma + 0.2);
  doc.text("Firma", marginX + mitad + 0.3, yFirma + 0.2);

  // ---------- Pie de esta mitad ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...GRAY_400);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · Transportes Logisticar`, marginX, yBase + altoMitad - 0.13);
}

// Dibuja la línea guía de corte al centro de la hoja, entre los dos informes
export function dibujarDivisor(doc: any) {
  const pageW = 21.59;
  const pageH = 27.94;
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.01);
  doc.setLineDashPattern([0.15, 0.1], 0);
  doc.line(0.5, pageH / 2, pageW - 0.5, pageH / 2);
  doc.setLineDashPattern([], 0);
}
