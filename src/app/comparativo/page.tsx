"use client";
import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import { compressImage } from "@/lib/imageUtils";

type Columna = { etiqueta: string; foto: string; texto: string };
type Comparativo = { id: number; titulo: string; descripcion: string; columnas: Columna[]; modo: "reporte" | "antesDespues" };
type Forma = { tipo: "circulo" | "flecha" | "tache" | "texto"; x1: number; y1: number; x2: number; y2: number; texto?: string };

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const COLORES_COLUMNA = ["#2c3a54", "#3e5170", "#51698e", "#6f89ac", "#93aac6"];
const ROJO_ANOTACION = "#ff2626";

function columnaVacia(etiqueta: string): Columna {
  return { etiqueta, foto: "", texto: "" };
}

type Recorte = { x: number; y: number; w: number; h: number };

// ---- Editor de imagen: girar, recortar y resaltar con círculos/flechas en rojo ----
function ModalAnotarImagen({ imagenBase, onConfirmar, onCancelar }: { imagenBase: string; onConfirmar: (dataUrl: string) => void; onCancelar: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgCargada, setImgCargada] = useState<HTMLImageElement | null>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [pestana, setPestana] = useState<"ajustar" | "resaltar">("ajustar");

  // ajustar: girar / recortar
  const [rotacion, setRotacion] = useState(0);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const [recorteArrastre, setRecorteArrastre] = useState<Recorte | null>(null);
  const [puntoInicioRecorte, setPuntoInicioRecorte] = useState<{ x: number; y: number } | null>(null);

  // resaltar: círculos / flechas
  const [formas, setFormas] = useState<Forma[]>([]);
  const [formaActual, setFormaActual] = useState<Forma | null>(null);
  const [herramienta, setHerramienta] = useState<"circulo" | "flecha" | "tache" | "texto">("circulo");

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      const maxAncho = Math.min(420, window.innerWidth - 48);
      const escala = Math.min(1, maxAncho / img.width);
      setDims({ w: Math.round(img.width * escala), h: Math.round(img.height * escala) });
      setImgCargada(img);
    };
    img.src = imagenBase;
  }, [imagenBase]);

  const dibujarForma = (ctx: CanvasRenderingContext2D, forma: Forma) => {
    ctx.strokeStyle = ROJO_ANOTACION;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    if (forma.tipo === "circulo") {
      const cx = (forma.x1 + forma.x2) / 2;
      const cy = (forma.y1 + forma.y2) / 2;
      const rx = Math.abs(forma.x2 - forma.x1) / 2;
      const ry = Math.abs(forma.y2 - forma.y1) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, Math.max(rx, 3), Math.max(ry, 3), 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (forma.tipo === "flecha") {
      ctx.beginPath();
      ctx.moveTo(forma.x1, forma.y1);
      ctx.lineTo(forma.x2, forma.y2);
      ctx.stroke();
      const angulo = Math.atan2(forma.y2 - forma.y1, forma.x2 - forma.x1);
      const largo = 13;
      ctx.beginPath();
      ctx.moveTo(forma.x2, forma.y2);
      ctx.lineTo(forma.x2 - largo * Math.cos(angulo - Math.PI / 6), forma.y2 - largo * Math.sin(angulo - Math.PI / 6));
      ctx.moveTo(forma.x2, forma.y2);
      ctx.lineTo(forma.x2 - largo * Math.cos(angulo + Math.PI / 6), forma.y2 - largo * Math.sin(angulo + Math.PI / 6));
      ctx.stroke();
    } else if (forma.tipo === "tache") {
      const x1 = Math.min(forma.x1, forma.x2);
      const x2 = Math.max(forma.x1, forma.x2);
      const y1 = Math.min(forma.y1, forma.y2);
      const y2 = Math.max(forma.y1, forma.y2);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.moveTo(x2, y1);
      ctx.lineTo(x1, y2);
      ctx.stroke();
    } else if (forma.tipo === "texto" && forma.texto) {
      ctx.fillStyle = ROJO_ANOTACION;
      ctx.font = "bold 20px Arial";
      ctx.textBaseline = "top";
      ctx.fillText(forma.texto, forma.x1, forma.y1);
    }
  };

  const dimsCanvas = () => (rotacion % 180 === 0 ? { w: dims.w, h: dims.h } : { w: dims.h, h: dims.w });

  const dibujarImagenRotada = (ctx: CanvasRenderingContext2D, ancho: number, alto: number) => {
    if (!imgCargada) return;
    ctx.save();
    ctx.translate(ancho / 2, alto / 2);
    ctx.rotate((rotacion * Math.PI) / 180);
    ctx.drawImage(imgCargada, -dims.w / 2, -dims.h / 2, dims.w, dims.h);
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgCargada || dims.w === 0) return;
    const { w: anchoCanvas, h: altoCanvas } = dimsCanvas();
    canvas.width = anchoCanvas;
    canvas.height = altoCanvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, anchoCanvas, altoCanvas);
    dibujarImagenRotada(ctx, anchoCanvas, altoCanvas);

    if (pestana === "ajustar") {
      const r = recorteArrastre || recorte;
      if (r) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, anchoCanvas, altoCanvas);
        ctx.save();
        ctx.beginPath();
        ctx.rect(r.x, r.y, r.w, r.h);
        ctx.clip();
        dibujarImagenRotada(ctx, anchoCanvas, altoCanvas);
        ctx.restore();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x, r.y, r.w, r.h);
      }
    } else {
      formas.forEach((f) => dibujarForma(ctx, f));
      if (formaActual) dibujarForma(ctx, formaActual);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgCargada, dims, rotacion, recorte, recorteArrastre, pestana, formas, formaActual]);

  const obtenerPosicion = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };
  const iniciar = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const p = obtenerPosicion(e);
    if (pestana === "ajustar") {
      setPuntoInicioRecorte(p);
      setRecorteArrastre({ x: p.x, y: p.y, w: 0, h: 0 });
    } else if (herramienta === "texto") {
      const texto = window.prompt("Escribe el texto a agregar:");
      if (texto && texto.trim()) {
        setFormas((prev) => [...prev, { tipo: "texto", x1: p.x, y1: p.y, x2: p.x, y2: p.y, texto: texto.trim() }]);
      }
    } else {
      setFormaActual({ tipo: herramienta, x1: p.x, y1: p.y, x2: p.x, y2: p.y });
    }
  };
  const mover = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const p = obtenerPosicion(e);
    if (pestana === "ajustar") {
      if (!puntoInicioRecorte) return;
      setRecorteArrastre({
        x: Math.min(puntoInicioRecorte.x, p.x),
        y: Math.min(puntoInicioRecorte.y, p.y),
        w: Math.abs(p.x - puntoInicioRecorte.x),
        h: Math.abs(p.y - puntoInicioRecorte.y),
      });
    } else {
      if (!formaActual) return;
      setFormaActual((prev) => (prev ? { ...prev, x2: p.x, y2: p.y } : prev));
    }
  };
  const terminar = () => {
    if (pestana === "ajustar") {
      setRecorteArrastre((prev) => {
        if (prev && prev.w > 8 && prev.h > 8) setRecorte(prev);
        return null;
      });
      setPuntoInicioRecorte(null);
    } else {
      setFormaActual((prev) => {
        if (prev && (Math.abs(prev.x2 - prev.x1) > 4 || Math.abs(prev.y2 - prev.y1) > 4)) {
          setFormas((f) => [...f, prev]);
        }
        return null;
      });
    }
  };

  const girar = () => {
    setRotacion((prev) => (prev + 90) % 360);
    setRecorte(null);
    setFormas([]);
  };

  const aplicarRecorte = () => {
    if (!recorte || !imgCargada) return;
    const { w: anchoCanvas, h: altoCanvas } = dimsCanvas();
    const limpio = document.createElement("canvas");
    limpio.width = anchoCanvas;
    limpio.height = altoCanvas;
    const ctxLimpio = limpio.getContext("2d");
    if (!ctxLimpio) return;
    dibujarImagenRotada(ctxLimpio, anchoCanvas, altoCanvas);

    const recortado = document.createElement("canvas");
    recortado.width = recorte.w;
    recortado.height = recorte.h;
    const ctxRecorte = recortado.getContext("2d");
    if (!ctxRecorte) return;
    ctxRecorte.drawImage(limpio, recorte.x, recorte.y, recorte.w, recorte.h, 0, 0, recorte.w, recorte.h);

    const nuevaUrl = recortado.toDataURL("image/jpeg", 0.9);
    const img = new Image();
    img.onload = () => {
      setDims({ w: recorte.w, h: recorte.h });
      setImgCargada(img);
      setRotacion(0);
      setRecorte(null);
      setFormas([]);
    };
    img.src = nuevaUrl;
  };

  const deshacer = () => setFormas((prev) => prev.slice(0, -1));
  const confirmar = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onConfirmar(canvas.toDataURL("image/jpeg", 0.85));
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-[70] flex flex-col items-center justify-center p-4">
      <div className="flex items-center gap-2 mb-3 bg-white/10 rounded-full p-1">
        <button
          type="button"
          onClick={() => setPestana("ajustar")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-bold ${pestana === "ajustar" ? "bg-white text-[var(--navy)]" : "text-white"}`}
        >
          Ajustar
        </button>
        <button
          type="button"
          onClick={() => setPestana("resaltar")}
          className={`rounded-full px-4 py-1.5 text-[12px] font-bold ${pestana === "resaltar" ? "bg-white text-[var(--navy)]" : "text-white"}`}
        >
          Resaltar
        </button>
      </div>

      {pestana === "ajustar" ? (
        <div className="flex items-center gap-2 mb-3 flex-wrap justify-center">
          <button type="button" onClick={girar} className="flex items-center gap-1.5 bg-white/10 text-white border border-white/30 rounded-full px-3.5 py-1.5 text-[12px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 12a9 9 0 11-9-9c2.5 0 4.7 1 6.3 2.7" /><path d="M21 3v6h-6" /></svg>
            Girar 90°
          </button>
          <p className="text-white/70 text-[11px] m-0">Arrastra sobre la imagen para recortar</p>
          {recorte && (
            <>
              <button type="button" onClick={aplicarRecorte} className="bg-[var(--green)] text-white rounded-full px-3.5 py-1.5 text-[12px] font-bold">
                Aplicar recorte
              </button>
              <button type="button" onClick={() => setRecorte(null)} className="bg-white/10 text-white border border-white/30 rounded-full px-3.5 py-1.5 text-[12px] font-bold">
                Quitar selección
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            onClick={() => setHerramienta("circulo")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${herramienta === "circulo" ? "bg-[var(--red)] text-white" : "bg-white/10 text-white border border-white/30"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="9" /></svg>
            Círculo
          </button>
          <button
            type="button"
            onClick={() => setHerramienta("flecha")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${herramienta === "flecha" ? "bg-[var(--red)] text-white" : "bg-white/10 text-white border border-white/30"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 19L19 5" /><path d="M9 5h10v10" /></svg>
            Flecha
          </button>
          <button
            type="button"
            onClick={() => setHerramienta("tache")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${herramienta === "tache" ? "bg-[var(--red)] text-white" : "bg-white/10 text-white border border-white/30"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            Tache
          </button>
          <button
            type="button"
            onClick={() => setHerramienta("texto")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-bold ${herramienta === "texto" ? "bg-[var(--red)] text-white" : "bg-white/10 text-white border border-white/30"}`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M4 7V4h16v3M9 20h6M12 4v16" /></svg>
            Texto
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onMouseDown={iniciar}
        onMouseMove={mover}
        onMouseUp={terminar}
        onMouseLeave={terminar}
        onTouchStart={iniciar}
        onTouchMove={mover}
        onTouchEnd={terminar}
        className="rounded-lg bg-white touch-none max-w-full"
        style={{ touchAction: "none" }}
      />
      <div className="flex items-center gap-2.5 mt-4 flex-wrap justify-center">
        {pestana === "resaltar" && (
          <button
            type="button"
            onClick={deshacer}
            disabled={formas.length === 0}
            className="flex items-center gap-1.5 bg-white/10 disabled:opacity-40 text-white border border-white/30 rounded-lg px-3.5 py-2 text-[12.5px] font-bold"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M9 14L4 9l5-5" /><path d="M4 9h11a4 4 0 010 8h-1" /></svg>
            Deshacer
          </button>
        )}
        <button type="button" onClick={onCancelar} className="bg-white/10 text-white border border-white/30 rounded-lg px-4 py-2 text-[12.5px] font-bold">
          Cancelar
        </button>
        <button type="button" onClick={confirmar} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2 text-[12.5px] font-bold">
          Usar foto
        </button>
      </div>
    </div>
  );
}

export default function ComparativoPage() {
  const [comparativos, setComparativos] = useState<Comparativo[]>([]);
  const [cargando, setCargando] = useState(true);

  const cargar = async () => {
    try {
      const res = await fetch("/api/comparativos/list", { cache: "no-store" });
      const data = await res.json();
      setComparativos(data.registros || []);
    } catch {
      // se reintenta al recuperar el foco
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  // ---- Formulario Nuevo comparativo ----
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoFormulario, setModoFormulario] = useState<"reporte" | "antesDespues">("reporte");
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [columnas, setColumnas] = useState<Columna[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [fotoPendiente, setFotoPendiente] = useState<{ idx: number; dataUrl: string } | null>(null);
  const [editandoId, setEditandoId] = useState<number | null>(null);

  const abrirModal = (comparativo?: Comparativo) => {
    if (comparativo) {
      setEditandoId(comparativo.id);
      setModoFormulario(comparativo.modo);
      setTitulo(comparativo.titulo);
      setDescripcion(comparativo.descripcion);
      setColumnas(
        comparativo.columnas.length > 0
          ? comparativo.columnas.map((c) => ({ ...c }))
          : comparativo.modo === "antesDespues"
          ? [columnaVacia("Antes"), columnaVacia("Después")]
          : [columnaVacia("Antes"), columnaVacia("Durante"), columnaVacia("Después")]
      );
    } else {
      setEditandoId(null);
      setModoFormulario("reporte");
      setTitulo("");
      setDescripcion("");
      setColumnas([columnaVacia("Antes"), columnaVacia("Durante"), columnaVacia("Después")]);
    }
    setModalAbierto(true);
  };

  const abrirModalAntesDespues = () => {
    setEditandoId(null);
    setModoFormulario("antesDespues");
    setTitulo("");
    setDescripcion("");
    setColumnas([columnaVacia("Antes"), columnaVacia("Después")]);
    setModalAbierto(true);
  };

  const actualizarColumna = (idx: number, campo: keyof Columna, valor: string) => {
    setColumnas((prev) => prev.map((c, i) => (i === idx ? { ...c, [campo]: valor } : c)));
  };
  const agregarColumna = () =>
    setColumnas((prev) => {
      if (prev.length >= 6) {
        alert("Puedes agregar hasta 6 imágenes por comparativo.");
        return prev;
      }
      return [...prev, columnaVacia(`Columna ${prev.length + 1}`)];
    });
  const quitarColumna = (idx: number) => setColumnas((prev) => prev.filter((_, i) => i !== idx));

  const seleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setFotoPendiente({ idx, dataUrl });
    } catch {
      alert("No se pudo procesar la foto.");
    }
  };
  const confirmarFotoAnotada = (dataUrl: string) => {
    if (fotoPendiente) actualizarColumna(fotoPendiente.idx, "foto", dataUrl);
    setFotoPendiente(null);
  };

  const guardarComparativo = async () => {
    if (!titulo.trim()) {
      alert("Captura un título para el comparativo.");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(editandoId ? "/api/comparativos/update" : "/api/comparativos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editandoId || undefined, titulo: titulo.trim(), descripcion: descripcion.trim(), columnas, modo: modoFormulario }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el comparativo.");
      setModalAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el comparativo.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarComparativo = async (id: number) => {
    if (!confirm("¿Eliminar este comparativo?")) return;
    setComparativos((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch("/api/comparativos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargar();
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Generar comparativo"
          subtitulo="Documenta el antes y después de unidades, mantenimientos o cualquier trabajo realizado."
          backHref="/"
          backLabel="Inicio"
          icono={
            <svg width="24" height="24" viewBox="0 0 24 24" {...sw}>
              <rect x="2" y="4" width="9" height="9" rx="1.5" />
              <rect x="13" y="4" width="9" height="9" rx="1.5" />
              <path d="M2 17h9M13 17h9" />
            </svg>
          }
        />

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
            <button type="button" onClick={() => abrirModal()} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              Nuevo comparativo
            </button>
            <button type="button" onClick={abrirModalAntesDespues} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><rect x="2" y="4" width="9" height="9" rx="1.5" /><rect x="13" y="4" width="9" height="9" rx="1.5" /><path d="M2 17h9M13 17h9" /></svg>
              Mostrar antes y después
            </button>
          </div>

          {cargando && <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Cargando...</p>}

          {!cargando && comparativos.length === 0 && (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-10">Aún no hay comparativos. Crea el primero con &quot;Nuevo comparativo&quot;.</p>
          )}

          <div className="flex flex-col gap-6">
            {comparativos.map((c) => (
              <div key={c.id} className="border border-[var(--gray-200)] rounded-2xl overflow-hidden">
                {c.modo === "antesDespues" ? (
                  <>
                    <div className="relative grid grid-cols-2 gap-[3px] bg-white">
                      <div className="relative h-[300px] bg-[#dfe3ea]">
                        {c.columnas[0]?.foto ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={c.columnas[0].foto} alt="Antes" className="w-full h-full object-cover block" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--gray-400)] text-[11px]">Sin foto</div>
                        )}
                        <span className="absolute top-3 left-3 bg-[var(--red)] text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow">Antes</span>
                      </div>
                      <div className="relative h-[300px] bg-[#dfe3ea]">
                        {c.columnas[1]?.foto ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={c.columnas[1].foto} alt="Después" className="w-full h-full object-cover block" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[var(--gray-400)] text-[11px]">Sin foto</div>
                        )}
                        <span className="absolute top-3 right-3 bg-[var(--blue)] text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1 rounded-full shadow">Después</span>
                      </div>
                    </div>
                    <div className="p-4 sm:p-5 flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-[var(--navy)] text-[16px] m-0">{c.titulo}</h3>
                        {c.descripcion && <p className="text-[12.5px] text-[var(--gray-400)] mt-1 mb-0">{c.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 mt-1">
                        <span onClick={() => abrirModal(c)} className="text-[var(--blue)] cursor-pointer" title="Editar comparativo">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                        </span>
                        <span onClick={() => eliminarComparativo(c.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar comparativo">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-4 sm:p-5 border-b border-[var(--gray-200)] flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-display font-bold text-[var(--navy)] text-[16px] m-0">{c.titulo}</h3>
                        {c.descripcion && <p className="text-[12.5px] text-[var(--gray-400)] mt-1 mb-0">{c.descripcion}</p>}
                      </div>
                      <div className="flex items-center gap-3 shrink-0 mt-1">
                        <span onClick={() => abrirModal(c)} className="text-[var(--blue)] cursor-pointer" title="Editar comparativo">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                        </span>
                        <span onClick={() => eliminarComparativo(c.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar comparativo">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
                        </span>
                      </div>
                    </div>
                    <div className="grid gap-3.5" style={{ gridTemplateColumns: `repeat(${Math.min(3, Math.max(1, c.columnas.length))}, minmax(200px, 1fr))` }}>
                      {c.columnas.map((col, i) => (
                        <div key={i} className="bg-white border border-[var(--gray-200)] rounded-xl overflow-hidden flex flex-col">
                          <div className="py-2.5 px-3 text-center" style={{ backgroundColor: COLORES_COLUMNA[i % COLORES_COLUMNA.length] }}>
                            <span className="text-white text-[12.5px] font-bold uppercase tracking-wide">{col.etiqueta || `Columna ${i + 1}`}</span>
                          </div>
                          <div className="h-[247px] bg-[#dfe3ea] shrink-0">
                            {col.foto ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img src={col.foto} alt={col.etiqueta} className="w-full h-full object-cover block" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[var(--gray-400)] text-[11px]">Sin foto</div>
                            )}
                          </div>
                          {col.texto && (
                            <ul className="p-3 m-0 flex-1 flex flex-col gap-1.5 list-none">
                              {col.texto
                                .split("\n")
                                .filter((linea) => linea.trim())
                                .map((linea, li) => (
                                  <li key={li} className="flex items-start gap-2 text-[12px] text-[var(--navy)] leading-snug">
                                    <span className="w-2 h-2 rounded-full bg-[var(--blue)] mt-[3px] shrink-0" />
                                    <span className="font-semibold">{linea}</span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <PageFooter />
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[820px] max-w-[96%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">
                {editandoId ? "Editar comparativo" : modoFormulario === "antesDespues" ? "Mostrar antes y después" : "Nuevo comparativo"}
              </h3>
              <span onClick={() => setModalAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>

            <div className="mb-3.5">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Título</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Unidad ECO 42 — Lavado de motor" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px]" />
            </div>
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Descripción general (opcional)</label>
              <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className="w-full border border-[var(--gray-200)] rounded-lg p-3 text-[13px]" />
            </div>

            {modoFormulario === "antesDespues" ? (
              <div className="grid grid-cols-2 gap-4">
                {columnas.map((col, idx) => (
                  <div key={idx} className="border border-[var(--gray-200)] rounded-xl overflow-hidden flex flex-col">
                    <div className="py-2 text-center" style={{ backgroundColor: idx === 0 ? "var(--red)" : "var(--blue)" }}>
                      <span className="text-white text-[12.5px] font-bold uppercase tracking-wide">{idx === 0 ? "Antes" : "Después"}</span>
                    </div>
                    <label className="h-[220px] shrink-0 bg-[var(--gray-100)] flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden">
                      {col.foto ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={col.foto} alt={col.etiqueta} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                          <span className="text-[11px] font-bold text-[var(--gray-400)]">Agregar foto</span>
                        </>
                      )}
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => seleccionarFoto(e, idx)} className="hidden" />
                    </label>
                    {col.foto && (
                      <span
                        onClick={() => setFotoPendiente({ idx, dataUrl: col.foto })}
                        className="text-[11px] font-bold text-[var(--red)] text-center py-1.5 cursor-pointer border-t border-[var(--gray-200)]"
                      >
                        ○→ Editar / resaltar en la foto
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
            <div className="overflow-x-auto pb-1">
              <div className="flex gap-3.5" style={{ minWidth: columnas.length * 210 }}>
                {columnas.map((col, idx) => (
                  <div key={idx} className="w-[195px] shrink-0 border border-[var(--gray-200)] rounded-xl overflow-hidden flex flex-col">
                    <div className="p-2" style={{ backgroundColor: COLORES_COLUMNA[idx % COLORES_COLUMNA.length] }}>
                      <input
                        value={col.etiqueta}
                        onChange={(e) => actualizarColumna(idx, "etiqueta", e.target.value)}
                        placeholder="Etiqueta"
                        className="w-full bg-transparent text-white placeholder-white/70 text-center text-[12.5px] font-bold uppercase outline-none"
                      />
                    </div>
                    <label className="h-[190px] shrink-0 bg-[var(--gray-100)] flex flex-col items-center justify-center gap-1 cursor-pointer overflow-hidden border-b border-[var(--gray-200)]">
                      {col.foto ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={col.foto} alt={col.etiqueta} className="w-full h-full object-cover" />
                      ) : (
                        <>
                          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9aa1b0" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                          <span className="text-[10.5px] font-bold text-[var(--gray-400)]">Agregar foto</span>
                        </>
                      )}
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => seleccionarFoto(e, idx)} className="hidden" />
                    </label>
                    {col.foto && (
                      <span
                        onClick={() => setFotoPendiente({ idx, dataUrl: col.foto })}
                        className="text-[10.5px] font-bold text-[var(--red)] text-center py-1.5 cursor-pointer border-b border-[var(--gray-200)]"
                      >
                        ○→ Resaltar en la foto
                      </span>
                    )}
                    <textarea
                      value={col.texto}
                      onChange={(e) => actualizarColumna(idx, "texto", e.target.value)}
                      placeholder="Un punto por línea (se muestran como viñetas)"
                      rows={4}
                      className="flex-1 text-[12px] p-2 outline-none resize-none"
                    />
                    {columnas.length > 1 && (
                      <span onClick={() => quitarColumna(idx)} className="text-[var(--red)] text-[10.5px] font-bold text-center py-1.5 cursor-pointer border-t border-[var(--gray-200)]">
                        Quitar columna
                      </span>
                    )}
                  </div>
                ))}
                {columnas.length < 6 && (
                  <button
                    type="button"
                    onClick={agregarColumna}
                    className="w-[70px] shrink-0 border-2 border-dashed border-[var(--gray-200)] rounded-xl flex flex-col items-center justify-center gap-1 text-[var(--navy)]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                    <span className="text-[10.5px] font-bold">Columna</span>
                  </button>
                )}
              </div>
            </div>
            )}

            <div className="flex gap-2.5 justify-end mt-6">
              <button type="button" onClick={() => setModalAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarComparativo} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {fotoPendiente && <ModalAnotarImagen imagenBase={fotoPendiente.dataUrl} onConfirmar={confirmarFotoAnotada} onCancelar={() => setFotoPendiente(null)} />}
    </div>
  );
}
