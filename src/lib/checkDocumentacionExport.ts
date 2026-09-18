import { DOCUMENTOS_CHECK, RegistroDocumentacion } from "./checkDocumentacionData";

const textoRespuesta = (r: string | null) => (r === "si" ? "Sí" : r === "no" ? "No" : "—");
const fechaLegible = (iso: string) => new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });
const fechaLarga = (iso: string) =>
  new Date(iso).toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: "America/Mexico_City" });

function dimensionesImagen(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = src;
  });
}

function descargarBlob(datos: BlobPart, nombre: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([datos], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ---------------- Excel (datos + fotografías apiladas de arriba hacia abajo) ----------------
export async function crearExcelDocumentacion(reg: RegistroDocumentacion): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Check documentación");

  const encabezados: string[] = ["Folio", "Fecha y hora", "ECO Unidad", "Descripción de unidad", "Placas"];
  const valores: (string | number)[] = [reg.folio, fechaLegible(reg.fecha_hora), reg.eco_unidad, reg.descripcion_unidad, reg.placas];
  const columnaFotos: number[] = []; // índice (base 0) de la columna "(fotos)" de cada documento
  DOCUMENTOS_CHECK.forEach((d) => {
    const doc = reg.documentos[d.key];
    encabezados.push(d.label);
    valores.push(textoRespuesta(doc?.respuesta ?? null));
    encabezados.push(`${d.label} (fotos)`);
    valores.push(doc?.fotos.length ?? 0);
    columnaFotos.push(encabezados.length - 1);
  });
  ws.addRow(encabezados);
  ws.addRow(valores);
  encabezados.forEach((t, i) => {
    ws.getColumn(i + 1).width = columnaFotos.includes(i) ? 36 : Math.max(t.length, 16) + 2;
  });

  const MAX_W = 240, MAX_H = 160; // px
  const maxFotos = Math.max(0, ...DOCUMENTOS_CHECK.map((d) => reg.documentos[d.key]?.fotos.length ?? 0));
  for (let i = 0; i < maxFotos; i++) ws.getRow(3 + i).height = MAX_H * 0.75 + 8;

  for (let n = 0; n < DOCUMENTOS_CHECK.length; n++) {
    const fotos = reg.documentos[DOCUMENTOS_CHECK[n].key]?.fotos ?? [];
    for (let i = 0; i < fotos.length; i++) {
      const dim = await dimensionesImagen(fotos[i]);
      const esc = Math.min(MAX_W / dim.w, MAX_H / dim.h);
      const id = wb.addImage({ base64: fotos[i].replace(/^data:image\/\w+;base64,/, ""), extension: "jpeg" });
      ws.addImage(id, {
        tl: { col: columnaFotos[n] + 0.05, row: 2 + i + 0.05 },
        ext: { width: Math.round(dim.w * esc), height: Math.round(dim.h * esc) },
      });
    }
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function descargarExcelDocumentacion(reg: RegistroDocumentacion) {
  const buf = await crearExcelDocumentacion(reg);
  descargarBlob(buf, `Check_Documentacion_${reg.folio}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
}

// ---------------- PDF (mismo formato que "Previsualización — Responsiva") ----------------
export async function crearPdfDocumentacion(reg: RegistroDocumentacion, logoDataUrl: string | null) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const marginX = 48;
  const ANCHO = 612;
  const LIMITE = 740;
  const anchoUtil = ANCHO - marginX * 2;
  let y = 50;

  const encabezado = () => {
    y = 50;
    if (logoDataUrl) doc.addImage(logoDataUrl, "PNG", marginX, y - 14, 32, 32);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(20, 20, 20);
    doc.text("TRANSPORTES LOGISTICAR", marginX + 42, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(47, 111, 237);
    doc.text(fechaLarga(reg.fecha_hora), ANCHO - marginX, y + 6, { align: "right" });
    y += 44;
    doc.setDrawColor(229, 232, 238);
    doc.line(marginX, y, ANCHO - marginX, y);
    y += 26;
  };
  const asegurar = (alto: number) => {
    if (y + alto > LIMITE) {
      doc.addPage();
      encabezado();
    }
  };
  const tabla = (titulo1: string, titulo2: string, filas: [string, string, [number, number, number]?][]) => {
    const inicio = y;
    doc.setFillColor(22, 33, 92);
    doc.rect(marginX, y, anchoUtil, 20, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.text(titulo1, marginX + 10, y + 14);
    doc.text(titulo2, marginX + 260, y + 14);
    y += 20;
    filas.forEach(([a, b, color], idx) => {
      if (idx % 2 === 1) {
        doc.setFillColor(244, 245, 248);
        doc.rect(marginX, y, anchoUtil, 22, "F");
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      doc.text(a, marginX + 10, y + 15);
      doc.setFont("helvetica", "bold");
      if (color) doc.setTextColor(color[0], color[1], color[2]);
      doc.text(b || "—", marginX + 260, y + 15);
      y += 22;
    });
    doc.setDrawColor(229, 232, 238);
    doc.rect(marginX, inicio, anchoUtil, y - inicio);
  };

  encabezado();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(22, 33, 92);
  doc.text("Check de documentación de unidades", marginX, y);
  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  doc.text(`Folio: ${reg.folio}`, marginX, y);
  y += 26;

  tabla("DATO", "DETALLE", [
    ["ECO unidad", reg.eco_unidad],
    ["Descripción de unidad", reg.descripcion_unidad],
    ["Placas", reg.placas],
  ]);
  y += 22;

  tabla(
    "DOCUMENTO",
    "¿CUENTA CON ÉL?",
    DOCUMENTOS_CHECK.map((d) => {
      const r = reg.documentos[d.key]?.respuesta ?? null;
      return [d.label, textoRespuesta(r), r === "si" ? ([33, 168, 102] as [number, number, number]) : ([226, 65, 44] as [number, number, number])];
    })
  );
  y += 26;

  const colW = (anchoUtil - 14) / 2;
  const maxH = 190;
  for (const d of DOCUMENTOS_CHECK) {
    const fotos = reg.documentos[d.key]?.fotos ?? [];
    asegurar(fotos.length ? 40 + 120 : 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(22, 33, 92);
    doc.text(`Evidencia fotográfica — ${d.label}`, marginX, y);
    y += 16;
    if (fotos.length === 0) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.setTextColor(120, 120, 120);
      doc.text("Sin fotografías adjuntas.", marginX, y);
      y += 30;
      continue;
    }
    for (let i = 0; i < fotos.length; i += 2) {
      const par = fotos.slice(i, i + 2);
      const dims = await Promise.all(par.map(dimensionesImagen));
      const tam = dims.map((dm) => {
        let w = colW, h = (dm.h / dm.w) * w;
        if (h > maxH) { h = maxH; w = (dm.w / dm.h) * h; }
        return { w, h };
      });
      const filaH = Math.max(...tam.map((t) => t.h));
      asegurar(filaH + 22);
      par.forEach((f, j) => {
        doc.addImage(f, "JPEG", marginX + j * (colW + 14), y, tam[j].w, tam[j].h);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.setTextColor(120, 120, 120);
        doc.text(`Foto ${i + j + 1}`, marginX + j * (colW + 14), y + tam[j].h + 11);
      });
      y += filaH + 24;
    }
    y += 8;
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(150, 150, 150);
    doc.text(`Página ${i} de ${total}`, ANCHO / 2, 776, { align: "center" });
  }
  return doc;
}

export async function descargarPdfDocumentacion(reg: RegistroDocumentacion) {
  let logo: string | null = null;
  try {
    logo = await fetch("/logo-transportes.png")
      .then((r) => r.blob())
      .then(
        (b) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("logo"));
            reader.readAsDataURL(b);
          })
      );
  } catch {
    logo = null;
  }
  const pdf = await crearPdfDocumentacion(reg, logo);
  pdf.save(`Check_Documentacion_${reg.folio}.pdf`);
}
