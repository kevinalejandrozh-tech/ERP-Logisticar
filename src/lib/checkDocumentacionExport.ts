import { DOCUMENTOS_CHECK, RegistroDocumentacion } from "./checkDocumentacionData";

const textoRespuesta = (r: string | null) => (r === "si" ? "Sí" : r === "no" ? "No" : "—");
const fechaLegible = (iso: string) => new Date(iso).toLocaleString("es-MX", { timeZone: "America/Mexico_City" });

export async function descargarExcelDocumentacion(reg: RegistroDocumentacion) {
  const XLSX = await import("xlsx");
  const fila: Record<string, string | number> = {
    Folio: reg.folio,
    "Fecha y hora": fechaLegible(reg.fecha_hora),
    "ECO Unidad": reg.eco_unidad,
    "Descripción de unidad": reg.descripcion_unidad,
    Placas: reg.placas,
  };
  DOCUMENTOS_CHECK.forEach((d) => {
    const doc = reg.documentos[d.key];
    fila[d.label] = textoRespuesta(doc?.respuesta ?? null);
    fila[`${d.label} (fotos)`] = doc?.fotos.length ?? 0;
  });
  const ws = XLSX.utils.json_to_sheet([fila]);
  ws["!cols"] = Object.keys(fila).map((k) => ({ wch: Math.max(k.length, 16) + 2 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Check documentación");
  XLSX.writeFile(wb, `Check_Documentacion_${reg.folio}.xlsx`);
}

function dimensionesImagen(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 });
    img.onerror = () => resolve({ w: 4, h: 3 });
    img.src = src;
  });
}

export async function descargarPdfDocumentacion(reg: RegistroDocumentacion) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const ANCHO = 210, ALTO = 297, M = 15;
  const util = ANCHO - M * 2;
  let y = 0;

  const encabezado = () => {
    pdf.setFillColor(22, 33, 92);
    pdf.rect(0, 0, ANCHO, 22, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("TRANSPORTES LOGISTICAR", M, 10);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Check de documentación de unidades", M, 16.5);
    pdf.setFontSize(9);
    pdf.text(`Folio: ${reg.folio}`, ANCHO - M, 10, { align: "right" });
    pdf.text(fechaLegible(reg.fecha_hora), ANCHO - M, 16.5, { align: "right" });
    pdf.setTextColor(26, 31, 46);
    y = 30;
  };
  const asegurar = (alto: number) => {
    if (y + alto > ALTO - M) {
      pdf.addPage();
      encabezado();
    }
  };

  encabezado();

  pdf.setFillColor(244, 245, 248);
  pdf.roundedRect(M, y, util, 24, 2, 2, "F");
  pdf.setFontSize(10);
  const linea = (etq: string, val: string, yy: number) => {
    pdf.setFont("helvetica", "bold");
    pdf.text(etq, M + 4, yy);
    pdf.setFont("helvetica", "normal");
    pdf.text(val || "—", M + 46, yy);
  };
  linea("ECO unidad:", reg.eco_unidad, y + 7);
  linea("Descripción de unidad:", reg.descripcion_unidad, y + 13.5);
  linea("Placas:", reg.placas, y + 20);
  y += 32;

  for (const d of DOCUMENTOS_CHECK) {
    const doc = reg.documentos[d.key];
    asegurar(20);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11.5);
    pdf.setTextColor(22, 33, 92);
    pdf.text(d.label, M, y);
    const si = doc?.respuesta === "si";
    pdf.setTextColor(si ? 33 : 226, si ? 168 : 65, si ? 102 : 44);
    pdf.text(textoRespuesta(doc?.respuesta ?? null), ANCHO - M, y, { align: "right" });
    pdf.setTextColor(26, 31, 46);
    pdf.setDrawColor(229, 232, 238);
    pdf.line(M, y + 2, ANCHO - M, y + 2);
    y += 8;

    const fotos = doc?.fotos ?? [];
    if (fotos.length === 0) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(9.5);
      pdf.setTextColor(154, 161, 176);
      pdf.text("Sin fotografías adjuntas.", M, y);
      pdf.setTextColor(26, 31, 46);
      y += 10;
      continue;
    }
    const colW = (util - 6) / 2;
    const maxH = 78;
    for (let i = 0; i < fotos.length; i += 2) {
      const par = fotos.slice(i, i + 2);
      const dims = await Promise.all(par.map(dimensionesImagen));
      const tam = dims.map((dm) => {
        let w = colW, h = (dm.h / dm.w) * w;
        if (h > maxH) { h = maxH; w = (dm.w / dm.h) * h; }
        return { w, h };
      });
      const filaH = Math.max(...tam.map((t) => t.h));
      asegurar(filaH + 8);
      par.forEach((f, j) => {
        pdf.addImage(f, "JPEG", M + j * (colW + 6), y, tam[j].w, tam[j].h);
      });
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(154, 161, 176);
      par.forEach((_, j) => pdf.text(`Foto ${i + j + 1}`, M + j * (colW + 6), y + filaH + 4));
      pdf.setTextColor(26, 31, 46);
      y += filaH + 9;
    }
    y += 4;
  }

  const total = pdf.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(154, 161, 176);
    pdf.text(`Página ${i} de ${total}`, ANCHO / 2, ALTO - 7, { align: "center" });
  }
  pdf.save(`Check_Documentacion_${reg.folio}.pdf`);
}
