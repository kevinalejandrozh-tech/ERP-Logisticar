"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { fechaCita, horaCita } from "@/lib/candidatoDocumentos";

// Confirmación de cita del candidato (al completar los documentos obligatorios): folio, día, hora y QR.
// El QR lleva a la página privada que arma el PDF con todos sus documentos (requiere sesión del sysadmin).
export type CitaDatos = { folio: string; nombre: string; fecha: string; hora: string; qr: string };

const NARANJA = "#d2601a";
const NARANJA_FOLIO = "#f39c12";

const cargarImagen = (src: string) =>
  fetch(src)
    .then((r) => r.blob())
    .then(
      (b) =>
        new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(String(fr.result));
          fr.onerror = () => rej(new Error("No se pudo cargar el logo."));
          fr.readAsDataURL(b);
        })
    );

export default function CitaCandidato({ cita }: { cita: CitaDatos }) {
  const [qr, setQr] = useState("");
  const [generando, setGenerando] = useState(false);
  const fecha = fechaCita(cita.fecha);
  const hora = horaCita(cita.hora);

  useEffect(() => {
    QRCode.toDataURL(`${window.location.origin}${cita.qr}`, { width: 320, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [cita.qr]);

  const descargarPdf = async () => {
    setGenerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "mm", format: "letter" });
      const x = 15;
      const ancho = 186;
      try {
        doc.addImage(await cargarImagen("/logo-completo.png"), "PNG", x, 12, 44, 23.8);
      } catch {}
      // Encabezado naranja
      doc.setFillColor(NARANJA);
      doc.roundedRect(x, 40, ancho, 20, 3, 3, "F");
      doc.setTextColor("#ffffff");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("CONFIRMACIÓN DE CITA", x + ancho / 2, 53, { align: "center" });
      // Cuerpo gris
      doc.setFillColor("#ececec");
      doc.rect(x, 57, ancho, 70, "F");
      doc.roundedRect(x, 57, ancho, 73, 3, 3, "F");
      const cx = x + 64;
      doc.setTextColor("#555555");
      doc.setFontSize(13);
      doc.text("Estimado/a:", cx, 72, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(13);
      doc.text(doc.splitTextToSize(cita.nombre.toUpperCase(), 118), cx, 80, { align: "center" });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Su cita ha quedado confirmada con el folio:", cx, 96, { align: "center" });
      doc.setTextColor(NARANJA_FOLIO);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(20);
      doc.text(cita.folio, cx, 107, { align: "center" });
      doc.setTextColor("#555555");
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("el día:", cx - 46, 120);
      doc.setFont("helvetica", "normal");
      doc.text(fecha || "Por confirmar", cx - 32, 120);
      doc.setFont("helvetica", "bold");
      doc.text("a las:", cx + 4, 120);
      doc.setFont("helvetica", "normal");
      doc.text(hora ? `${hora} hrs` : "Por confirmar", cx + 17, 120);
      if (qr) {
        doc.setFillColor("#ffffff");
        doc.rect(x + 128, 64, 52, 52, "F");
        doc.addImage(qr, "PNG", x + 130, 66, 48, 48);
      }
      doc.save(`Cita_${cita.folio}.pdf`);
    } catch (e: any) {
      alert(e.message || "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };

  return (
    <div className="rounded-[18px] overflow-hidden shadow-[0_1px_3px_rgba(22,33,92,0.06)] bg-white/80 backdrop-blur-[2px]">
      <div className="text-white text-center font-bold text-[18px] sm:text-[22px] py-3 tracking-wide" style={{ background: NARANJA }}>
        CONFIRMACIÓN DE CITA
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4 p-5">
        <div className="flex-1 text-center text-[#555]">
          <p className="font-bold text-[14px] m-0">Estimado/a:</p>
          <p className="text-[15px] m-0 mb-3 uppercase">{cita.nombre}</p>
          <p className="font-bold text-[13.5px] m-0">Su cita ha quedado confirmada con el folio:</p>
          <p className="text-[24px] m-0 my-1" style={{ color: NARANJA_FOLIO }}>
            {cita.folio}
          </p>
          <p className="text-[13.5px] m-0">
            <b>el día:</b> {fecha || "Por confirmar"} &nbsp; <b>a las:</b> {hora ? `${hora} hrs` : "Por confirmar"}
          </p>
        </div>
        <div className="bg-white p-2 rounded-lg shrink-0">
          {qr ? <img src={qr} alt={`QR del folio ${cita.folio}`} className="w-[150px] h-[150px]" /> : <div className="w-[150px] h-[150px]" />}
        </div>
      </div>
      <div className="px-5 pb-5 flex justify-center sm:justify-end">
        <button type="button" onClick={descargarPdf} disabled={generando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
          {generando ? "Generando…" : "Descargar cita en PDF"}
        </button>
      </div>
    </div>
  );
}
