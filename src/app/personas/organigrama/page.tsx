"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };
const COLORES = ["#2f6fed", "#e2412c", "#21a866", "#f2b134", "#8b5cf6", "#16215c", "#767b87"];
const CANVAS_W = 2400;
const CANVAS_H = 1400;

type Caja = { id: string; x: number; y: number; w: number; h: number; texto: string; color: string };
type Texto = { id: string; x: number; y: number; texto: string };
type Linea = { id: string; x1: number; y1: number; x2: number; y2: number };
type PersonaOrg = { id: string; x: number; y: number; expedienteId: number; nombre: string; puesto: string | null; fotografia: string | null };
type Datos = { cajas: Caja[]; textos: Texto[]; lineas: Linea[]; personas: PersonaOrg[] };
type ExpedienteResumen = { id: number; nombre: string; puesto: string | null; fotografia: string | null };

function nuevoId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

declare global {
  interface Window {
    QRious: any;
  }
}
function cargarQRiousLib(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.QRious) {
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

type Arrastre =
  | { tipo: "caja"; id: string; offsetX: number; offsetY: number }
  | { tipo: "texto"; id: string; offsetX: number; offsetY: number }
  | { tipo: "persona"; id: string; offsetX: number; offsetY: number }
  | { tipo: "resize"; id: string; startX: number; startY: number; startW: number; startH: number }
  | { tipo: "lineaInicio" | "lineaFin"; id: string };

export default function OrganigramaPage() {
  const [datos, setDatos] = useState<Datos>({ cajas: [], textos: [], lineas: [], personas: [] });
  const [cargando, setCargando] = useState(true);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [insertarAbierto, setInsertarAbierto] = useState(false);
  const [expedientes, setExpedientes] = useState<ExpedienteResumen[]>([]);
  const [busquedaInsertar, setBusquedaInsertar] = useState("");
  const [qrPersona, setQrPersona] = useState<PersonaOrg | null>(null);
  const arrastreRef = useRef<Arrastre | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/organigrama", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setDatos({ cajas: data.datos.cajas || [], textos: data.datos.textos || [], lineas: data.datos.lineas || [], personas: data.datos.personas || [] });
      })
      .finally(() => setCargando(false));
  }, []);

  const guardar = useCallback((nuevo: Datos) => {
    fetch("/api/organigrama", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ datos: nuevo }),
    }).catch(() => {});
  }, []);

  const actualizar = (fn: (prev: Datos) => Datos) => {
    setDatos((prev) => {
      const nuevo = fn(prev);
      guardar(nuevo);
      return nuevo;
    });
  };

  const agregarCaja = () => {
    const nueva: Caja = { id: nuevoId(), x: 120, y: 100, w: 170, h: 66, texto: "Nuevo puesto", color: COLORES[0] };
    actualizar((prev) => ({ ...prev, cajas: [...prev.cajas, nueva] }));
  };
  const agregarTexto = () => {
    const nuevo: Texto = { id: nuevoId(), x: 120, y: 220, texto: "Texto" };
    actualizar((prev) => ({ ...prev, textos: [...prev.textos, nuevo] }));
  };
  const agregarLinea = () => {
    const nueva: Linea = { id: nuevoId(), x1: 150, y1: 350, x2: 380, y2: 350 };
    actualizar((prev) => ({ ...prev, lineas: [...prev.lineas, nueva] }));
  };
  const abrirInsertar = () => {
    setInsertarAbierto(true);
    if (expedientes.length === 0) {
      fetch("/api/expedientes/list", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setExpedientes(d.registros || []))
        .catch(() => {});
    }
  };
  const insertarPersona = (e: ExpedienteResumen) => {
    const nueva: PersonaOrg = { id: nuevoId(), x: 140, y: 140, expedienteId: e.id, nombre: e.nombre, puesto: e.puesto, fotografia: e.fotografia };
    actualizar((prev) => ({ ...prev, personas: [...prev.personas, nueva] }));
    setInsertarAbierto(false);
  };
  const eliminarPersona = (id: string) => actualizar((prev) => ({ ...prev, personas: prev.personas.filter((p) => p.id !== id) }));

  useEffect(() => {
    if (!qrPersona) return;
    cargarQRiousLib()
      .then(() => {
        const canvas = document.getElementById("qr-organigrama-modal") as HTMLCanvasElement | null;
        if (canvas) {
          new window.QRious({ element: canvas, value: `${window.location.origin}/personas/expedientes/detalle?id=${qrPersona.expedienteId}`, size: 190, level: "M" });
        }
      })
      .catch(() => {});
  }, [qrPersona]);
  const eliminarCaja = (id: string) => actualizar((prev) => ({ ...prev, cajas: prev.cajas.filter((c) => c.id !== id) }));
  const eliminarTexto = (id: string) => actualizar((prev) => ({ ...prev, textos: prev.textos.filter((t) => t.id !== id) }));
  const eliminarLinea = (id: string) => actualizar((prev) => ({ ...prev, lineas: prev.lineas.filter((l) => l.id !== id) }));
  const cambiarColorCaja = (id: string, color: string) => actualizar((prev) => ({ ...prev, cajas: prev.cajas.map((c) => (c.id === id ? { ...c, color } : c)) }));
  const cambiarTextoCaja = (id: string, texto: string) => actualizar((prev) => ({ ...prev, cajas: prev.cajas.map((c) => (c.id === id ? { ...c, texto } : c)) }));
  const cambiarTextoTexto = (id: string, texto: string) => actualizar((prev) => ({ ...prev, textos: prev.textos.map((t) => (t.id === id ? { ...t, texto } : t)) }));

  // ---- Arrastre (pointer events) ----
  const iniciarCaja = (e: React.PointerEvent, c: Caja) => {
    if (editandoId) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastreRef.current = { tipo: "caja", id: c.id, offsetX: e.clientX - c.x, offsetY: e.clientY - c.y };
  };
  const iniciarResize = (e: React.PointerEvent, c: Caja) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastreRef.current = { tipo: "resize", id: c.id, startX: e.clientX, startY: e.clientY, startW: c.w, startH: c.h };
  };
  const iniciarTexto = (e: React.PointerEvent, t: Texto) => {
    if (editandoId) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastreRef.current = { tipo: "texto", id: t.id, offsetX: e.clientX - t.x, offsetY: e.clientY - t.y };
  };
  const iniciarPersona = (e: React.PointerEvent, p: PersonaOrg) => {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    arrastreRef.current = { tipo: "persona", id: p.id, offsetX: e.clientX - p.x, offsetY: e.clientY - p.y };
  };
  const iniciarPuntoLinea = (e: React.PointerEvent, id: string, punto: "lineaInicio" | "lineaFin") => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    arrastreRef.current = { tipo: punto, id };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const a = arrastreRef.current;
    if (!a) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (a.tipo === "caja") {
      const x = Math.max(0, e.clientX - a.offsetX);
      const y = Math.max(0, e.clientY - a.offsetY);
      setDatos((prev) => ({ ...prev, cajas: prev.cajas.map((c) => (c.id === a.id ? { ...c, x, y } : c)) }));
    } else if (a.tipo === "texto") {
      const x = Math.max(0, e.clientX - a.offsetX);
      const y = Math.max(0, e.clientY - a.offsetY);
      setDatos((prev) => ({ ...prev, textos: prev.textos.map((t) => (t.id === a.id ? { ...t, x, y } : t)) }));
    } else if (a.tipo === "persona") {
      const x = Math.max(0, e.clientX - a.offsetX);
      const y = Math.max(0, e.clientY - a.offsetY);
      setDatos((prev) => ({ ...prev, personas: prev.personas.map((p) => (p.id === a.id ? { ...p, x, y } : p)) }));
    } else if (a.tipo === "resize") {
      const w = Math.max(80, a.startW + (e.clientX - a.startX));
      const h = Math.max(44, a.startH + (e.clientY - a.startY));
      setDatos((prev) => ({ ...prev, cajas: prev.cajas.map((c) => (c.id === a.id ? { ...c, w, h } : c)) }));
    } else if (a.tipo === "lineaInicio") {
      const x1 = e.clientX - rect.left + (canvasRef.current?.scrollLeft || 0);
      const y1 = e.clientY - rect.top + (canvasRef.current?.scrollTop || 0);
      setDatos((prev) => ({ ...prev, lineas: prev.lineas.map((l) => (l.id === a.id ? { ...l, x1, y1 } : l)) }));
    } else if (a.tipo === "lineaFin") {
      const x2 = e.clientX - rect.left + (canvasRef.current?.scrollLeft || 0);
      const y2 = e.clientY - rect.top + (canvasRef.current?.scrollTop || 0);
      setDatos((prev) => ({ ...prev, lineas: prev.lineas.map((l) => (l.id === a.id ? { ...l, x2, y2 } : l)) }));
    }
  };
  const onPointerUp = () => {
    if (arrastreRef.current) {
      guardar(datos);
      arrastreRef.current = null;
    }
  };

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Organigrama"
          subtitulo="Arrastra para acomodar recuadros, textos y líneas. Los cambios se guardan automáticamente."
          backHref="/personas/expedientes"
          backLabel="Expedientes"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="9" y="3" width="6" height="4" rx="1" /><rect x="2" y="14" width="6" height="4" rx="1" /><rect x="16" y="14" width="6" height="4" rx="1" /><path d="M12 7v4M12 11H5v3M12 11h7v3" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 mb-4">
          <button type="button" onClick={abrirInsertar} className="flex items-center gap-1.5 bg-[var(--blue)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="9" cy="7" r="4" /><path d="M2 21v-2a4 4 0 014-4h6a4 4 0 014 4v2" /><path d="M19 8v6M22 11h-6" /></svg>
            Insertar
          </button>
          <button type="button" onClick={agregarCaja} className="flex items-center gap-1.5 bg-[var(--navy)] text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="3" y="5" width="18" height="14" rx="2" /></svg>
            + Recuadro
          </button>
          <button type="button" onClick={agregarTexto} className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M4 6h16M12 6v14" /></svg>
            + Texto
          </button>
          <button type="button" onClick={agregarLinea} className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2 text-[12.5px] font-bold">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M5 19L19 5" /></svg>
            + Línea
          </button>
          <span className="text-[11px] text-[var(--gray-400)] self-center ml-2">Doble clic en un recuadro/texto para editarlo · arrastra la esquina inferior derecha del recuadro para cambiar su tamaño · pasa el cursor sobre una línea para mover sus extremos</span>
        </div>

        <div className="bg-white rounded-[18px] shadow-[0_1px_3px_rgba(22,33,92,0.06)] overflow-auto" style={{ maxHeight: "75vh" }}>
          {cargando ? (
            <p className="text-center text-[var(--gray-400)] text-[13px] py-16">Cargando organigrama...</p>
          ) : (
            <div
              ref={canvasRef}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              className="relative"
              style={{
                width: CANVAS_W,
                height: CANVAS_H,
                backgroundImage: "radial-gradient(circle, #e5e8ee 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            >
              <svg width={CANVAS_W} height={CANVAS_H} className="absolute inset-0 pointer-events-none">
                {datos.lineas.map((l) => (
                  <line key={l.id} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#16215c" strokeWidth={2} />
                ))}
              </svg>

              {datos.lineas.map((l) => (
                <div key={l.id}>
                  <div
                    onPointerDown={(e) => iniciarPuntoLinea(e, l.id, "lineaInicio")}
                    className="absolute w-4 h-4 rounded-full bg-[var(--navy)] border-2 border-white cursor-grab shadow opacity-0 hover:opacity-70 transition-opacity"
                    style={{ left: l.x1 - 8, top: l.y1 - 8 }}
                    title="Arrastra para mover el inicio de la línea"
                  />
                  <div
                    onPointerDown={(e) => iniciarPuntoLinea(e, l.id, "lineaFin")}
                    className="absolute w-4 h-4 rounded-full bg-[var(--navy)] border-2 border-white cursor-grab shadow opacity-0 hover:opacity-70 transition-opacity"
                    style={{ left: l.x2 - 8, top: l.y2 - 8 }}
                    title="Arrastra para mover el final de la línea"
                  />
                  <span
                    onClick={() => eliminarLinea(l.id)}
                    className="absolute text-[var(--gray-400)] hover:text-[var(--red)] cursor-pointer bg-white rounded-full w-4 h-4 items-center justify-center text-[10px] shadow flex opacity-50 hover:opacity-100 transition-opacity"
                    style={{ left: (l.x1 + l.x2) / 2 - 8, top: (l.y1 + l.y2) / 2 - 8 }}
                    title="Eliminar línea"
                  >
                    ✕
                  </span>
                </div>
              ))}

              {datos.textos.map((t) => (
                <div
                  key={t.id}
                  onPointerDown={(e) => iniciarTexto(e, t)}
                  onDoubleClick={() => setEditandoId(t.id)}
                  className="absolute cursor-grab select-none group"
                  style={{ left: t.x, top: t.y }}
                >
                  {editandoId === t.id ? (
                    <input
                      autoFocus
                      defaultValue={t.texto}
                      onBlur={(e) => {
                        cambiarTextoTexto(t.id, e.target.value);
                        setEditandoId(null);
                      }}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                      className="border border-[var(--blue)] rounded px-1.5 py-0.5 text-[13px] font-semibold text-[var(--navy)]"
                    />
                  ) : (
                    <span className="text-[13px] font-semibold text-[var(--navy)] px-1">{t.texto}</span>
                  )}
                  <span onClick={() => eliminarTexto(t.id)} className="hidden group-hover:inline text-[var(--red)] cursor-pointer text-[10px] ml-1" title="Eliminar texto">
                    ✕
                  </span>
                </div>
              ))}

              {datos.cajas.map((c) => (
                <div
                  key={c.id}
                  onPointerDown={(e) => iniciarCaja(e, c)}
                  className="absolute bg-white rounded-lg shadow-md cursor-grab flex flex-col group"
                  style={{ left: c.x, top: c.y, width: c.w, height: c.h, borderTop: `4px solid ${c.color}`, border: `1px solid var(--gray-200)`, borderTopWidth: 4, borderTopColor: c.color }}
                >
                  <span
                    onClick={() => eliminarCaja(c.id)}
                    className="hidden group-hover:flex absolute -top-2 -right-2 text-white bg-[var(--red)] cursor-pointer rounded-full w-5 h-5 items-center justify-center text-[10px] shadow"
                    title="Eliminar recuadro"
                  >
                    ✕
                  </span>
                  <div className="flex-1 flex items-center justify-center px-2 text-center" onDoubleClick={() => setEditandoId(c.id)}>
                    {editandoId === c.id ? (
                      <textarea
                        autoFocus
                        defaultValue={c.texto}
                        onBlur={(e) => {
                          cambiarTextoCaja(c.id, e.target.value);
                          setEditandoId(null);
                        }}
                        className="w-full h-full text-center text-[12.5px] font-bold text-[var(--navy)] outline-none resize-none border border-[var(--blue)] rounded"
                      />
                    ) : (
                      <span className="text-[12.5px] font-bold text-[var(--navy)] leading-snug whitespace-pre-wrap">{c.texto}</span>
                    )}
                  </div>
                  <div className="hidden group-hover:flex gap-1 justify-center pb-1">
                    {COLORES.map((col) => (
                      <span
                        key={col}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => cambiarColorCaja(c.id, col)}
                        className="w-3 h-3 rounded-full cursor-pointer border border-white"
                        style={{ backgroundColor: col }}
                      />
                    ))}
                  </div>
                  <div
                    onPointerDown={(e) => iniciarResize(e, c)}
                    className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-nwse-resize"
                    style={{ background: "linear-gradient(135deg, transparent 50%, var(--gray-400) 50%)" }}
                  />
                </div>
              ))}

              {datos.personas.map((p) => (
                <div
                  key={p.id}
                  onPointerDown={(e) => iniciarPersona(e, p)}
                  className="absolute bg-white border border-[var(--gray-200)] rounded-xl p-2 shadow-md cursor-grab group"
                  style={{ left: p.x, top: p.y, width: 300 }}
                >
                  <div className="flex items-center gap-2.5">
                    {p.fotografia ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.fotografia} alt={p.nombre} className="w-10 h-10 rounded-lg object-cover shrink-0 border border-[var(--gray-200)]" draggable={false} />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 leading-tight truncate">{p.nombre}</p>
                      {p.puesto && <p className="text-[11px] font-semibold text-[var(--blue)] m-0 truncate">{p.puesto}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setQrPersona(p)}
                        title="Ver código QR"
                        className="w-[26px] h-[26px] rounded-md bg-[var(--gray-100)] flex items-center justify-center cursor-pointer"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2">
                          <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" />
                          <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
                        </svg>
                      </span>
                      <span
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => eliminarPersona(p.id)}
                        title="Quitar del organigrama"
                        className="w-[26px] h-[26px] rounded-md bg-[var(--gray-100)] hover:bg-[rgba(226,65,44,0.12)] flex items-center justify-center cursor-pointer"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#e2412c" strokeWidth="2.4"><path d="M18 6L6 18M6 6l12 12" /></svg>
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {insertarAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setInsertarAbierto(false)}>
          <div className="bg-white rounded-2xl w-[420px] max-w-full max-h-[80vh] flex flex-col shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-[var(--gray-200)]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[15px] font-bold text-[var(--navy)] m-0">Insertar del expediente</h3>
                <span onClick={() => setInsertarAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">✕</span>
              </div>
              <input
                type="text"
                autoFocus
                value={busquedaInsertar}
                onChange={(e) => setBusquedaInsertar(e.target.value)}
                placeholder="Buscar por nombre o puesto..."
                className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px]"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {expedientes.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)] text-center py-6">Cargando expedientes...</p>}
              {expedientes.length > 0 && expedientes.filter((e) => !datos.personas.some((p) => p.expedienteId === e.id)).length === 0 && (
                <p className="text-[12.5px] text-[var(--gray-400)] text-center py-6">Ya insertaste a todo el personal en el lienzo.</p>
              )}
              {expedientes
                .filter((e) => !datos.personas.some((p) => p.expedienteId === e.id))
                .filter((e) => !busquedaInsertar.trim() || e.nombre.toLowerCase().includes(busquedaInsertar.trim().toLowerCase()) || (e.puesto || "").toLowerCase().includes(busquedaInsertar.trim().toLowerCase()))
                .map((e) => (
                  <button key={e.id} type="button" onClick={() => insertarPersona(e)} className="w-full text-left px-2.5 py-2.5 rounded-lg hover:bg-[var(--gray-100)] flex items-center gap-3">
                    {e.fotografia ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={e.fotografia} alt={e.nombre} className="w-9 h-9 rounded-lg object-cover shrink-0 border border-[var(--gray-200)]" />
                    ) : (
                      <div className="w-9 h-9 rounded-lg bg-[var(--blue-light)] flex items-center justify-center shrink-0">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6" /></svg>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-bold text-[var(--navy)] m-0 truncate">{e.nombre}</p>
                      {e.puesto && <p className="text-[10.5px] text-[var(--gray-400)] m-0 truncate">{e.puesto}</p>}
                    </div>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {qrPersona && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-center justify-center p-4 z-50" onClick={() => setQrPersona(null)}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-[0_1px_3px_rgba(22,33,92,0.06)]" onClick={(e) => e.stopPropagation()}>
            <p className="text-[13.5px] font-bold text-[var(--navy)] mb-1">{qrPersona.nombre}</p>
            <p className="text-[11.5px] text-[var(--gray-400)] mb-4">Escanea para consultar el expediente</p>
            <div className="w-[210px] h-[210px] rounded-xl bg-white border border-[var(--gray-200)] flex items-center justify-center mx-auto mb-4 p-2.5">
              <canvas id="qr-organigrama-modal" />
            </div>
            <button type="button" onClick={() => setQrPersona(null)} className="bg-[var(--navy)] text-white rounded-lg px-6 py-2.5 text-[13px] font-bold">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
