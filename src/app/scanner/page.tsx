"use client";
import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Pagina = { id: string; dataUrl: string };
type Punto = { x: number; y: number };
type ImagenEnCola = { archivo: File; url: string; anchoNatural: number; altoNatural: number };

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

// Aplica escala de grises + contraste maximizado + enfoque de texto, tipo documento escaneado.
function filtrarEscaneo(fuente: CanvasImageSource, anchoOriginal: number, altoOriginal: number, maxDim = 1800): string {
  let width = anchoOriginal;
  let height = altoOriginal;
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
  if (!ctx) return "";
  ctx.drawImage(fuente, 0, 0, width, height);
  const imgData = ctx.getImageData(0, 0, width, height);
  const d = imgData.data;

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

  return canvas.toDataURL("image/jpeg", 0.92);
}

function distancia(a: Punto, b: Punto) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

// Calcula la matriz de homografia (3x3) que mapea puntos del rectangulo destino a los puntos origen (el cuadrilatero marcado).
function calcularHomografia(dstPts: Punto[], srcPts: Punto[]): number[] {
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x: dx, y: dy } = dstPts[i];
    const { x: sx, y: sy } = srcPts[i];
    A.push([dx, dy, 1, 0, 0, 0, -dx * sx, -dy * sx]);
    b.push(sx);
    A.push([0, 0, 0, dx, dy, 1, -dx * sy, -dy * sy]);
    b.push(sy);
  }
  const n = A.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let filaMax = col;
    for (let fila = col + 1; fila < n; fila++) {
      if (Math.abs(M[fila][col]) > Math.abs(M[filaMax][col])) filaMax = fila;
    }
    [M[col], M[filaMax]] = [M[filaMax], M[col]];
    const pivote = M[col][col];
    if (Math.abs(pivote) < 1e-10) continue;
    for (let fila = 0; fila < n; fila++) {
      if (fila === col) continue;
      const factor = M[fila][col] / pivote;
      for (let c = col; c <= n; c++) {
        M[fila][c] -= factor * M[col][c];
      }
    }
  }
  const h = M.map((fila, i) => fila[n] / fila[i]);
  return [...h, 1];
}

// Recorta y endereza la perspectiva del cuadrilatero marcado (TL, TR, BR, BL) en un canvas rectangular.
function aplicarPerspectiva(img: HTMLImageElement, puntos: Punto[]): HTMLCanvasElement {
  const anchoSup = distancia(puntos[0], puntos[1]);
  const anchoInf = distancia(puntos[3], puntos[2]);
  const altoIzq = distancia(puntos[0], puntos[3]);
  const altoDer = distancia(puntos[1], puntos[2]);
  const outW = Math.max(20, Math.round(Math.max(anchoSup, anchoInf)));
  const outH = Math.max(20, Math.round(Math.max(altoIzq, altoDer)));

  const dstPts: Punto[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];
  const H = calcularHomografia(dstPts, puntos);

  const inCanvas = document.createElement("canvas");
  inCanvas.width = img.naturalWidth;
  inCanvas.height = img.naturalHeight;
  const inCtx = inCanvas.getContext("2d")!;
  inCtx.drawImage(img, 0, 0);
  const inData = inCtx.getImageData(0, 0, inCanvas.width, inCanvas.height).data;
  const inW = inCanvas.width;
  const inH = inCanvas.height;

  const outCanvas = document.createElement("canvas");
  outCanvas.width = outW;
  outCanvas.height = outH;
  const outCtx = outCanvas.getContext("2d")!;
  const outImgData = outCtx.createImageData(outW, outH);
  const outData = outImgData.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const denom = H[6] * x + H[7] * y + H[8];
      const srcX = (H[0] * x + H[1] * y + H[2]) / denom;
      const srcY = (H[3] * x + H[4] * y + H[5]) / denom;
      const sx = Math.round(srcX);
      const sy = Math.round(srcY);
      const outIdx = (y * outW + x) * 4;
      if (sx >= 0 && sx < inW && sy >= 0 && sy < inH) {
        const inIdx = (sy * inW + sx) * 4;
        outData[outIdx] = inData[inIdx];
        outData[outIdx + 1] = inData[inIdx + 1];
        outData[outIdx + 2] = inData[inIdx + 2];
        outData[outIdx + 3] = 255;
      }
    }
  }
  outCtx.putImageData(outImgData, 0, 0);
  return outCanvas;
}

export default function ScannerPage() {
  const [paginas, setPaginas] = useState<Pagina[]>([]);
  const [exportando, setExportando] = useState(false);

  // Cola de imagenes pendientes de ajustar perspectiva (una a la vez)
  const [cola, setCola] = useState<ImagenEnCola[]>([]);
  const [imagenActual, setImagenActual] = useState<ImagenEnCola | null>(null);
  const [display, setDisplay] = useState({ w: 320, h: 420 });
  const [handles, setHandles] = useState<Punto[]>([]);
  const [procesandoActual, setProcesandoActual] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const arrastrandoRef = useRef<number | null>(null);

  useEffect(() => {
    if (!imagenActual) return;
    const maxW = typeof window !== "undefined" ? Math.min(480, window.innerWidth - 80) : 320;
    const maxH = typeof window !== "undefined" ? Math.min(520, window.innerHeight * 0.55) : 420;
    let w = imagenActual.anchoNatural;
    let h = imagenActual.altoNatural;
    const escala = Math.min(maxW / w, maxH / h, 1);
    w = Math.round(w * escala);
    h = Math.round(h * escala);
    setDisplay({ w, h });
    const margenX = w * 0.07;
    const margenY = h * 0.07;
    setHandles([
      { x: margenX, y: margenY },
      { x: w - margenX, y: margenY },
      { x: w - margenX, y: h - margenY },
      { x: margenX, y: h - margenY },
    ]);
  }, [imagenActual]);

  const manejarArchivos = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nuevas: ImagenEnCola[] = [];
    let restantes = files.length;
    files.forEach((archivo) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();
      img.onload = () => {
        nuevas.push({ archivo, url, anchoNatural: img.naturalWidth, altoNatural: img.naturalHeight });
        restantes--;
        if (restantes === 0) {
          setCola((prev) => {
            const combinada = [...prev, ...nuevas];
            if (!imagenActual && combinada.length > 0) {
              setImagenActual(combinada[0]);
              return combinada.slice(1);
            }
            return combinada;
          });
        }
      };
      img.src = url;
    });
    e.target.value = "";
  };

  const avanzarCola = () => {
    setImagenActual(null);
    setCola((prev) => {
      if (prev.length === 0) return prev;
      setImagenActual(prev[0]);
      return prev.slice(1);
    });
  };

  const iniciarArrastre = (indice: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    arrastrandoRef.current = indice;
  };
  const moverArrastre = (e: React.PointerEvent) => {
    if (arrastrandoRef.current === null || !contenedorRef.current) return;
    const rect = contenedorRef.current.getBoundingClientRect();
    const x = Math.min(rect.width, Math.max(0, e.clientX - rect.left));
    const y = Math.min(rect.height, Math.max(0, e.clientY - rect.top));
    const idx = arrastrandoRef.current;
    setHandles((prev) => prev.map((p, i) => (i === idx ? { x, y } : p)));
  };
  const soltarArrastre = (e: React.PointerEvent) => {
    if (arrastrandoRef.current === null) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    arrastrandoRef.current = null;
  };

  const aplicarAjuste = async (usarImagenCompleta: boolean) => {
    if (!imagenActual) return;
    setProcesandoActual(true);
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("No se pudo cargar la imagen."));
        img.src = imagenActual.url;
      });

      let dataUrl: string;
      if (usarImagenCompleta) {
        dataUrl = filtrarEscaneo(img, img.naturalWidth, img.naturalHeight);
      } else {
        const escalaX = imagenActual.anchoNatural / display.w;
        const escalaY = imagenActual.altoNatural / display.h;
        const puntosReales: Punto[] = handles.map((p) => ({ x: p.x * escalaX, y: p.y * escalaY }));
        const canvasRecortado = aplicarPerspectiva(img, puntosReales);
        dataUrl = filtrarEscaneo(canvasRecortado, canvasRecortado.width, canvasRecortado.height);
      }
      setPaginas((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, dataUrl }]);
      URL.revokeObjectURL(imagenActual.url);
      avanzarCola();
    } catch (err: any) {
      alert(err.message || "No se pudo procesar la imagen.");
    } finally {
      setProcesandoActual(false);
    }
  };

  const cancelarActual = () => {
    if (imagenActual) URL.revokeObjectURL(imagenActual.url);
    avanzarCola();
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
      setPaginas([]);
    } catch (err: any) {
      alert(err.message || "No se pudo generar el PDF.");
    } finally {
      setExportando(false);
    }
  };

  const puntosSvg = handles.map((p) => `${p.x},${p.y}`).join(" ");

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
            Agregar foto / imagen
            <input type="file" accept="image/*" capture="environment" multiple onChange={manejarArchivos} className="hidden" />
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
              Aún no hay páginas. Usa &quot;Agregar foto / imagen&quot; para tomar una foto o subir una imagen — podrás ajustar las esquinas del documento y se le aplicará un filtro de escaneo profesional.
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

      {imagenActual && (
        <div className="fixed inset-0 bg-[rgba(10,14,40,0.8)] flex flex-col items-center justify-center py-6 z-50">
          <h3 className="text-[15px] font-bold text-white mb-1">Ajusta las esquinas del documento</h3>
          <p className="text-[12px] text-[#a9c2ee] mb-4">Arrastra los círculos para que coincidan con los bordes de la hoja.</p>

          <div
            ref={contenedorRef}
            onPointerMove={moverArrastre}
            onPointerUp={soltarArrastre}
            className="relative touch-none select-none"
            style={{ width: display.w, height: display.h }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagenActual.url} alt="Documento a ajustar" className="absolute inset-0 w-full h-full object-fill rounded-md" draggable={false} />
            {handles.length === 4 && (
              <svg width={display.w} height={display.h} className="absolute inset-0 pointer-events-none">
                <polygon points={puntosSvg} fill="rgba(47,111,237,0.22)" stroke="#fff" strokeWidth={2} />
              </svg>
            )}
            {handles.map((p, i) => (
              <div
                key={i}
                onPointerDown={iniciarArrastre(i)}
                className="absolute w-7 h-7 -ml-3.5 -mt-3.5 rounded-full bg-white border-[3px] border-[var(--blue)] shadow-md cursor-grab active:cursor-grabbing touch-none"
                style={{ left: p.x, top: p.y }}
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 justify-center mt-5">
            <button type="button" onClick={cancelarActual} disabled={procesandoActual} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold disabled:opacity-60">
              Cancelar
            </button>
            <button type="button" onClick={() => aplicarAjuste(true)} disabled={procesandoActual} className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold disabled:opacity-60">
              Usar imagen completa
            </button>
            <button type="button" onClick={() => aplicarAjuste(false)} disabled={procesandoActual} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold disabled:opacity-60">
              {procesandoActual ? "Procesando..." : "Aplicar"}
            </button>
          </div>
          {cola.length > 0 && <p className="text-[11.5px] text-[#a9c2ee] mt-3">Quedan {cola.length} imagen(es) más en espera.</p>}
        </div>
      )}
    </div>
  );
}
