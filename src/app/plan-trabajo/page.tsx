"use client";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import PageHeader from "@/components/PageHeader";
import PageFooter from "@/components/PageFooter";
import { compressImage } from "@/lib/imageUtils";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";

const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

type Avance = { texto: string; fecha: string };
type FotoDesc = { foto: string; descripcion: string };
type DocumentoAdjunto = { nombre: string; dataUrl: string };
type Tarea = {
  id: number;
  tarea: string;
  responsable: string;
  fechaEntrega: string;
  estado: string;
  avances: Avance[];
  color: string;
  categoria: string;
  urgente: boolean;
  orden: number;
  ancho: "full" | "mitad";
  archivada: boolean;
  fotosCount: number;
  documentosCount: number;
};
type SublistaItem = { id: number; tareaId: number; texto: string; marcado: boolean };
type GastoTarea = {
  id: number;
  tareaId: number;
  tareaNombre: string;
  cantidad: string;
  descripcion: string;
  monto: string;
  tipoTransaccion: string;
  referencia: string;
  fondo: string;
  fecha: string;
};
type Actividad = {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  responsable: string;
  color: string;
  orden: number;
  avance: number;
};
type CostoItem = {
  id: number;
  actividadId: number;
  cantidad: string;
  unidad: string;
  descripcion: string;
  subTotal: string;
  proveedor: string;
};
const COLORES_GANTT = ["#2f6fed", "#8b5cf6", "#21a866", "#f2b134", "#e2412c", "#16215c", "#0ea5a5", "#ec4899"];
const COLUMNAS: { key: string; titulo: string }[] = [
  { key: "lista", titulo: "Lista de tareas" },
  { key: "proceso", titulo: "En proceso" },
  { key: "espera", titulo: "En espera" },
  { key: "completadas", titulo: "Completadas" },
];
const COLORES_DISPONIBLES = ["#e2412c", "#f2b134", "#21a866", "#2f6fed", "#8b5cf6", "#ec4899", "#16215c", "#767b87"];
const OPCIONES_TIPO_TRANSACCION = ["Compra", "Anticipo", "Reembolso", "Ajuste", "Otro"];
const FONDOS = ["Adrian", "Saul", "Sr. Alfredo", "Sr. Jorge"];
const AZUL_ELECTRICO = "#2f8dff";

function formatearFecha(f: string) {
  if (!f) return "Sin fecha";
  const d = new Date(`${f}T00:00:00`);
  if (isNaN(d.getTime())) return f;
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function GraficaGastosPorDia({ gastos }: { gastos: GastoTarea[] }) {
  const porDia = useMemo(() => {
    const mapa: Record<string, number> = {};
    gastos.forEach((g) => {
      const dia = (g.fecha || "").slice(0, 10);
      if (!dia) return;
      mapa[dia] = (mapa[dia] || 0) + (parseFloat(g.monto) || 0);
    });
    return Object.entries(mapa)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14);
  }, [gastos]);

  if (porDia.length === 0) {
    return <div className="h-full flex items-center justify-center text-[12.5px] text-[var(--gray-400)]">Sin gastos registrados aún.</div>;
  }

  const ancho = 480;
  const alto = 150;
  const padding = 24;
  const maxMonto = Math.max(1, ...porDia.map(([, m]) => m));
  const pasoX = porDia.length > 1 ? (ancho - padding * 2) / (porDia.length - 1) : 0;
  const puntos = porDia.map(([dia, monto], i) => {
    const x = padding + i * pasoX;
    const y = alto - padding - ((alto - padding * 2) * monto) / maxMonto;
    return { x, y, dia, monto };
  });
  const linea = puntos.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full h-full">
      <line x1={padding} y1={alto - padding} x2={ancho - padding} y2={alto - padding} stroke="#e5e8ee" strokeWidth="1" />
      <polyline points={linea} fill="none" stroke="#2f8dff" strokeWidth="2" />
      {puntos.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill="#2f8dff" />
          {(i === 0 || i === puntos.length - 1 || i % 3 === 0) && (
            <text x={p.x} y={alto - padding + 12} fontSize="8" textAnchor="middle" fill="#9aa1b0">
              {p.dia.slice(5)}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

export default function PlanTrabajoPage() {
  const [vistaActiva, setVistaActiva] = useState<"kanban" | "gantt" | "fondos">("kanban");
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [fTarea, setFTarea] = useState("");
  const [fResponsable, setFResponsable] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fFotos, setFFotos] = useState<FotoDesc[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [arrastrandoId, setArrastrandoId] = useState<number | null>(null);
  const [sobreInfo, setSobreInfo] = useState<{ colKey: string; targetId: number; posicion: "antes" | "despues"; ancho: "full" | "mitad" } | null>(null);

  const cargar = async () => {
    try {
      const res = await fetch("/api/tareas/list", { cache: "no-store" });
      const data = await res.json();
      setTareas(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);
  useRefrescarAlEnfocar(cargar);

  const abrirForm = () => {
    setEditandoId(null);
    setFTarea("");
    setFResponsable("");
    setFFecha("");
    setFFotos([]);
    setFormAbierto(true);
  };

  const abrirEditarTarea = async (t: Tarea) => {
    setEditandoId(t.id);
    setFTarea(t.tarea);
    setFResponsable(t.responsable);
    setFFecha(t.fechaEntrega);
    setFFotos([]);
    setFormAbierto(true);
    if (t.fotosCount > 0) {
      try {
        const res = await fetch(`/api/tareas/adjuntos?id=${t.id}`, { cache: "no-store" });
        const data = await res.json();
        setFFotos(data.fotos || []);
      } catch {
        // si falla, el formulario queda sin fotos precargadas
      }
    }
  };

  const guardar = async () => {
    if (!fTarea.trim() || !fResponsable.trim()) {
      alert("Captura la tarea y el responsable.");
      return;
    }
    setGuardando(true);
    try {
      let idTarea = editandoId;
      if (editandoId !== null) {
        const res = await fetch("/api/tareas/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editandoId, tarea: fTarea.trim(), responsable: fResponsable.trim(), fechaEntrega: fFecha || " " }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al guardar.");
      } else {
        const res = await fetch("/api/tareas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tarea: fTarea.trim(), responsable: fResponsable.trim(), fechaEntrega: fFecha }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Error al guardar.");
        idTarea = data.id;
      }
      if (idTarea) {
        await fetch("/api/tareas/adjuntos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: idTarea, fotos: fFotos }),
        });
      }
      setFormAbierto(false);
      await cargar();
    } catch (err: any) {
      alert(err.message || "Error al guardar la tarea.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminarTarea = async (id: number) => {
    if (!confirm("¿Eliminar esta tarea?")) return;
    setTareas((prev) => prev.filter((t) => t.id !== id));
    try {
      await fetch("/api/tareas/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargar();
    }
  };

  // ---- Tarjetas colapsables (por defecto colapsadas) ----
  const [tarjetasExpandidas, setTarjetasExpandidas] = useState<Set<number>>(new Set());
  const toggleExpandida = (id: number) => {
    setTarjetasExpandidas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  };

  // ---- Sub-lista (checklist por tarea) ----
  const [sublistas, setSublistas] = useState<SublistaItem[]>([]);
  const cargarSublistas = async () => {
    try {
      const res = await fetch("/api/tareas/sublista/list", { cache: "no-store" });
      const data = await res.json();
      setSublistas(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    }
  };
  useEffect(() => {
    cargarSublistas();
  }, []);
  useRefrescarAlEnfocar(cargarSublistas);

  const [nuevoPuntoSublista, setNuevoPuntoSublista] = useState<Record<number, string>>({});
  const agregarPuntoSublista = async (tareaId: number) => {
    const texto = (nuevoPuntoSublista[tareaId] || "").trim();
    if (!texto) return;
    try {
      const res = await fetch("/api/tareas/sublista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tareaId, texto }),
      });
      const data = await res.json();
      setSublistas((prev) => [...prev, { id: data.id, tareaId, texto, marcado: false }]);
      setNuevoPuntoSublista((prev) => ({ ...prev, [tareaId]: "" }));
    } catch {
      alert("No se pudo agregar el punto.");
    }
  };
  const toggleMarcadoSublista = async (item: SublistaItem) => {
    const nuevoMarcado = !item.marcado;
    setSublistas((prev) => prev.map((s) => (s.id === item.id ? { ...s, marcado: nuevoMarcado } : s)));
    try {
      await fetch("/api/tareas/sublista/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, marcado: nuevoMarcado }),
      });
    } catch {
      await cargarSublistas();
    }
  };
  const eliminarPuntoSublista = async (id: number) => {
    setSublistas((prev) => prev.filter((s) => s.id !== id));
    try {
      await fetch("/api/tareas/sublista/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarSublistas();
    }
  };
  const progresoSublista = (tareaId: number) => {
    const items = sublistas.filter((s) => s.tareaId === tareaId);
    if (items.length === 0) return null;
    const marcados = items.filter((s) => s.marcado).length;
    return { marcados, total: items.length, porcentaje: Math.round((marcados / items.length) * 100) };
  };

  // ---- Documentos adjuntos por tarea ----
  const [documentosAbiertos, setDocumentosAbiertos] = useState<Tarea | null>(null);
  const [docsLocal, setDocsLocal] = useState<DocumentoAdjunto[]>([]);
  const [guardandoDocs, setGuardandoDocs] = useState(false);
  const abrirDocumentos = async (t: Tarea) => {
    setDocsLocal([]);
    setDocumentosAbiertos(t);
    if (t.documentosCount > 0) {
      try {
        const res = await fetch(`/api/tareas/adjuntos?id=${t.id}`, { cache: "no-store" });
        const data = await res.json();
        setDocsLocal(data.documentos || []);
      } catch {
        // si falla, el modal queda sin documentos precargados
      }
    }
  };
  const agregarDocumentos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const nuevos: DocumentoAdjunto[] = [];
    for (const file of files) {
      const dataUrl: string = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      }).catch(() => "");
      if (dataUrl) nuevos.push({ nombre: file.name, dataUrl });
    }
    setDocsLocal((prev) => [...prev, ...nuevos]);
    e.target.value = "";
  };
  const quitarDocumento = (idx: number) => setDocsLocal((prev) => prev.filter((_, i) => i !== idx));
  const guardarDocumentos = async () => {
    if (!documentosAbiertos) return;
    setGuardandoDocs(true);
    try {
      await fetch("/api/tareas/adjuntos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: documentosAbiertos.id, documentos: docsLocal }),
      });
      setTareas((prev) => prev.map((t) => (t.id === documentosAbiertos.id ? { ...t, documentosCount: docsLocal.length } : t)));
      setDocumentosAbiertos(null);
    } catch {
      alert("No se pudieron guardar los documentos.");
    } finally {
      setGuardandoDocs(false);
    }
  };

  // ---- Requerimientos / Gastos por tarea ----
  const [gastosPorTareaAbierto, setGastosPorTareaAbierto] = useState<Tarea | null>(null);
  const [todosLosGastos, setTodosLosGastos] = useState<GastoTarea[]>([]);
  const cargarGastosTareas = async () => {
    try {
      const res = await fetch("/api/tareas/gastos/list", { cache: "no-store" });
      const data = await res.json();
      setTodosLosGastos(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    }
  };
  useEffect(() => {
    cargarGastosTareas();
  }, []);
  useRefrescarAlEnfocar(cargarGastosTareas);

  const [gCantidad, setGCantidad] = useState("");
  const [gDescripcion, setGDescripcion] = useState("");
  const [gMonto, setGMonto] = useState("");
  const [gTipo, setGTipo] = useState(OPCIONES_TIPO_TRANSACCION[0]);
  const [gReferencia, setGReferencia] = useState("");
  const [gFondo, setGFondo] = useState(FONDOS[0]);
  const [guardandoGasto, setGuardandoGasto] = useState(false);

  const abrirGastosPorTarea = (t: Tarea) => {
    setGCantidad("");
    setGDescripcion("");
    setGMonto("");
    setGTipo(OPCIONES_TIPO_TRANSACCION[0]);
    setGReferencia("");
    setGFondo(FONDOS[0]);
    setGastosPorTareaAbierto(t);
  };
  const guardarGastoTarea = async () => {
    if (!gastosPorTareaAbierto) return;
    if (!gDescripcion.trim() || !gMonto) {
      alert("Captura al menos la descripción y el monto.");
      return;
    }
    setGuardandoGasto(true);
    try {
      await fetch("/api/tareas/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareaId: gastosPorTareaAbierto.id,
          tareaNombre: gastosPorTareaAbierto.tarea,
          cantidad: gCantidad,
          descripcion: gDescripcion.trim(),
          monto: gMonto,
          tipoTransaccion: gTipo,
          referencia: gReferencia,
          fondo: gFondo,
        }),
      });
      setGCantidad("");
      setGDescripcion("");
      setGMonto("");
      setGReferencia("");
      await cargarGastosTareas();
    } catch {
      alert("No se pudo guardar el registro.");
    } finally {
      setGuardandoGasto(false);
    }
  };
  const eliminarGastoTarea = async (id: number) => {
    if (!confirm("¿Eliminar este registro?")) return;
    setTodosLosGastos((prev) => prev.filter((g) => g.id !== id));
    try {
      await fetch("/api/tareas/gastos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    } catch {
      await cargarGastosTareas();
    }
  };

  // ---- Avances ----
  const [avancesAbiertos, setAvancesAbiertos] = useState<Tarea | null>(null);
  const [nuevoAvance, setNuevoAvance] = useState("");
  const [guardandoAvance, setGuardandoAvance] = useState(false);

  const abrirAvances = (t: Tarea) => {
    setNuevoAvance("");
    setAvancesAbiertos(t);
  };

  const guardarAvance = async () => {
    if (!avancesAbiertos || !nuevoAvance.trim()) return;
    setGuardandoAvance(true);
    try {
      const res = await fetch("/api/tareas/avance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: avancesAbiertos.id, texto: nuevoAvance.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al guardar el avance.");
      const actualizado = { ...avancesAbiertos, avances: data.avances };
      setAvancesAbiertos(actualizado);
      setTareas((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)));
      setNuevoAvance("");
    } catch (err: any) {
      alert(err.message || "No se pudo guardar el avance.");
    } finally {
      setGuardandoAvance(false);
    }
  };

  // ---- Color / categoria ----
  const [colorAbierto, setColorAbierto] = useState<Tarea | null>(null);
  const [cColor, setCColor] = useState(COLORES_DISPONIBLES[0]);
  const [cCategoria, setCCategoria] = useState("");
  const [guardandoColor, setGuardandoColor] = useState(false);

  const abrirColor = (t: Tarea) => {
    setCColor(t.color || COLORES_DISPONIBLES[0]);
    setCCategoria(t.categoria || "");
    setColorAbierto(t);
  };

  const guardarColor = async () => {
    if (!colorAbierto) return;
    setGuardandoColor(true);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: colorAbierto.id, color: cColor, categoria: cCategoria.trim() }),
      });
      setTareas((prev) => prev.map((t) => (t.id === colorAbierto.id ? { ...t, color: cColor, categoria: cCategoria.trim() } : t)));
      setColorAbierto(null);
    } catch {
      alert("No se pudo guardar la categoría.");
    } finally {
      setGuardandoColor(false);
    }
  };

  const quitarColor = async () => {
    if (!colorAbierto) return;
    setGuardandoColor(true);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: colorAbierto.id, color: " ", categoria: " " }),
      });
      setTareas((prev) => prev.map((t) => (t.id === colorAbierto.id ? { ...t, color: "", categoria: "" } : t)));
      setColorAbierto(null);
    } catch {
      alert("No se pudo quitar la categoría.");
    } finally {
      setGuardandoColor(false);
    }
  };

  // ---- Urgente ----
  const toggleUrgente = async (t: Tarea) => {
    const nuevo = !t.urgente;
    setTareas((prev) => prev.map((x) => (x.id === t.id ? { ...x, urgente: nuevo } : x)));
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id, urgente: nuevo }),
      });
    } catch {
      await cargar();
    }
  };

  // ---- Arrastrar y soltar ----
  // 4 zonas sobre cada tarjeta: izquierda/derecha = acomodar en 2 columnas (ancho mitad); arriba/abajo = ancho completo, apilada.
  const soltarEnColumna = async (colKey: string) => {
    if (arrastrandoId === null) return;
    const id = arrastrandoId;
    const listaCol = tareas.filter((t) => t.estado === colKey && t.id !== id).sort((a, b) => a.orden - b.orden);

    let nuevoOrden: number;
    let nuevoAncho: "full" | "mitad" = "full";
    let idObjetivoPareja: number | null = null;

    if (!sobreInfo || sobreInfo.colKey !== colKey) {
      nuevoOrden = listaCol.length ? listaCol[listaCol.length - 1].orden + 1 : Date.now();
    } else {
      const idx = listaCol.findIndex((t) => t.id === sobreInfo.targetId);
      nuevoAncho = sobreInfo.ancho;
      if (sobreInfo.ancho === "mitad") idObjetivoPareja = sobreInfo.targetId;
      if (idx === -1) {
        nuevoOrden = listaCol.length ? listaCol[listaCol.length - 1].orden + 1 : Date.now();
      } else {
        const objetivo = listaCol[idx];
        if (sobreInfo.posicion === "antes") {
          const anterior = listaCol[idx - 1];
          nuevoOrden = anterior ? (anterior.orden + objetivo.orden) / 2 : objetivo.orden - 1;
        } else {
          const siguiente = listaCol[idx + 1];
          nuevoOrden = siguiente ? (objetivo.orden + siguiente.orden) / 2 : objetivo.orden + 1;
        }
      }
    }

    setTareas((prev) =>
      prev.map((t) => {
        if (t.id === id) return { ...t, estado: colKey, orden: nuevoOrden, ancho: nuevoAncho };
        if (idObjetivoPareja && t.id === idObjetivoPareja) return { ...t, ancho: "mitad" };
        return t;
      })
    );
    setArrastrandoId(null);
    setSobreInfo(null);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, estado: colKey, orden: nuevoOrden, ancho: nuevoAncho }),
      });
      if (idObjetivoPareja) {
        await fetch("/api/tareas/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: idObjetivoPareja, ancho: "mitad" }),
        });
      }
    } catch {
      await cargar();
    }
  };

  // ---- Papelera (archivar tareas sin borrarlas) ----
  const [papeleraAbierta, setPapeleraAbierta] = useState(false);
  const [sobrePapelera, setSobrePapelera] = useState(false);
  const tareasArchivadas = useMemo(() => tareas.filter((t) => t.archivada), [tareas]);

  const archivarTarea = async (id: number) => {
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, archivada: true } : t)));
    setArrastrandoId(null);
    setSobrePapelera(false);
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archivada: true }),
      });
    } catch {
      await cargar();
    }
  };
  const restaurarTarea = async (id: number) => {
    setTareas((prev) => prev.map((t) => (t.id === id ? { ...t, archivada: false } : t)));
    try {
      await fetch("/api/tareas/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, archivada: false }),
      });
    } catch {
      await cargar();
    }
  };
  const vaciarPapelera = async () => {
    if (tareasArchivadas.length === 0) return;
    if (!confirm(`¿Eliminar definitivamente ${tareasArchivadas.length} etiqueta(s) de la papelera? Esta acción no se puede deshacer.`)) return;
    const ids = tareasArchivadas.map((t) => t.id);
    setTareas((prev) => prev.filter((t) => !t.archivada));
    try {
      await Promise.all(ids.map((id) => fetch("/api/tareas/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })));
    } catch {
      await cargar();
    }
  };

  // ---- Gantt ----
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [cargandoGantt, setCargandoGantt] = useState(true);
  const [ganttFormAbierto, setGanttFormAbierto] = useState(false);
  const [ganttEditandoId, setGanttEditandoId] = useState<number | null>(null);
  const [gNombre, setGNombre] = useState("");
  const [gInicio, setGInicio] = useState("");
  const [gFin, setGFin] = useState("");
  const [gResponsable, setGResponsable] = useState("");
  const [gColor, setGColor] = useState(COLORES_GANTT[0]);
  const [guardandoGantt, setGuardandoGantt] = useState(false);

  const cargarGantt = async () => {
    try {
      const res = await fetch("/api/gantt/list", { cache: "no-store" });
      const data = await res.json();
      setActividades(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    } finally {
      setCargandoGantt(false);
    }
  };
  useEffect(() => {
    cargarGantt();
  }, []);
  useRefrescarAlEnfocar(cargarGantt);

  const abrirNuevaActividad = () => {
    setGanttEditandoId(null);
    setGNombre("");
    setGInicio("");
    setGFin("");
    setGResponsable("");
    setGColor(COLORES_GANTT[actividades.length % COLORES_GANTT.length]);
    setGanttFormAbierto(true);
  };
  const abrirEditarActividad = (a: Actividad) => {
    setGanttEditandoId(a.id);
    setGNombre(a.nombre);
    setGInicio(a.fechaInicio);
    setGFin(a.fechaFin);
    setGResponsable(a.responsable);
    setGColor(a.color);
    setGanttFormAbierto(true);
  };
  const guardarActividad = async () => {
    if (!gNombre.trim() || !gInicio || !gFin) {
      alert("Captura el nombre, fecha de inicio y fecha fin.");
      return;
    }
    if (gFin < gInicio) {
      alert("La fecha fin no puede ser anterior a la fecha de inicio.");
      return;
    }
    setGuardandoGantt(true);
    try {
      if (ganttEditandoId !== null) {
        await fetch("/api/gantt/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: ganttEditandoId, nombre: gNombre.trim(), fechaInicio: gInicio, fechaFin: gFin, responsable: gResponsable.trim(), color: gColor }),
        });
      } else {
        await fetch("/api/gantt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nombre: gNombre.trim(), fechaInicio: gInicio, fechaFin: gFin, responsable: gResponsable.trim(), color: gColor }),
        });
      }
      setGanttFormAbierto(false);
      await cargarGantt();
    } catch {
      alert("No se pudo guardar la actividad.");
    } finally {
      setGuardandoGantt(false);
    }
  };
  const eliminarActividad = async (id: number) => {
    if (!confirm("¿Eliminar esta actividad del cronograma?")) return;
    setActividades((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetch("/api/gantt/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargarGantt();
    }
  };
  const guardarAvanceActividad = async (id: number, avance: number) => {
    setActividades((prev) => prev.map((a) => (a.id === id ? { ...a, avance } : a)));
    try {
      await fetch("/api/gantt/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, avance }),
      });
    } catch {
      await cargarGantt();
    }
  };

  // ---- Costos por actividad ----
  const [costos, setCostos] = useState<CostoItem[]>([]);
  const cargarCostos = async () => {
    try {
      const res = await fetch("/api/gantt/costos/list", { cache: "no-store" });
      const data = await res.json();
      setCostos(data.registros || []);
    } catch {
      // se reintenta con el sondeo periodico
    }
  };
  useEffect(() => {
    cargarCostos();
  }, []);
  useRefrescarAlEnfocar(cargarCostos);

  const totalPorActividad = useMemo(() => {
    const mapa: Record<number, number> = {};
    costos.forEach((c) => {
      mapa[c.actividadId] = (mapa[c.actividadId] || 0) + (parseFloat(c.subTotal) || 0);
    });
    return mapa;
  }, [costos]);
  const totalProyecto = useMemo(() => costos.reduce((s, c) => s + (parseFloat(c.subTotal) || 0), 0), [costos]);
  const avanceProyecto = useMemo(() => {
    if (actividades.length === 0) return 0;
    return actividades.reduce((s, a) => s + (a.avance || 0), 0) / actividades.length;
  }, [actividades]);

  const [costosAbiertos, setCostosAbiertos] = useState<Actividad | null>(null);
  const [ccCantidad, setCcCantidad] = useState("");
  const [ccUnidad, setCcUnidad] = useState("");
  const [ccDescripcion, setCcDescripcion] = useState("");
  const [ccSubTotal, setCcSubTotal] = useState("");
  const [ccProveedor, setCcProveedor] = useState("");
  const [guardandoCosto, setGuardandoCosto] = useState(false);
  const costosDeActividad = useMemo(() => costos.filter((c) => c.actividadId === costosAbiertos?.id), [costos, costosAbiertos]);

  const abrirCostos = (a: Actividad) => {
    setCcCantidad("");
    setCcUnidad("");
    setCcDescripcion("");
    setCcSubTotal("");
    setCcProveedor("");
    setCostosAbiertos(a);
  };
  const guardarRegistroCosto = async () => {
    if (!costosAbiertos) return;
    if (!ccDescripcion.trim() || !ccSubTotal) {
      alert("Captura al menos la descripción y el sub total.");
      return;
    }
    setGuardandoCosto(true);
    try {
      await fetch("/api/gantt/costos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actividadId: costosAbiertos.id, cantidad: ccCantidad, unidad: ccUnidad, descripcion: ccDescripcion.trim(), subTotal: ccSubTotal, proveedor: ccProveedor }),
      });
      setCcCantidad("");
      setCcUnidad("");
      setCcDescripcion("");
      setCcSubTotal("");
      setCcProveedor("");
      await cargarCostos();
    } catch {
      alert("No se pudo guardar el registro de costo.");
    } finally {
      setGuardandoCosto(false);
    }
  };
  const eliminarCosto = async (id: number) => {
    if (!confirm("¿Eliminar este registro de costo?")) return;
    setCostos((prev) => prev.filter((c) => c.id !== id));
    try {
      await fetch("/api/gantt/costos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch {
      await cargarCostos();
    }
  };

  const [detallesProyectoAbierto, setDetallesProyectoAbierto] = useState(false);


  const diasGantt = useMemo(() => {
    let inicio: Date, fin: Date;
    const conFechas = actividades.filter((a) => a.fechaInicio && a.fechaFin);
    if (conFechas.length === 0) {
      const hoy = new Date();
      inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    } else {
      const tiempos = conFechas.flatMap((a) => [new Date(`${a.fechaInicio}T00:00:00`).getTime(), new Date(`${a.fechaFin}T00:00:00`).getTime()]);
      inicio = new Date(Math.min(...tiempos));
      fin = new Date(Math.max(...tiempos));
      inicio.setDate(inicio.getDate() - 1);
      fin.setDate(fin.getDate() + 1);
    }
    const arr: Date[] = [];
    const cursor = new Date(inicio);
    while (cursor <= fin) {
      arr.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return arr;
  }, [actividades]);
  const claveDia = (d: Date) => d.toISOString().slice(0, 10);

  // ---- Filtros ----
  const [filtroResponsable, setFiltroResponsable] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const responsablesUnicos = useMemo(() => Array.from(new Set(tareas.map((t) => t.responsable).filter(Boolean))).sort(), [tareas]);
  const categoriasUnicas = useMemo(() => Array.from(new Set(tareas.map((t) => t.categoria).filter(Boolean))).sort(), [tareas]);

  const tareasFiltradas = useMemo(() => {
    return tareas.filter((t) => {
      if (filtroResponsable && t.responsable !== filtroResponsable) return false;
      if (filtroCategoria && t.categoria !== filtroCategoria) return false;
      return true;
    });
  }, [tareas, filtroResponsable, filtroCategoria]);

  // ---- Badges de resumen ----
  const totalPendientes = useMemo(() => tareas.filter((t) => t.estado !== "completadas").length, [tareas]);
  const responsablesPendientes = useMemo(() => {
    const mapa: Record<string, number> = {};
    tareas.forEach((t) => {
      if (t.estado === "completadas" || !t.responsable) return;
      mapa[t.responsable] = (mapa[t.responsable] || 0) + 1;
    });
    return mapa;
  }, [tareas]);
  const avanceGeneral = useMemo(() => {
    if (tareas.length === 0) return 0;
    const completadas = tareas.filter((t) => t.estado === "completadas").length;
    return (completadas / tareas.length) * 100;
  }, [tareas]);

  // ---- Manejo de fondos ----
  const [fondoSeleccionado, setFondoSeleccionado] = useState("");
  const gastosFiltradosPorFondo = useMemo(
    () => (fondoSeleccionado ? todosLosGastos.filter((g) => g.fondo === fondoSeleccionado) : todosLosGastos),
    [todosLosGastos, fondoSeleccionado]
  );
  const [modalGastosPorCategoria, setModalGastosPorCategoria] = useState(false);
  const [modalArqueo, setModalArqueo] = useState(false);
  const [ajusteFondo, setAjusteFondo] = useState(FONDOS[0]);
  const [ajusteMonto, setAjusteMonto] = useState("");
  const [ajusteDescripcion, setAjusteDescripcion] = useState("");
  const [guardandoAjuste, setGuardandoAjuste] = useState(false);
  const guardarAjusteFondo = async () => {
    if (!ajusteMonto) {
      alert("Captura el monto del ajuste.");
      return;
    }
    setGuardandoAjuste(true);
    try {
      await fetch("/api/tareas/gastos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tareaId: null,
          tareaNombre: "Arqueo / ajuste de fondo",
          cantidad: "1",
          descripcion: ajusteDescripcion || "Ajuste de fondo",
          monto: ajusteMonto,
          tipoTransaccion: "Ajuste",
          referencia: "",
          fondo: ajusteFondo,
        }),
      });
      setAjusteMonto("");
      setAjusteDescripcion("");
      await cargarGastosTareas();
      alert("Ajuste registrado correctamente.");
    } catch {
      alert("No se pudo registrar el ajuste.");
    } finally {
      setGuardandoAjuste(false);
    }
  };
  const totalPorFondo = useMemo(() => {
    const mapa: Record<string, number> = {};
    FONDOS.forEach((f) => (mapa[f] = 0));
    todosLosGastos.forEach((g) => {
      if (g.fondo) mapa[g.fondo] = (mapa[g.fondo] || 0) + (parseFloat(g.monto) || 0);
    });
    return mapa;
  }, [todosLosGastos]);
  const gastosPorCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    todosLosGastos.forEach((g) => {
      const cat = g.tipoTransaccion || "Sin categoría";
      mapa[cat] = (mapa[cat] || 0) + (parseFloat(g.monto) || 0);
    });
    return mapa;
  }, [todosLosGastos]);

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Plan de trabajo y seguimiento"
          subtitulo="Crea, asigna y da seguimiento a los planes de trabajo."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-4">
          <button
            type="button"
            onClick={() => setVistaActiva("fondos")}
            className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${vistaActiva === "fondos" ? "bg-[var(--green)] text-white" : "bg-white border border-[var(--green)] text-[var(--green)]"}`}
          >
            Manejo de Fondos
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva("kanban")}
            className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${vistaActiva === "kanban" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
          >
            KANBAN
          </button>
          <button
            type="button"
            onClick={() => setVistaActiva("gantt")}
            className={`text-[13px] font-bold px-5 py-2.5 rounded-lg ${vistaActiva === "gantt" ? "bg-[var(--navy)] text-white" : "bg-white border border-[var(--gray-200)] text-[var(--navy)]"}`}
          >
            CRONOGRAMA GANTT
          </button>
        </div>

        {vistaActiva === "kanban" && (
        <div className="flex flex-wrap gap-2.5 md:gap-3 mb-5">
          <button type="button" onClick={abrirForm} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
            Nueva tarea
          </button>
        </div>
        )}

        {vistaActiva === "kanban" && (
        <>
        {/* Responsables con tareas pendientes — integrado, sin recuadro */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)]">Responsables con pendientes:</span>
          {Object.keys(responsablesPendientes).length === 0 && <span className="text-[12px] text-[var(--gray-400)]">Sin pendientes.</span>}
          {Object.entries(responsablesPendientes).map(([r, n]) => (
            <button
              key={r}
              type="button"
              onClick={() => setFiltroResponsable((prev) => (prev === r ? "" : r))}
              className="text-white text-[11.5px] font-bold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: filtroResponsable === r ? "var(--navy)" : AZUL_ELECTRICO }}
            >
              {r} ({n})
            </button>
          ))}
        </div>

        {/* 2 recuadros iguales: avance general y gastos por dia */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-5">
          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 h-[300px] flex flex-col">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1">Tareas pendientes</p>
            <div className="flex items-end gap-3 mb-3">
              <p className="text-[30px] font-bold text-[var(--navy)] m-0 leading-none">{totalPendientes}</p>
              <p className="text-[12.5px] text-[var(--gray-400)] mb-0.5">de {tareas.length} totales · {avanceGeneral.toFixed(0)}% completado</p>
            </div>
            <div className="flex-1 flex items-end gap-4 justify-around px-2 pb-1">
              {COLUMNAS.map((c) => {
                const n = tareas.filter((t) => t.estado === c.key).length;
                const max = Math.max(1, ...COLUMNAS.map((cc) => tareas.filter((t) => t.estado === cc.key).length));
                const alturaPct = (n / max) * 100;
                return (
                  <div key={c.key} className="flex flex-col items-center gap-1.5 flex-1">
                    <span className="text-[11px] font-bold text-[var(--navy)]">{n}</span>
                    <div className="w-full max-w-[46px] bg-[var(--gray-100)] rounded-md relative" style={{ height: "120px" }}>
                      <div
                        className="absolute bottom-0 left-0 right-0 rounded-md"
                        style={{ height: `${Math.max(4, alturaPct)}%`, backgroundColor: c.key === "completadas" ? "var(--green)" : AZUL_ELECTRICO }}
                      />
                    </div>
                    <span className="text-[9.5px] text-[var(--gray-400)] text-center leading-tight">{c.titulo}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 h-[300px] flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Gastos por Día</p>
              <select value={fondoSeleccionado} onChange={(e) => setFondoSeleccionado(e.target.value)} className="text-[11px] font-bold border border-[var(--gray-200)] rounded-md px-2 py-1 bg-white">
                <option value="">Todos los fondos</option>
                {FONDOS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1 min-h-0">
              <GraficaGastosPorDia gastos={gastosFiltradosPorFondo} />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <button type="button" onClick={() => setVistaActiva("fondos")} className="text-[10px] font-bold text-white rounded-full px-2.5 py-1" style={{ backgroundColor: AZUL_ELECTRICO }}>
                Detalles de movimientos
              </button>
              <button type="button" onClick={() => setModalGastosPorCategoria(true)} className="text-[10px] font-bold text-white rounded-full px-2.5 py-1" style={{ backgroundColor: AZUL_ELECTRICO }}>
                Gastos por categoría
              </button>
              <button type="button" onClick={() => setModalArqueo(true)} className="text-[10px] font-bold text-white rounded-full px-2.5 py-1" style={{ backgroundColor: AZUL_ELECTRICO }}>
                Arqueo y ajuste de fondos
              </button>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap items-end gap-2.5 mb-5">
          <div>
            <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Responsable</label>
            <select value={filtroResponsable} onChange={(e) => setFiltroResponsable(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px] bg-white">
              <option value="">Todos</option>
              {responsablesUnicos.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10.5px] font-bold text-[var(--gray-400)] uppercase mb-1">Color / Categoría</label>
            <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} className="border border-[var(--gray-200)] rounded-md px-2.5 py-1.5 text-[12px] bg-white">
              <option value="">Todas</option>
              {categoriasUnicas.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {(filtroResponsable || filtroCategoria) && (
            <button
              type="button"
              onClick={() => {
                setFiltroResponsable("");
                setFiltroCategoria("");
              }}
              className="text-[11.5px] text-[var(--red)] font-semibold px-2 py-1.5"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {cargando ? (
          <p className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando tablero...</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {COLUMNAS.map((col) => {
              const tareasCol = tareasFiltradas.filter((t) => t.estado === col.key && !t.archivada).sort((a, b) => a.orden - b.orden);
              return (
                <div
                  key={col.key}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => soltarEnColumna(col.key)}
                  className="bg-[#767b87] rounded-2xl p-3.5 md:p-4 min-h-[320px]"
                >
                  <div className="bg-white rounded-full px-4 py-2 mb-4 text-center">
                    <span className="text-[13px] font-bold text-[var(--navy)]">{col.titulo}</span>
                    <span className="text-[11px] text-[var(--gray-400)] ml-1.5">({tareasCol.length})</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-start">
                    {tareasCol.map((t) => {
                      const estiloFondo = t.urgente ? { backgroundColor: "rgba(226,65,44,0.95)" } : t.color ? { backgroundColor: `${t.color}f2` } : undefined;
                      const zona = sobreInfo && sobreInfo.targetId === t.id ? sobreInfo : null;
                      const estiloZona: CSSProperties = {};
                      if (zona) {
                        const grosor = "3px solid var(--blue)";
                        if (zona.posicion === "antes" && zona.ancho === "mitad") estiloZona.borderLeft = grosor;
                        else if (zona.posicion === "despues" && zona.ancho === "mitad") estiloZona.borderRight = grosor;
                        else if (zona.posicion === "antes" && zona.ancho === "full") estiloZona.borderTop = grosor;
                        else estiloZona.borderBottom = grosor;
                      }
                      const expandida = tarjetasExpandidas.has(t.id);
                      const progreso = progresoSublista(t.id);
                      const puntosSublista = sublistas.filter((s) => s.tareaId === t.id);
                      return (
                        <div
                          key={t.id}
                          draggable
                          onDragStart={() => setArrastrandoId(t.id)}
                          onDragEnd={() => {
                            setArrastrandoId(null);
                            setSobreInfo(null);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            const relX = (e.clientX - rect.left) / rect.width;
                            const relY = e.clientY - rect.top;
                            let posicion: "antes" | "despues";
                            let ancho: "full" | "mitad";
                            if (relX < 0.3) {
                              posicion = "antes";
                              ancho = "mitad";
                            } else if (relX > 0.7) {
                              posicion = "despues";
                              ancho = "mitad";
                            } else if (relY < rect.height / 2) {
                              posicion = "antes";
                              ancho = "full";
                            } else {
                              posicion = "despues";
                              ancho = "full";
                            }
                            setSobreInfo({ colKey: col.key, targetId: t.id, posicion, ancho });
                          }}
                          onDrop={(e) => {
                            e.stopPropagation();
                            soltarEnColumna(col.key);
                          }}
                          style={{ ...estiloFondo, ...estiloZona, gridColumn: t.ancho === "mitad" ? "span 1" : "span 2" }}
                          className={`bg-white border-2 ${t.urgente ? "border-[var(--red)]" : "border-[var(--navy)]"} rounded-2xl p-3 cursor-grab active:cursor-grabbing`}
                        >
                          <div className="flex items-start justify-between gap-1.5 mb-1.5">
                            <span onClick={() => abrirEditarTarea(t)} className="text-[var(--gray-400)] cursor-pointer shrink-0" title="Editar tarea">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                            </span>
                            <div className="flex-1">
                              {t.urgente && <span className="inline-block bg-[var(--red)] text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-1">Urgente</span>}
                              {!t.urgente && t.categoria && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full mb-1" style={{ backgroundColor: `${t.color}22`, color: t.color }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                                  {t.categoria}
                                </span>
                              )}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[13px] font-normal text-[var(--navy)] m-0 leading-snug">{t.tarea}</p>
                                {progreso && (
                                  <span className="text-[9.5px] font-bold text-[var(--blue)] bg-[var(--blue-light)] rounded-full px-1.5 py-0.5 whitespace-nowrap shrink-0">
                                    {progreso.marcados}/{progreso.total} ({progreso.porcentaje}%)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1.5 shrink-0">
                              <span onClick={() => eliminarTarea(t.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar tarea">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </span>
                              <span onClick={() => toggleUrgente(t)} className={t.urgente ? "text-[var(--red)]" : "text-[var(--gray-400)]"} title="Marcar como urgente">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill={t.urgente ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><path d="M12 9v4M12 17h.01" /></svg>
                              </span>
                              <span onClick={() => abrirColor(t)} className="cursor-pointer" title="Color / categoría">
                                <span className="block w-3.5 h-3.5 rounded-full border border-[var(--gray-200)]" style={{ backgroundColor: t.color || "#e5e8ee" }} />
                              </span>
                              <span onClick={() => toggleExpandida(t.id)} className="text-[var(--gray-400)] cursor-pointer" title={expandida ? "Contraer" : "Expandir"}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ transform: expandida ? "rotate(180deg)" : undefined }}><path d="M6 9l6 6 6-6" /></svg>
                              </span>
                            </div>
                          </div>
                          <div className="bg-[var(--navy)] rounded-full px-3 py-1.5 flex items-center justify-between gap-2 mb-2">
                            <span className="text-white text-[11px] font-normal truncate">{t.responsable || "—"}</span>
                            <span className="bg-[var(--gray-400)] text-white text-[9.5px] rounded-full px-2 py-0.5 whitespace-nowrap">{formatearFecha(t.fechaEntrega)}</span>
                          </div>

                          {expandida && (
                            <div className="mb-2 bg-black/5 rounded-xl p-2.5">
                              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--navy)]/70 m-0 mb-1.5">Sub-lista</p>
                              <div className="flex flex-col gap-1 mb-2">
                                {puntosSublista.map((p) => (
                                  <div key={p.id} className="flex items-center gap-1.5">
                                    <span onClick={() => toggleMarcadoSublista(p)} className="cursor-pointer shrink-0">
                                      {p.marcado ? (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--green)" stroke="var(--green)" strokeWidth="2"><circle cx="12" cy="12" r="10" fill="none" /><path d="M8 12l3 3 5-6" stroke="white" fill="none" strokeWidth="2.3" /></svg>
                                      ) : (
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /></svg>
                                      )}
                                    </span>
                                    <span className={`text-[11.5px] flex-1 ${p.marcado ? "line-through text-[var(--navy)]/50" : "text-[var(--navy)]"}`}>{p.texto}</span>
                                    <span onClick={() => eliminarPuntoSublista(p.id)} className="text-[var(--red)] cursor-pointer shrink-0" title="Eliminar punto">
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  value={nuevoPuntoSublista[t.id] || ""}
                                  onChange={(e) => setNuevoPuntoSublista((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                  onKeyDown={(e) => e.key === "Enter" && agregarPuntoSublista(t.id)}
                                  placeholder="+ agregar punto..."
                                  className="flex-1 border border-[var(--gray-200)] bg-white rounded-md px-2 py-1 text-[11px]"
                                />
                              </div>

                              <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-black/10">
                                <span onClick={() => abrirDocumentos(t)} className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--navy)] cursor-pointer" title="Documentos">
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                                  Documentos{t.documentosCount > 0 ? ` (${t.documentosCount})` : ""}
                                </span>
                                {t.fotosCount > 0 && (
                                  <span onClick={() => abrirEditarTarea(t)} className="flex items-center gap-1 text-[10.5px] font-bold text-[var(--navy)] cursor-pointer" title="Fotos">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                                    Fotos ({t.fotosCount})
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => abrirGastosPorTarea(t)}
                                className="w-full flex items-center justify-center gap-1.5 text-[10.5px] font-semibold text-white bg-[var(--navy)] rounded-full py-1.5 mt-2"
                              >
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>
                                Requerimientos / Gastos{todosLosGastos.filter((g) => g.tareaId === t.id).length > 0 ? ` (${todosLosGastos.filter((g) => g.tareaId === t.id).length})` : ""}
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => abrirAvances(t)}
                            className="w-full flex items-center justify-center gap-1.5 text-[11px] font-semibold text-[var(--blue)] border border-[var(--blue-light)] bg-[var(--blue-light)] rounded-full py-1.5"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
                            Avances{t.avances?.length > 0 ? ` (${t.avances.length})` : ""}
                          </button>
                        </div>
                      );
                    })}
                    {tareasCol.length === 0 && <p className="text-center text-white/70 text-[12px] py-6 col-span-2">Sin tareas.</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Bote de basura discreto: arrastra una etiqueta aquí para quitarla del tablero sin borrarla */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setSobrePapelera(true);
          }}
          onDragLeave={() => setSobrePapelera(false)}
          onDrop={() => arrastrandoId !== null && archivarTarea(arrastrandoId)}
          onClick={() => setPapeleraAbierta(true)}
          title="Arrastra una etiqueta aquí para quitarla del tablero · clic para ver la papelera"
          className={`fixed bottom-6 right-6 w-12 h-12 rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-colors z-40 ${
            sobrePapelera ? "bg-[var(--red)]" : "bg-[var(--navy)]"
          }`}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
          {tareasArchivadas.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-[var(--red)] text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{tareasArchivadas.length}</span>
          )}
        </div>
        </>
        )}

        {vistaActiva === "fondos" && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {FONDOS.map((f) => (
              <div key={f} className="bg-white rounded-2xl border border-[var(--gray-200)] p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1">{f}</p>
                <p className="text-[19px] font-bold text-[var(--navy)] m-0">${(totalPorFondo[f] || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2.5 mb-5">
            <button type="button" onClick={() => setModalGastosPorCategoria(true)} className="text-[12.5px] font-bold text-white rounded-full px-4 py-2" style={{ backgroundColor: AZUL_ELECTRICO }}>
              Gastos por categoría
            </button>
            <button type="button" onClick={() => setModalArqueo(true)} className="text-[12.5px] font-bold text-white rounded-full px-4 py-2" style={{ backgroundColor: AZUL_ELECTRICO }}>
              Arqueo y ajuste de fondos
            </button>
          </div>

          <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[14.5px] font-bold text-[var(--navy)] m-0 mb-4">Detalles de movimientos</h3>
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Fecha", "Tarea", "Cantidad", "Descripción", "Monto", "Tipo", "Referencia", "Fondo", ""].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todosLosGastos.map((g) => (
                    <tr key={g.id} className="border-b border-[var(--gray-200)]">
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{g.fecha}</td>
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{g.tareaNombre || "—"}</td>
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{g.cantidad || "—"}</td>
                      <td className="px-2.5 py-2 text-[12px]">{g.descripcion}</td>
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">${(parseFloat(g.monto) || 0).toFixed(2)}</td>
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{g.tipoTransaccion}</td>
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{g.referencia || "—"}</td>
                      <td className="px-2.5 py-2 text-[12px] whitespace-nowrap">{g.fondo || "—"}</td>
                      <td className="px-2.5 py-2 whitespace-nowrap">
                        <span onClick={() => eliminarGastoTarea(g.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {todosLosGastos.length === 0 && <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin movimientos registrados aún.</p>}
            </div>
          </div>
        </div>
        )}

        {vistaActiva === "gantt" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-4 items-center bg-white rounded-2xl border border-[var(--gray-200)] p-4 sm:p-5 mb-5">
            <div className="flex items-center gap-3 justify-center sm:justify-start">
              <svg width="86" height="86" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e8ee" strokeWidth="11" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#2f6fed"
                  strokeWidth="11"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 40 * (avanceProyecto / 100)} ${2 * Math.PI * 40}`}
                  transform="rotate(-90 50 50)"
                />
                <text x="50" y="56" textAnchor="middle" fontSize="21" fontWeight="bold" fill="#16215c">
                  {avanceProyecto.toFixed(0)}%
                </text>
              </svg>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0">Avance del proyecto</p>
                <p className="text-[12.5px] text-[var(--navy)] m-0">{actividades.length} actividad(es)</p>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--gray-400)] m-0 mb-1">Costo total del proyecto</p>
              <p className="text-[30px] md:text-[36px] font-bold text-[var(--navy)] m-0 leading-none">${totalProyecto.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={() => setDetallesProyectoAbierto(true)}
              className="flex items-center gap-1.5 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold justify-self-center sm:justify-self-end"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6M9 13h6M9 17h6" /></svg>
              Detalles del proyecto
            </button>
          </div>

          <div className="flex flex-wrap gap-2.5 mb-5">
            <button type="button" onClick={abrirNuevaActividad} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
              + Agregar actividad
            </button>
          </div>
          <div className="bg-white rounded-[18px] p-4 sm:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            {cargandoGantt ? (
              <p className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Cargando cronograma...</p>
            ) : actividades.length === 0 ? (
              <p className="text-center text-[var(--gray-400)] text-[13.5px] py-10">Sin actividades. Usa &quot;+ Agregar actividad&quot; para comenzar.</p>
            ) : (
              <div className="overflow-x-auto">
                <div style={{ minWidth: 80 + 190 + 90 + diasGantt.length * 30 }}>
                  <div className="flex sticky top-0 z-10">
                    <div className="w-[80px] shrink-0 bg-[var(--navy)] text-white text-[9px] font-bold flex items-center justify-center px-1.5 py-2.5 rounded-tl-lg text-center">
                      % Avance
                    </div>
                    <div className="w-[190px] shrink-0 bg-[var(--navy)] text-white text-[10px] font-bold flex items-center px-3 py-2.5">
                      Actividad / Responsable
                    </div>
                    <div className="w-[90px] shrink-0 bg-[var(--navy)] text-white text-[10px] font-bold flex items-center justify-center px-2 py-2.5">
                      Costos
                    </div>
                    {diasGantt.map((d, i) => (
                      <div
                        key={i}
                        className="w-[30px] shrink-0 text-center text-[9px] font-bold text-white bg-[var(--navy)] border-l border-white/15 py-1"
                      >
                        <div className="opacity-70 text-[7.5px] leading-tight">{d.toLocaleDateString("es-MX", { weekday: "short" }).slice(0, 2)}</div>
                        <div>{d.getDate()}</div>
                      </div>
                    ))}
                  </div>
                  {actividades.map((a) => {
                    const idxInicio = diasGantt.findIndex((d) => claveDia(d) === a.fechaInicio);
                    const idxFin = diasGantt.findIndex((d) => claveDia(d) === a.fechaFin);
                    const anchoBarra = idxInicio >= 0 && idxFin >= 0 ? (idxFin - idxInicio + 1) * 30 - 4 : 0;
                    return (
                      <div key={a.id} className="flex items-center border-b border-[var(--gray-200)] group">
                        <div className="w-[80px] shrink-0 px-1.5 py-2.5 flex justify-center">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={a.avance}
                            onBlur={(e) => {
                              const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                              guardarAvanceActividad(a.id, v);
                            }}
                            className="w-[52px] text-center border border-[var(--gray-200)] rounded px-1 py-1 text-[11px]"
                          />
                        </div>
                        <div className="w-[190px] shrink-0 px-3 py-2.5">
                          <p className="text-[11.5px] font-bold text-[var(--navy)] m-0 truncate">{a.nombre}</p>
                          <div className="flex items-center justify-between gap-1">
                            <p className="text-[10px] text-[var(--gray-400)] m-0 truncate">{a.responsable || "—"}</p>
                            <div className="hidden group-hover:flex gap-1.5 shrink-0">
                              <span onClick={() => abrirEditarActividad(a)} className="text-[var(--gray-400)] cursor-pointer" title="Editar">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" /></svg>
                              </span>
                              <span onClick={() => eliminarActividad(a.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-[90px] shrink-0 flex items-center justify-center gap-1.5 px-2 py-2.5">
                          <span className="text-[10.5px] font-bold text-[var(--navy)] truncate">${(totalPorActividad[a.id] || 0).toFixed(0)}</span>
                          <span onClick={() => abrirCostos(a)} className="text-[var(--blue)] cursor-pointer shrink-0" title="Detalles de costo">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
                          </span>
                        </div>
                        <div className="relative h-9" style={{ width: diasGantt.length * 30 }}>
                          {idxInicio >= 0 && idxFin >= 0 && (
                            <div
                              onClick={() => abrirEditarActividad(a)}
                              className="absolute h-5 top-2 rounded-full cursor-pointer bg-[var(--gray-200)] overflow-hidden"
                              style={{ left: idxInicio * 30 + 2, width: anchoBarra }}
                              title={`${a.nombre} · ${formatearFecha(a.fechaInicio)} - ${formatearFecha(a.fechaFin)} · ${a.avance || 0}% avance`}
                            >
                              <div className="h-full rounded-full bg-[var(--blue)]" style={{ width: `${Math.min(100, a.avance || 0)}%` }} />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        <PageFooter />
      </div>

      {formAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">{editandoId !== null ? "Editar tarea" : "Nueva tarea"}</h3>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Tarea</label>
              <textarea value={fTarea} onChange={(e) => setFTarea(e.target.value)} rows={2} placeholder="Describe la tarea" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Responsable</label>
              <input value={fResponsable} onChange={(e) => setFResponsable(e.target.value)} placeholder="Nombre del responsable" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fecha de entrega</label>
              <input type="date" value={fFecha} onChange={(e) => setFFecha(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-2">Fotos</label>
              <div className="flex flex-col gap-2.5">
                {fFotos.map((f, i) => (
                  <div key={i} className="flex gap-2.5 items-start border border-[var(--gray-200)] rounded-lg p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.foto} alt={`Foto ${i + 1}`} className="w-14 h-14 rounded-md object-cover shrink-0" />
                    <input
                      value={f.descripcion}
                      onChange={(e) => setFFotos((prev) => prev.map((ff, idx) => (idx === i ? { ...ff, descripcion: e.target.value } : ff)))}
                      placeholder="Descripción..."
                      className="flex-1 border border-[var(--gray-200)] rounded-md px-2 py-1.5 text-[12px]"
                    />
                    <span onClick={() => setFFotos((prev) => prev.filter((_, idx) => idx !== i))} className="text-[var(--red)] cursor-pointer shrink-0 mt-1" title="Quitar foto">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </span>
                  </div>
                ))}
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--gray-200)] rounded-lg py-2.5 cursor-pointer text-[var(--navy)]">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                  <span className="text-[12px] font-bold">Tomar / agregar foto</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || []);
                      const nuevas: FotoDesc[] = [];
                      for (const file of files) {
                        try {
                          nuevas.push({ foto: await compressImage(file), descripcion: "" });
                        } catch {
                          // se omite si falla la compresion
                        }
                      }
                      setFFotos((prev) => [...prev, ...nuevas]);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setFormAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardar} disabled={guardando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {colorAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[400px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Color / Categoría</h3>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORES_DISPONIBLES.map((c) => (
                  <span
                    key={c}
                    onClick={() => setCColor(c)}
                    className={`w-7 h-7 rounded-full cursor-pointer ${cColor === c ? "ring-2 ring-offset-2 ring-[var(--navy)]" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Descripción de la categoría</label>
              <input value={cCategoria} onChange={(e) => setCCategoria(e.target.value)} placeholder="Ej. Administrativo, Urgente cliente..." className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setColorAbierto(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              {colorAbierto.categoria && (
                <button type="button" onClick={quitarColor} disabled={guardandoColor} className="bg-white text-[var(--red)] border border-[var(--red)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Quitar
                </button>
              )}
              <button type="button" onClick={guardarColor} disabled={guardandoColor} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoColor ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {avancesAbiertos && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[480px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-1">Avances</h3>
            <p className="text-[13px] text-[var(--gray-400)] mb-4">{avancesAbiertos.tarea}</p>

            <div className="flex flex-col gap-2.5 mb-5 max-h-[280px] overflow-y-auto">
              {(avancesAbiertos.avances || []).length === 0 && <p className="text-[12.5px] text-[var(--gray-400)]">Aún no hay avances registrados.</p>}
              {[...(avancesAbiertos.avances || [])].reverse().map((a, i) => (
                <div key={i} className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5">
                  <p className="text-[12.5px] text-[var(--text)] m-0 mb-1 whitespace-pre-wrap">{a.texto}</p>
                  <p className="text-[10.5px] text-[var(--gray-400)] m-0">{new Date(a.fecha).toLocaleString("es-MX")}</p>
                </div>
              ))}
            </div>

            <div className="mb-5">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Agregar avance</label>
              <textarea value={nuevoAvance} onChange={(e) => setNuevoAvance(e.target.value)} rows={2} placeholder="Describe el avance" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>

            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setAvancesAbiertos(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarAvance} disabled={guardandoAvance || !nuevoAvance.trim()} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoAvance ? "Guardando..." : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {ganttFormAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">{ganttEditandoId !== null ? "Editar actividad" : "Nueva actividad"}</h3>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Actividad</label>
              <input value={gNombre} onChange={(e) => setGNombre(e.target.value)} placeholder="Nombre de la actividad" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fecha inicio</label>
                <input type="date" value={gInicio} onChange={(e) => setGInicio(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Fecha fin</label>
                <input type="date" value={gFin} onChange={(e) => setGFin(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Responsable</label>
              <input value={gResponsable} onChange={(e) => setGResponsable(e.target.value)} placeholder="Nombre del responsable" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13.5px]" />
            </div>
            <div className="mb-6">
              <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-2">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLORES_GANTT.map((c) => (
                  <span
                    key={c}
                    onClick={() => setGColor(c)}
                    className={`w-7 h-7 rounded-full cursor-pointer ${gColor === c ? "ring-2 ring-offset-2 ring-[var(--navy)]" : ""}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setGanttFormAbierto(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarActividad} disabled={guardandoGantt} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoGantt ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {papeleraAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">Papelera</h3>
              <span onClick={() => setPapeleraAbierta(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            {tareasArchivadas.length === 0 ? (
              <p className="text-[13px] text-[var(--gray-400)] mb-2">La papelera está vacía.</p>
            ) : (
              <div className="flex flex-col gap-2.5 mb-5">
                {tareasArchivadas.map((t) => (
                  <div key={t.id} className="border border-[var(--gray-200)] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                    <p className="text-[12.5px] text-[var(--navy)] m-0 truncate">{t.tarea}</p>
                    <button type="button" onClick={() => restaurarTarea(t.id)} className="text-[11px] font-bold text-[var(--blue)] whitespace-nowrap shrink-0">
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setPapeleraAbierta(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button
                type="button"
                onClick={vaciarPapelera}
                disabled={tareasArchivadas.length === 0}
                className="bg-[var(--red)] disabled:opacity-50 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
              >
                Vaciar papelera
              </button>
            </div>
          </div>
        </div>
      )}

      {costosAbiertos && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[560px] max-w-[94%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">Costos — {costosAbiertos.nombre}</h3>
              <span onClick={() => setCostosAbiertos(null)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[13px] text-[var(--gray-400)] mb-4">
              Total: <span className="font-bold text-[var(--navy)]">${(totalPorActividad[costosAbiertos.id] || 0).toFixed(2)}</span>
            </p>

            <div className="flex flex-col gap-2.5 mb-5 max-h-[220px] overflow-y-auto">
              {costosDeActividad.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)]">Aún no hay registros de costo.</p>}
              {costosDeActividad.map((c) => (
                <div key={c.id} className="bg-[var(--gray-100)] rounded-lg px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-semibold text-[var(--navy)] m-0 truncate">{c.descripcion}</p>
                    <p className="text-[10.5px] text-[var(--gray-400)] m-0 truncate">
                      {c.cantidad || "—"} {c.unidad} {c.proveedor ? `· ${c.proveedor}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[12.5px] font-bold text-[var(--navy)]">${(parseFloat(c.subTotal) || 0).toFixed(2)}</span>
                    <span onClick={() => eliminarCosto(c.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[12.5px] font-bold text-[var(--navy)] mb-2.5">Agregar registro de costo</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Cantidad</label>
                <input type="number" value={ccCantidad} onChange={(e) => setCcCantidad(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Unidad</label>
                <input value={ccUnidad} onChange={(e) => setCcUnidad(e.target.value)} placeholder="Pza, kg, servicio..." className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Descripción</label>
              <input value={ccDescripcion} onChange={(e) => setCcDescripcion(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
            </div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Sub total</label>
                <input type="number" value={ccSubTotal} onChange={(e) => setCcSubTotal(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Proveedor</label>
                <input value={ccProveedor} onChange={(e) => setCcProveedor(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setCostosAbiertos(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarRegistroCosto} disabled={guardandoCosto} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoCosto ? "Guardando..." : "Guardar registro"}
              </button>
            </div>
          </div>
        </div>
      )}

      {detallesProyectoAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[680px] max-w-[95%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">Detalles del proyecto</h3>
              <span onClick={() => setDetallesProyectoAbierto(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[13px] text-[var(--gray-400)] mb-4">
              Costo total: <span className="font-bold text-[var(--navy)]">${totalProyecto.toFixed(2)}</span>
            </p>
            <div className="overflow-x-auto">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Actividad", "Cantidad", "Unidad", "Descripción", "Sub total", "Proveedor"].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2.5 py-2 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {costos.map((c) => {
                    const act = actividades.find((a) => a.id === c.actividadId);
                    return (
                      <tr key={c.id} className="border-b border-[var(--gray-200)]">
                        <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap font-semibold text-[var(--navy)]">{act?.nombre || "—"}</td>
                        <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{c.cantidad || "—"}</td>
                        <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{c.unidad || "—"}</td>
                        <td className="px-2.5 py-2 text-[12.5px]">{c.descripcion || "—"}</td>
                        <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">${(parseFloat(c.subTotal) || 0).toFixed(2)}</td>
                        <td className="px-2.5 py-2 text-[12.5px] whitespace-nowrap">{c.proveedor || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {costos.length === 0 && <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Sin registros de costo aún.</p>}
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setDetallesProyectoAbierto(false)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {documentosAbiertos && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[460px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Documentos</h3>
              <span onClick={() => setDocumentosAbiertos(null)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">{documentosAbiertos.tarea}</p>
            <div className="flex flex-col gap-2 mb-4">
              {docsLocal.length === 0 && <p className="text-[12.5px] text-[var(--gray-400)]">Aún no hay documentos adjuntos.</p>}
              {docsLocal.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-2 border border-[var(--gray-200)] rounded-lg px-3 py-2.5">
                  <a href={d.dataUrl} download={d.nombre} className="flex items-center gap-2 text-[12.5px] text-[var(--navy)] no-underline truncate">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2" className="shrink-0"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" /></svg>
                    <span className="truncate">{d.nombre}</span>
                  </a>
                  <span onClick={() => quitarDocumento(i)} className="text-[var(--red)] cursor-pointer shrink-0" title="Quitar">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                  </span>
                </div>
              ))}
              <label className="flex items-center justify-center gap-2 border-2 border-dashed border-[var(--gray-200)] rounded-lg py-3 cursor-pointer text-[var(--navy)]">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>
                <span className="text-[12.5px] font-bold">Agregar documento</span>
                <input type="file" multiple onChange={agregarDocumentos} className="hidden" />
              </label>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setDocumentosAbiertos(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarDocumentos} disabled={guardandoDocs} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoDocs ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {gastosPorTareaAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[640px] max-w-[95%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Requerimientos / Gastos</h3>
              <span onClick={() => setGastosPorTareaAbierto(null)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">{gastosPorTareaAbierto.tarea}</p>

            <div className="overflow-x-auto mb-4">
              <table className="border-collapse min-w-max w-full">
                <thead>
                  <tr>
                    {["Cantidad", "Descripción", "Monto", "Tipo de transacción", "Referencia", "Fondo", ""].map((c) => (
                      <th key={c} className="text-left text-[10px] uppercase tracking-wide text-white bg-[var(--navy)] px-2 py-1.5 whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todosLosGastos
                    .filter((g) => g.tareaId === gastosPorTareaAbierto.id)
                    .map((g) => (
                      <tr key={g.id} className="border-b border-[var(--gray-200)]">
                        <td className="px-2 py-1.5 text-[12px] whitespace-nowrap">{g.cantidad || "—"}</td>
                        <td className="px-2 py-1.5 text-[12px]">{g.descripcion}</td>
                        <td className="px-2 py-1.5 text-[12px] whitespace-nowrap">${(parseFloat(g.monto) || 0).toFixed(2)}</td>
                        <td className="px-2 py-1.5 text-[12px] whitespace-nowrap">{g.tipoTransaccion}</td>
                        <td className="px-2 py-1.5 text-[12px] whitespace-nowrap">{g.referencia || "—"}</td>
                        <td className="px-2 py-1.5 text-[12px] whitespace-nowrap">{g.fondo || "—"}</td>
                        <td className="px-2 py-1.5 whitespace-nowrap">
                          <span onClick={() => eliminarGastoTarea(g.id)} className="text-[var(--red)] cursor-pointer" title="Eliminar">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {todosLosGastos.filter((g) => g.tareaId === gastosPorTareaAbierto.id).length === 0 && (
                <p className="text-center text-[var(--gray-400)] text-[12.5px] py-4">Sin registros aún.</p>
              )}
            </div>

            <p className="text-[12.5px] font-bold text-[var(--navy)] mb-2.5">Agregar registro</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Cantidad</label>
                <input type="number" value={gCantidad} onChange={(e) => setGCantidad(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Monto</label>
                <input type="number" value={gMonto} onChange={(e) => setGMonto(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Descripción</label>
              <input value={gDescripcion} onChange={(e) => setGDescripcion(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Tipo de transacción</label>
                <select value={gTipo} onChange={(e) => setGTipo(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]">
                  {OPCIONES_TIPO_TRANSACCION.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Referencia</label>
                <input value={gReferencia} onChange={(e) => setGReferencia(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Fondo</label>
                <select value={gFondo} onChange={(e) => setGFondo(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]">
                  {FONDOS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setGastosPorTareaAbierto(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarGastoTarea} disabled={guardandoGasto} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoGasto ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalGastosPorCategoria && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Gastos por categoría</h3>
              <span onClick={() => setModalGastosPorCategoria(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {Object.entries(gastosPorCategoria).length === 0 && <p className="text-[12.5px] text-[var(--gray-400)]">Sin registros aún.</p>}
              {Object.entries(gastosPorCategoria).map(([cat, monto]) => (
                <div key={cat} className="flex items-center justify-between border-b border-[var(--gray-100)] pb-2">
                  <span className="text-[13px] text-[var(--navy)]">{cat}</span>
                  <span className="text-[13px] font-bold text-[var(--navy)]">${monto.toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-5">
              <button type="button" onClick={() => setModalGastosPorCategoria(false)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {modalArqueo && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-50">
          <div className="bg-white rounded-2xl w-[440px] max-w-[92%] p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold text-[var(--navy)] m-0">Arqueo y ajuste de fondos</h3>
              <span onClick={() => setModalArqueo(false)} className="text-[var(--gray-400)] cursor-pointer text-lg leading-none">
                ✕
              </span>
            </div>
            <div className="flex flex-col gap-2 mb-5">
              {FONDOS.map((f) => (
                <div key={f} className="flex items-center justify-between text-[13px]">
                  <span className="text-[var(--navy)]">{f}</span>
                  <span className="font-bold text-[var(--navy)]">${(totalPorFondo[f] || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <p className="text-[12.5px] font-bold text-[var(--navy)] mb-2.5">Registrar ajuste</p>
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Fondo</label>
              <select value={ajusteFondo} onChange={(e) => setAjusteFondo(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]">
                {FONDOS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Monto del ajuste (+/-)</label>
              <input type="number" value={ajusteMonto} onChange={(e) => setAjusteMonto(e.target.value)} placeholder="Ej. -150 o 500" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
            </div>
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-[var(--gray-400)] uppercase mb-1">Motivo</label>
              <input value={ajusteDescripcion} onChange={(e) => setAjusteDescripcion(e.target.value)} placeholder="Motivo del ajuste" className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
            </div>
            <div className="flex gap-2.5 justify-end">
              <button type="button" onClick={() => setModalArqueo(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
              <button type="button" onClick={guardarAjusteFondo} disabled={guardandoAjuste} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoAjuste ? "Guardando..." : "Registrar ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
