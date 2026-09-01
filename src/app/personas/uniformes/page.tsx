"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

declare global {
  interface Window {
    jspdf: any;
  }
}
function cargarJsPDF(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.jspdf) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el generador de PDF."));
    document.body.appendChild(script);
  });
}

type Uniforme = {
  id: number;
  operador: string;
  tallaChamarra: string;
  tallaPlayera: string;
  tallaPantalon: string;
  tallaZapatos: string;
  fechaEntrega: string;
};

function formatearFecha(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function UniformesPage() {
  const [registros, setRegistros] = useState<Uniforme[]>([]);
  const [cargando, setCargando] = useState(true);
  const [operadores, setOperadores] = useState<string[]>([]);

  const cargar = async () => {
    try {
      const res = await fetch("/api/uniformes/list", { cache: "no-store" });
      const data = await res.json();
      setRegistros(data.registros || []);
    } catch {
      // se reintenta al recargar la pagina
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
    fetch("/api/operadores/list", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setOperadores((data.registros || []).map((o: { nombre: string }) => o.nombre)))
      .catch(() => {});
  }, []);

  // ---- Agregar registro ----
  const [modalAbierto, setModalAbierto] = useState(false);
  const [fOperador, setFOperador] = useState("");
  const [fChamarra, setFChamarra] = useState("");
  const [fPlayera, setFPlayera] = useState("");
  const [fPantalon, setFPantalon] = useState("");
  const [fZapatos, setFZapatos] = useState("");
  const [guardando, setGuardando] = useState(false);

  const abrirModal = () => {
    setFOperador(operadores[0] || "");
    setFChamarra("");
    setFPlayera("");
    setFPantalon("");
    setFZapatos("");
    setModalAbierto(true);
  };
  const guardarRegistro = async () => {
    if (!fOperador.trim()) {
      alert("Selecciona el nombre del operador.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch("/api/uniformes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operador: fOperador, tallaChamarra: fChamarra, tallaPlayera: fPlayera, tallaPantalon: fPantalon, tallaZapatos: fZapatos }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar.");
      setModalAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el registro.");
    } finally {
      setGuardando(false);
    }
  };
  const eliminarRegistro = async (id: number) => {
    if (!confirm("¿Eliminar este registro de uniforme?")) return;
    setRegistros((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch("/api/uniformes/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargar();
    }
  };

  // ---- Responsiva de entrega ----
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [idElegido, setIdElegido] = useState<number | null>(null);
  const [generando, setGenerando] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const abrirSelector = () => {
    if (registros.length === 0) {
      alert("Primero agrega al menos un registro de uniforme.");
      return;
    }
    setIdElegido(registros[0].id);
    setSelectorAbierto(true);
  };

  const generarResponsiva = async () => {
    const u = registros.find((r) => r.id === idElegido);
    if (!u) return;
    setGenerando(true);
    try {
      await cargarJsPDF();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const marginX = 48;
      let y = 50;

      const logoImg = await fetch("/logo-transportes.png")
        .then((r) => r.blob())
        .then(
          (b) =>
            new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.readAsDataURL(b);
            })
        );
      doc.addImage(logoImg, "PNG", marginX, y - 14, 32, 32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text("TRANSPORTES LOGISTICAR", marginX + 42, y + 6);
      const fechaHoy = new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(47, 111, 237);
      doc.text(fechaHoy, 612 - marginX, y + 6, { align: "right" });
      y += 44;
      doc.setDrawColor(229, 232, 238);
      doc.line(marginX, y, 612 - marginX, y);
      y += 26;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(22, 33, 92);
      doc.text("Responsiva de asignación de entrega de uniformes", marginX, y);
      y += 22;

      const fechaEntrega = formatearFecha(u.fechaEntrega);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(`Fecha de entrega: ${fechaEntrega}`, marginX, y);
      y += 22;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      const p1 = `Por medio del presente documento yo ${u.operador} hago constar que he recibido en calidad de asignación el uniforme de trabajo correspondiente, propiedad de la empresa, para el desempeño de las actividades propias de mi puesto, con las tallas que se detallan a continuación.`;
      const l1 = doc.splitTextToSize(p1, 612 - marginX * 2);
      doc.text(l1, marginX, y);
      y += l1.length * 13 + 20;

      // Tabla de tallas
      const tallas: [string, string][] = [
        ["Chamarra", u.tallaChamarra || "—"],
        ["Playera", u.tallaPlayera || "—"],
        ["Pantalón", u.tallaPantalon || "—"],
        ["Zapatos", u.tallaZapatos || "—"],
      ];
      doc.setFillColor(22, 33, 92);
      doc.rect(marginX, y, 612 - marginX * 2, 20, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(255, 255, 255);
      doc.text("PRENDA", marginX + 10, y + 14);
      doc.text("TALLA", marginX + 260, y + 14);
      y += 20;
      tallas.forEach(([prenda, talla], idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(244, 245, 248);
          doc.rect(marginX, y, 612 - marginX * 2, 22, "F");
        }
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text(prenda, marginX + 10, y + 15);
        doc.setFont("helvetica", "bold");
        doc.text(talla, marginX + 260, y + 15);
        y += 22;
      });
      doc.setDrawColor(229, 232, 238);
      doc.rect(marginX, y - tallas.length * 22 - 20, 612 - marginX * 2, tallas.length * 22 + 20);
      y += 26;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10.5);
      doc.setTextColor(22, 33, 92);
      doc.text("Me comprometo a:", marginX, y);
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(30, 30, 30);
      const compromisos = [
        "Utilizar el uniforme exclusivamente para fines laborales, dentro del desempeño de mis funciones.",
        "Conservarlo limpio y en buenas condiciones de uso, dándole un manejo adecuado conforme a las políticas de la empresa.",
        "Reportar de manera inmediata cualquier pérdida, robo, daño o desgaste que impida su uso.",
        "Devolver las prendas en caso de cambio de puesto, sustitución de uniforme o al término de la relación laboral, en las condiciones que el uso normal permita.",
      ];
      compromisos.forEach((c, idx) => {
        const lx = doc.splitTextToSize(`${idx + 1}. ${c}`, 612 - marginX * 2 - 14);
        doc.text(lx, marginX + 14, y);
        y += lx.length * 12.5 + 5;
      });
      y += 16;

      const cierre =
        "Declaro haber recibido las prendas descritas en la tabla anterior, verificando que se encuentran completas y en condiciones adecuadas para su uso, aceptando la responsabilidad de su cuidado mientras permanezcan bajo mi resguardo.";
      const lc = doc.splitTextToSize(cierre, 612 - marginX * 2);
      let firmasY = y + lc.length * 13 + 40;
      if (firmasY > 760) {
        doc.addPage();
        y = 60;
        firmasY = y + lc.length * 13 + 40;
      }
      doc.text(lc, marginX, y);

      doc.setDrawColor(60, 60, 60);
      doc.line(marginX, firmasY, marginX + 190, firmasY);
      doc.line(340, firmasY, 340 + 190, firmasY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text(u.operador, marginX + 95, firmasY + 16, { align: "center" });
      doc.text("Quien entrega", 340 + 95, firmasY + 16, { align: "center" });

      const blob = doc.output("blob");
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setSelectorAbierto(false);
    } catch (err: any) {
      alert(err.message || "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };
  const descargarPdf = () => {
    if (!pdfUrl) return;
    const u = registros.find((r) => r.id === idElegido);
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `Responsiva_Uniforme_${(u?.operador || "operador").replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Uniformes"
          subtitulo="Administra la asignación de uniformes y genera la responsiva de entrega."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><path d="M16 4l4 3v4h-3v9H7v-9H4V7l4-3" /><path d="M9 4a3 3 0 006 0" /></svg>}
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
            <button type="button" onClick={abrirModal} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Agregar registro
            </button>
            <button type="button" onClick={abrirSelector} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
              Responsiva de entrega
            </button>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}
          {!cargando && registros.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay registros. Crea el primero con &quot;Agregar registro&quot;.</p>
          )}
          {!cargando && registros.length > 0 && (
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Operador", "Talla chamarra", "Talla playera", "Talla pantalón", "Talla zapatos", "Fecha de entrega", ""].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registros.map((r) => (
                    <tr key={r.id} className="border-b border-[var(--gray-200)]">
                      <td className="px-2.5 py-2 text-[12.5px] font-semibold text-[var(--navy)] whitespace-nowrap">{r.operador}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{r.tallaChamarra || "—"}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{r.tallaPlayera || "—"}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{r.tallaPantalon || "—"}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{r.tallaZapatos || "—"}</td>
                      <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap text-[var(--gray-400)]">{formatearFecha(r.fechaEntrega)}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span onClick={() => eliminarRegistro(r.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar registro">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <PageFooter />
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Agregar registro de uniforme</h3>

            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Nombre del operador</label>
              {operadores.length === 0 ? (
                <p className="text-[12.5px] text-[var(--red)]">No hay operadores registrados. Agrégalos en &quot;Agregar / Administrar personas&quot;.</p>
              ) : (
                <select value={fOperador} onChange={(e) => setFOperador(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]">
                  {operadores.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Talla chamarra</label>
                <input value={fChamarra} onChange={(e) => setFChamarra(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Talla playera</label>
                <input value={fPlayera} onChange={(e) => setFPlayera(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Talla pantalón</label>
                <input value={fPantalon} onChange={(e) => setFPantalon(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Talla zapatos</label>
                <input value={fZapatos} onChange={(e) => setFZapatos(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
            </div>

            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarRegistro} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectorAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Generar responsiva</h3>
            <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Operador</label>
            <select
              value={idElegido ?? ""}
              onChange={(e) => setIdElegido(Number(e.target.value))}
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px] mb-6"
            >
              {registros.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.operador} — {formatearFecha(r.fechaEntrega)}
                </option>
              ))}
            </select>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setSelectorAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={generarResponsiva} disabled={generando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {generando ? "Generando..." : "Generar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {pdfUrl && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
          <div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Previsualización — Responsiva</h3>
            <iframe src={pdfUrl} className="w-full h-[560px] border border-[var(--gray-200)] rounded-lg" />
            <div className="flex gap-2.5 justify-end mt-4">
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(pdfUrl);
                  setPdfUrl(null);
                }}
                className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold"
              >
                Cerrar
              </button>
              <button type="button" onClick={descargarPdf} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Descargar PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
