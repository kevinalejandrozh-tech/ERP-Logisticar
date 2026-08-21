// Genera una página de "Informe Técnico" para un registro del Check List Diario de Unidades,
// dibujada dentro de un documento jsPDF ya creado (permite generar 1 o varias páginas seguidas).

export type Evidencia = { foto: string; descripcion: string };
export type RegistroChecklist = {
  id: number;
  folio: string;
  eco_unidad: string;
  descripcion_unidad: string;
  placas: string;
  fecha_hora: string;
  kilometraje_actual: string | number | null;
  estado_llantas: { fotos?: string[]; dictamen?: string; comentario?: string } | null;
  niveles: Record<string, { nivel: string; litros: string; observaciones: string }> | null;
  checklist: Record<string, { valor: "si" | "no" | null; comentario: string; comentarioActivo: boolean }> | null;
  porcentaje_llenado: string | number | null;
};

const SECCIONES: { key: string; titulo: string; puntos: string[] }[] = [
  {
    key: "cabina",
    titulo: "Inspección completa",
    puntos: [
      "Limpieza de la unidad",
      "Asientos en buen estado",
      "Espejos completos",
      "Vidrios en buen estado",
      "Funcionamiento del aire acondicionado",
      "Placa delantera asegurada",
      "Placa trasera asegurada",
      "Pintura, limpieza y estado de la caja de carga",
    ],
  },
  {
    key: "adicionales",
    titulo: "Adicionales de la unidad",
    puntos: ["Gato hidráulico", "Extintor vigente", "Botiquín", "Triángulos de seguridad", "Llanta de refacción", "Diablo o carro de carga", "Llave para birlos", "Gatas / Barras de seguridad"],
  },
  {
    key: "general",
    titulo: "Inspección general",
    puntos: [
      "Fugas de aceite",
      "Fugas de líquido de frenos",
      "Fugas de refrigerante",
      "Estado de la carrocería",
      "Luces delanteras",
      "Luces traseras",
      "Luces direccionales",
      "Luces intermitentes",
      "Frenos de servicio",
      "Freno de motor",
      "Suspensión",
      "Sistema de dirección",
      "Batería y terminales",
    ],
  },
  { key: "documentacion", titulo: "Documentación", puntos: ["Tarjeta de circulación", "Póliza de seguro vigente", "Verificación vigente"] },
  {
    key: "comandos",
    titulo: "Funcionamiento de comandos",
    puntos: ["Accesorios", "Paro de motor", "Habilitado de motor", "Apertura de chapa", "Cierre de chapa", "Activación de sirena", "Puertas segura", "Voz en cabina", "Rotochamber"],
  },
  {
    key: "acceso",
    titulo: "Accesorios",
    puntos: [
      "Botón de pánico izq",
      "Botón de pánico der",
      "1° chapa",
      "2° chapa",
      "3° chapa",
      "Puerta segura operador",
      "Puerta segura copiloto",
      "Sirenas",
      "Luces intermitentes",
      "Sensor de puerta operador",
      "Sensor de puerta copiloto",
    ],
  },
];
const NIVELES_LABELS = [
  { key: "aceite", label: "Nivel de aceite" },
  { key: "frenos", label: "Nivel de líq. de frenos" },
  { key: "direccion", label: "Nivel de fluido de dirección" },
  { key: "anticongelante", label: "Nivel de anticongelante" },
  { key: "limpiaparabrisas", label: "Agua limpiaparabrisas" },
];
const NIVEL_OPCIONES = ["1/4", "1/2", "3/4", "LLENO"];

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

export async function dibujarInformeChecklist(doc: any, registro: RegistroChecklist, yBase: number) {
  const pageW = 21.59;
  const pageH = 27.94;
  const altoMitad = pageH / 2;
  const marginX = 1.0;
  const contentW = pageW - marginX * 2;

  // ---------- Encabezado ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, yBase, pageW, 1.15, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("INFORME TÉCNICO", marginX, yBase + 0.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(169, 194, 238);
  doc.text("Check List Diario de Unidades", marginX, yBase + 0.86);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(registro.folio, pageW - marginX, yBase + 0.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(169, 194, 238);
  const fecha = new Date(registro.fecha_hora).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.text(fecha, pageW - marginX, yBase + 0.86, { align: "right" });

  // ---------- Datos generales + QR ----------
  let y = yBase + 1.35;
  const qrSize = 1.5;
  const datosW = contentW - qrSize - 0.3;
  doc.setFillColor(244, 245, 248);
  doc.roundedRect(marginX, y, datosW, 1.55, 0.1, 0.1, "F");
  const campos: [string, string][] = [
    ["Unidad", registro.eco_unidad || "—"],
    ["Descripción", registro.descripcion_unidad || "—"],
    ["Placas", registro.placas || "—"],
    ["Kilometraje", registro.kilometraje_actual ? `${Number(registro.kilometraje_actual).toLocaleString("es-MX")} km` : "—"],
    ["% Llenado", `${registro.porcentaje_llenado ?? 0}%`],
    ["Dictamen llantas", registro.estado_llantas?.dictamen || "—"],
  ];
  const colW = datosW / 3;
  campos.forEach(([label, valor], i) => {
    const col = i % 3;
    const fila = Math.floor(i / 3);
    const x = marginX + 0.2 + col * colW;
    const yy = y + 0.32 + fila * 0.7;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5.5);
    doc.setTextColor(...GRAY_400);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(String(valor), x, yy + 0.28, { maxWidth: colW - 0.25 });
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
  doc.setFontSize(5);
  doc.setTextColor(...GRAY_400);
  doc.text("Ver fotos", qrX + qrSize / 2, y + qrSize + 0.16, { align: "center" });

  // ---------- Niveles de fluidos (con barras) ----------
  y += 1.55 + 0.28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  doc.text("NIVELES DE FLUIDOS", marginX, y);
  y += 0.22;
  const niveles = registro.niveles || {};
  NIVELES_LABELS.forEach((n) => {
    const dato = niveles[n.key];
    const nivelIdx = dato ? NIVEL_OPCIONES.indexOf(dato.nivel) + 1 : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(40, 40, 40);
    doc.text(n.label, marginX, y + 0.22, { maxWidth: 5.6 });

    const barX = marginX + 5.9;
    const segW = 0.55;
    const segH = 0.24;
    for (let s = 0; s < 4; s++) {
      const relleno = s < nivelIdx;
      doc.setFillColor(...(relleno ? BLUE : GRAY_200));
      doc.rect(barX + s * (segW + 0.05), y, segW, segH, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(...NAVY);
    doc.text(dato?.nivel || "Sin dato", barX + 4 * (segW + 0.05) + 0.12, y + 0.18);
    let obsX = barX + 2.3;
    if (dato?.litros) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(90, 90, 90);
      doc.text(`${dato.litros} L`, obsX, y + 0.18);
      obsX += 0.7;
    }
    if (dato?.observaciones) {
      doc.setFontSize(6);
      doc.setTextColor(...GRAY_400);
      doc.text(dato.observaciones, obsX, y + 0.18, { maxWidth: marginX + contentW - obsX });
    }
    y += 0.32;
  });

  // ---------- Checklist de inspección (3 columnas) ----------
  y += 0.18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...NAVY);
  const totalPuntos = SECCIONES.reduce((a, s) => a + s.puntos.length, 0);
  doc.text(`CHECKLIST DE INSPECCIÓN (${totalPuntos} PUNTOS)`, marginX, y);
  y += 0.24;

  const checklist = registro.checklist || {};
  const colGap = 0.3;
  const checkColW = (contentW - colGap * 2) / 3;
  const yInicioChecklist = y;
  let colActual = 0;
  const yCol = [yInicioChecklist, yInicioChecklist, yInicioChecklist];
  const observaciones: { punto: string; comentario: string }[] = [];

  SECCIONES.forEach((sec) => {
    const xCol = marginX + colActual * (checkColW + colGap);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.3);
    doc.setTextColor(...BLUE);
    doc.text(sec.titulo, xCol, yCol[colActual]);
    yCol[colActual] += 0.19;

    sec.puntos.forEach((punto) => {
      const key = `${sec.key}__${punto}`;
      const dato = checklist[key];
      const valor = dato?.valor ?? null;
      const esNo = valor === "no";
      doc.setFont("helvetica", esNo ? "bold" : "normal");
      doc.setFontSize(6.3);
      doc.setTextColor(...(esNo ? RED : valor === "si" ? [40, 40, 40] : GRAY_400));
      const marca = esNo ? "x" : valor === "si" ? "\u2713" : "-";
      doc.text(`${marca} ${punto}`, xCol, yCol[colActual], { maxWidth: checkColW - 0.08 });
      yCol[colActual] += 0.185;

      if (esNo || (dato?.comentario && dato.comentario.trim())) {
        observaciones.push({ punto, comentario: dato?.comentario?.trim() || (esNo ? "Marcado como No" : "") });
      }
    });
    yCol[colActual] += 0.1;
    colActual = (colActual + 1) % 3;
  });

  y = Math.max(...yCol) + 0.12;

  // ---------- Observaciones registradas ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(...RED);
  doc.text("OBSERVACIONES", marginX, y);
  y += 0.2;
  if (observaciones.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.3);
    doc.setTextColor(...GRAY_400);
    doc.text("Sin observaciones. Todos los puntos revisados en orden.", marginX, y);
    y += 0.2;
  } else {
    observaciones.forEach((o) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.3);
      doc.setTextColor(...NAVY);
      const anchoPunto = doc.getTextWidth(`${o.punto}: `);
      doc.text(`${o.punto}:`, marginX, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.text(o.comentario, marginX + anchoPunto + 0.08, y, { maxWidth: contentW - anchoPunto - 0.08 });
      y += 0.185;
    });
  }

  // ---------- Cuadro de comentarios + firma ----------
  const espacioDisponible = yBase + altoMitad - 0.35 - y;
  const alturaComentarios = Math.max(0.85, Math.min(1.15, espacioDisponible - 0.55));
  const yComentarios = y + 0.12;
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.015);
  doc.rect(marginX, yComentarios, contentW, alturaComentarios);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.5);
  doc.setTextColor(...GRAY_400);
  doc.text("COMENTARIOS (una vez impresa la hoja)", marginX + 0.15, yComentarios + 0.22);
  doc.setDrawColor(...GRAY_200);
  const lineasComentario = alturaComentarios > 1.0 ? 2 : 1;
  for (let i = 1; i <= lineasComentario; i++) {
    const yl = yComentarios + 0.22 + i * ((alturaComentarios - 0.22) / (lineasComentario + 0.4));
    doc.line(marginX + 0.15, yl, marginX + contentW - 0.15, yl);
  }

  const yFirma = yComentarios + alturaComentarios + 0.32;
  const mitad = contentW / 2;
  doc.setDrawColor(90, 90, 90);
  doc.line(marginX, yFirma, marginX + mitad - 0.3, yFirma);
  doc.line(marginX + mitad + 0.3, yFirma, marginX + contentW, yFirma);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.8);
  doc.setTextColor(...GRAY_400);
  doc.text("Nombre de quien realizó la inspección", marginX, yFirma + 0.2);
  doc.text("Firma", marginX + mitad + 0.3, yFirma + 0.2);

  // ---------- Pie de esta mitad ----------
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(...GRAY_400);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })} · Transportes Logisticar`, marginX, yBase + altoMitad - 0.15);
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
