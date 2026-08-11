"use client";
import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Pagina = { id: string; dataUrl: string };

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

// Aplica un filtro estilo "documento escaneado": escala de grises, contraste maximizado y enfoque de texto.
function procesarComoEscaneo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("No se pudo procesar la imagen."));
      img.onload = () => {
        const maxDim = 1800;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;

        // Escala de grises + deteccion de rango para maximizar contraste
        let min = 255;
        let max = 0;
        const gray = new Float32Array(width * height);
        for (let i = 0, p = 0; i < d.length; i += 4, p++) {
          const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
          gray[p] = g;
          if (g < min) min = g;
          if (g > max) max = g;
        }
        const range = Math.max(1, max - min);
        const contraste = 1.35;
        for (let p = 0, i = 0; p < gray.length; p++, i += 4) {
          let v = ((gray[p] - min) / range) * 255;
          v = (v - 128) * contraste + 128;
          v = Math.max(0, Math.min(255, v));
          d[i] = v;
          d[i + 1] = v;
          d[i + 2] = v;
        }
        ctx.putImageData(imgData, 0, 0);

        // Enfoque (sharpen) para maximizar la legibilidad del texto
        const antes = ctx.getImageData(0, 0, width, height);
        const src = new Uint8ClampedArray(antes.data);
        const despues = ctx.getImageData(0, 0, width, height);
        const sd = despues.data;
        const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            let suma = 0;
            let k = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const idx = ((y + ky) * width + (x + kx)) * 4;
                suma += src[idx] * kernel[k];
                k++;
              }
            }
            const idx = (y * width + x) * 4;
            const val = Math.max(0, Math.min(255, suma));
            sd[idx] = val;
            sd[idx + 1] = val;
            sd[idx + 2] = val;
          }
        }
        ctx.putImageData(despues, 0, 0);

        resolve(canvas.toDataURL("image/jpeg", 0.92));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function ScannerPage() {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [procesando, setProcesando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const manejarArchivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setProcesando(true);
    try {
      for (const file of files) {
        const dataUrl = await procesarComoEscaneo(file);
        setPaginas((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dataUrl }]);
      }
    } catch (err: any) {
      alert(err.message || "No se pudo procesar la imagen.");
    } finally {
      setProcesando(false);
      e.target.value = "";
    }
  };

  const eliminarPagina = (id: string) => {
    setPaginas((prev) => prev.filter((p) => p.id !== id));
  };

  const exportarPdf = async () => {
    if (paginas.length === 0) {
      alert("Agrega al menos una foto o imagen primero.");
      return;
    }
    const nombre = window.prompt("¿Con qué nombre se guardará el PDF?", "Documento escaneado");
    if (!nombre) return;
    setExportando(true);
    try {
      await cargarJsPDF();
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const pageW = 612;
      const pageH = 792;
      const margin = 24;

      for (let i = 0; i < paginas.length; i++) {
        if (i > 0) doc.addPage();
        const dims = await new Promise<{ w: number; h: number }>((resolve) => {
          const img = new Image();
          img.onload = () => resolve({ w: img.width, h: img.height });
          img.src = paginas[i].dataUrl;
        });
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        let w = maxW;
        let h = (dims.h / dims.w) * w;
        if (h > maxH) {
          h = maxH;
          w = (dims.w / dims.h) * h;
        }
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;
        doc.addImage(paginas[i].dataUrl, "JPEG", x, y, w, h);
      }

      const nombreFinal = nombre.toLowerCase().endsWith(".pdf") ? nombre : `${nombre}.pdf`;
      doc.save(nombreFinal);
    } catch (err: any) {
      alert(err.message || "No se pudo generar el PDF.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Logis SCANNER"
          subtitulo="Escanea documentos con tu cámara o desde tus imágenes y expórtalos a PDF."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" /><circle cx="12" cy="12.5" r="3" /><path d="M3 10h18" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
          <label className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold cursor-pointer">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            {procesando ? "Procesando..." : "Agregar foto / imagen"}
            <input type="file" accept="image/*" capture="environment" multiple onChange={manejarArchivos} disabled={procesando} className="hidden" />
          </label>
          <button
            type="button"
            onClick={exportarPdf}
            disabled={exportando || paginas.length === 0}
            className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] disabled:opacity-50 rounded-lg px-5 py-2.5 text-[13px] font-bold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" {...sw}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 15l3 3 3-3M12 11v7" /></svg>
            {exportando ? "Generando..." : "Exportar a PDF"}
          </button>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          {paginas.length === 0 ? (
            <div className="text-center text-[var(--gray-400)] text-[13.5px] py-14">
              Aún no hay páginas. Usa &quot;Agregar foto / imagen&quot; para tomar una foto o subir una imagen — se le aplicará automáticamente un filtro de escaneo profesional.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {paginas.map((p, i) => (
                <div key={p.id} className="border border-[var(--gray-200)] rounded-lg overflow-hidden relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.dataUrl} alt={`Página ${i + 1}`} className="w-full aspect-[3/4] object-cover bg-[var(--gray-100)]" />
                  <div className="flex items-center justify-between px-2 py-1.5 bg-[var(--gray-100)]">
                    <span className="text-[11px] font-bold text-[var(--navy)]">Página {i + 1}</span>
                    <span onClick={() => eliminarPagina(p.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar página">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <PageFooter />
      </div>
    </div>
  );
}
