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

export async function dibujarInformeChecklist(doc: any, registro: RegistroChecklist) {
  const pageW = 21.59;
  const marginX = 1.3;
  const contentW = pageW - marginX * 2;

  // ---------- Encabezado ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageW, 2.2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("INFORME TÉCNICO", marginX, 1.0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(169, 194, 238);
  doc.text("Check List Diario de Unidades", marginX, 1.55);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(registro.folio, pageW - marginX, 1.0, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(169, 194, 238);
  const fecha = new Date(registro.fecha_hora).toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.text(fecha, pageW - marginX, 1.55, { align: "right" });

  // ---------- Datos generales + QR ----------
  let y = 2.7;
  const qrSize = 2.5;
  const datosW = contentW - qrSize - 0.4;
  doc.setFillColor(244, 245, 248);
  doc.roundedRect(marginX, y, datosW, 2.55, 0.15, 0.15, "F");
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
    const x = marginX + 0.3 + col * colW;
    const yy = y + 0.55 + fila * 1.15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...GRAY_400);
    doc.text(label.toUpperCase(), x, yy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...NAVY);
    doc.text(String(valor), x, yy + 0.42, { maxWidth: colW - 0.3 });
  });

  // QR hacia la página pública de evidencias
  const qrX = marginX + datosW + 0.4;
  try {
    const qrUrl = `${window.location.origin}/checklist-evidencias?id=${registro.id}`;
    const imagenQR = await generarImagenQR(qrUrl);
    doc.addImage(imagenQR, "PNG", qrX, y, qrSize, qrSize);
  } catch {
    // si falla la generación del QR, se omite sin interrumpir el reporte
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...GRAY_400);
  doc.text("Escanea para ver fotos", qrX + qrSize / 2, y + qrSize + 0.28, { align: "center" });

  // ---------- Niveles de fluidos (con barras) ----------
  y += 2.55 + 0.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  doc.text("NIVELES DE FLUIDOS", marginX, y);
  y += 0.35;
  const niveles = registro.niveles || {};
  NIVELES_LABELS.forEach((n) => {
    const dato = niveles[n.key];
    const nivelIdx = dato ? NIVEL_OPCIONES.indexOf(dato.nivel) + 1 : 0;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(40, 40, 40);
    doc.text(n.label, marginX, y + 0.32);

    // barra de 4 segmentos
    const barX = marginX + 6.2;
    const segW = 0.85;
    const segH = 0.34;
    for (let s = 0; s < 4; s++) {
      const relleno = s < nivelIdx;
      doc.setFillColor(...(relleno ? BLUE : GRAY_200));
      doc.rect(barX + s * (segW + 0.08), y, segW, segH, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...NAVY);
    doc.text(dato?.nivel || "Sin dato", barX + 4 * (segW + 0.08) + 0.15, y + 0.26);

    if (dato?.litros) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(90, 90, 90);
      doc.text(`${dato.litros} L`, barX + 5.4, y + 0.26);
    }
    if (dato?.observaciones) {
      doc.setFontSize(7.5);
      doc.setTextColor(...GRAY_400);
      doc.text(dato.observaciones, barX + 6.2, y + 0.26, { maxWidth: contentW - (barX + 6.2 - marginX) });
    }
    y += 0.55;
  });

  // ---------- Checklist de inspección (3 columnas) ----------
  y += 0.25;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...NAVY);
  const totalPuntos = SECCIONES.reduce((a, s) => a + s.puntos.length, 0);
  doc.text(`CHECKLIST DE INSPECCIÓN (${totalPuntos} PUNTOS)`, marginX, y);
  y += 0.4;

  const checklist = registro.checklist || {};
  const colGap = 0.4;
  const checkColW = (contentW - colGap * 2) / 3;
  const yInicioChecklist = y;
  let colActual = 0;
  let yCol = [yInicioChecklist, yInicioChecklist, yInicioChecklist];
  const observaciones: { punto: string; comentario: string }[] = [];

  SECCIONES.forEach((sec) => {
    const xCol = marginX + colActual * (checkColW + colGap);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...BLUE);
    doc.text(sec.titulo, xCol, yCol[colActual]);
    yCol[colActual] += 0.32;

    sec.puntos.forEach((punto) => {
      const key = `${sec.key}__${punto}`;
      const dato = checklist[key];
      const valor = dato?.valor ?? null;
      const esNo = valor === "no";
      doc.setFont("helvetica", esNo ? "bold" : "normal");
      doc.setFontSize(9);
      doc.setTextColor(...(esNo ? RED : valor === "si" ? [40, 40, 40] : GRAY_400));
      const marca = esNo ? "✕" : valor === "si" ? "✓" : "—";
      doc.text(`${marca} ${punto}`, xCol, yCol[colActual], { maxWidth: checkColW - 0.1 });
      yCol[colActual] += 0.3;

      if (esNo || (dato?.comentario && dato.comentario.trim())) {
        observaciones.push({ punto, comentario: dato?.comentario?.trim() || (esNo ? "Marcado como No" : "") });
      }
    });
    yCol[colActual] += 0.15;
    colActual = (colActual + 1) % 3;
  });

  y = Math.max(...yCol) + 0.2;

  // ---------- Observaciones registradas ----------
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...RED);
  doc.text("OBSERVACIONES REGISTRADAS", marginX, y);
  y += 0.35;
  if (observaciones.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...GRAY_400);
    doc.text("Sin observaciones. Todos los puntos revisados en orden.", marginX, y);
    y += 0.35;
  } else {
    observaciones.forEach((o) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(...NAVY);
      const anchoPunto = doc.getTextWidth(`${o.punto}: `);
      doc.text(`${o.punto}:`, marginX, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(90, 90, 90);
      doc.text(o.comentario, marginX + anchoPunto + 0.1, y, { maxWidth: contentW - anchoPunto - 0.1 });
      y += 0.32;
    });
  }

  // ---------- Cuadro de comentarios + firma (fijo al fondo de la hoja) ----------
  const yComentarios = 23.4;
  doc.setDrawColor(...GRAY_200);
  doc.setLineWidth(0.02);
  doc.rect(marginX, yComentarios, contentW, 2.3);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_400);
  doc.text("COMENTARIOS (una vez impresa la hoja)", marginX + 0.2, yComentarios + 0.35);
  doc.setDrawColor(...GRAY_200);
  for (let i = 1; i <= 3; i++) {
    const yl = yComentarios + 0.35 + i * 0.55;
    doc.line(marginX + 0.2, yl, marginX + contentW - 0.2, yl);
  }

  const yFirma = yComentarios + 2.3 + 0.55;
  const mitad = contentW / 2;
  doc.setDrawColor(90, 90, 90);
  doc.line(marginX, yFirma, marginX + mitad - 0.4, yFirma);
  doc.line(marginX + mitad + 0.4, yFirma, marginX + contentW, yFirma);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GRAY_400);
  doc.text("Nombre de quien realizó la inspección", marginX, yFirma + 0.32);
  doc.text("Firma", marginX + mitad + 0.4, yFirma + 0.32);

  // ---------- Pie de página ----------
  doc.setFillColor(...NAVY);
  doc.rect(0, 27.94 - 0.9, pageW, 0.9, "F");
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(169, 194, 238);
  doc.text(`Generado el ${new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })} · Sistema interno - Transportes Logisticar`, marginX, 27.94 - 0.4);
}
