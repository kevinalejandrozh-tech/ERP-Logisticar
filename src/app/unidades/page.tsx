"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { CAMPOS_UNIDAD } from "@/lib/unidadFormData";
import { exportarExcel } from "@/lib/exportExcel";
import { compressImage } from "@/lib/imageUtils";
import { useSesion } from "@/lib/useSesion";

type RegistroUnidad = Record<string, string>;
type ModoFicha = "ver" | "editar" | "nuevo";
type Resultados = Record<string, Record<string, boolean>>;
type Revision = {
  id: number;
  eco: string;
  fecha: string;
  resultados: Resultados;
  observaciones: string | null;
  realizado_por: string | null;
  kilometraje?: number | null;
};

const ZONA = "America/Mexico_City";
const sw = { fill: "none" as const, stroke: "#2f6fed", strokeWidth: 2 };

// Checklist rápido de unidad (se guarda en unidades_revisiones).
const CHECKLIST: { titulo: string; nota?: string; items: string[] }[] = [
  {
    titulo: "Auditoría GPS",
    nota: "Todos los comandos deben registrarse en la plataforma",
    items: [
      "Paro de motor desde Plataforma",
      "Voz cabina Bidireccional",
      "Paro al abrir puerta del Piloto",
      "Botón de Pánico Piloto",
      "Paro al abrir puerta Copiloto",
      "Botón de Pánico Copiloto",
      "Apertura de Chapa Trasera",
      "Sirenas de Emergencia",
    ],
  },
  {
    titulo: "Funcionamiento",
    nota: "Todos los comandos deben registrarse en la plataforma",
    items: [
      "Clima / Aire Acondicionado",
      "STOP / Luces traseras",
      "Luces delanteras (Bajas)",
      "Sonido al entrar Reversa",
      "Luces delanteras (Altas)",
      "Plumas del Limpiaparabrisas",
      "Luces Intermitentes",
      "Sirenas de Emergencia",
    ],
  },
  {
    titulo: "Herramental",
    items: ["Botiquín de primeros Auxilios", "Gato Hidráulico 1.5 Ton.", "Triángulos Reflectantes", "Birlos y Herramienta"],
  },
  {
    titulo: "Documentos",
    items: ["Póliza de Seguro Vigente", "Tarjeta de Circulación", "Certificado de Verificación", "Hojas de Descanso de Operador"],
  },
];
// Checklists adicionales (se abren en recuadro desde los botones debajo de la fotografía).
// Se guardan junto con la revisión, en el mismo JSON de resultados.
const CHECKLIST_EXTRA: { titulo: string; nota?: string; items: string[] }[] = [
  { titulo: "Neumáticos", items: ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8", "P9", "P10", "Refacción"] },
  {
    titulo: "Luces",
    items: ["Altas", "Bajas", "Cuartos", "Direccionales", "Intermitentes", "Stop", "Navegación", "Reversa", "Alarma reversa"],
  },
  { titulo: "Carrocería", items: ["Frente", "Lateral izquierda", "Lateral derecha", "Atrás"] },
];
const CHECKLIST_TODOS = [...CHECKLIST, ...CHECKLIST_EXTRA];
const TOTAL_PUNTOS = CHECKLIST_TODOS.reduce((n, b) => n + b.items.length, 0);

// ---------- Utilidades ----------
function mensajeError(err: unknown, porDefecto: string) {
  return err instanceof Error && err.message ? err.message : porDefecto;
}

// Clave por bloque + punto (hay puntos con el mismo nombre en bloques distintos, p. ej. "Sirenas de Emergencia").
const clavePunto = (bloque: string, item: string) => `${bloque}::${item}`;

function hoyLocal() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date()); // AAAA-MM-DD
}

function formatoFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-MX", { timeZone: ZONA, day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatoHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { timeZone: ZONA, hour: "2-digit", minute: "2-digit" });
}

function diaLocal(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date(iso));
}

function formatoDia(dia: string) {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

function contarCumplidos(resultados: Resultados) {
  let ok = 0;
  let total = 0;
  for (const bloque of Object.values(resultados || {})) {
    for (const v of Object.values(bloque || {})) {
      total++;
      if (v) ok++;
    }
  }
  return { ok, total };
}

async function leerJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Error de comunicación con el servidor.");
  return data;
}

async function obtenerUnidades(): Promise<{ registros: RegistroUnidad[]; conImagen: string[] }> {
  const data = await leerJson(await fetch("/api/unidades/list", { cache: "no-store" }));
  return { registros: data.registros || [], conImagen: data.conImagen || [] };
}

async function obtenerImagen(eco: string): Promise<string | null> {
  const data = await leerJson(await fetch(`/api/unidades/imagen?eco=${encodeURIComponent(eco)}`, { cache: "no-store" }));
  return data.imagen || null;
}

async function obtenerRevisiones(filtros: { eco?: string; desde?: string; hasta?: string; limite?: number }): Promise<Revision[]> {
  const q = new URLSearchParams();
  if (filtros.eco) q.set("eco", filtros.eco);
  if (filtros.desde) q.set("desde", filtros.desde);
  if (filtros.hasta) q.set("hasta", filtros.hasta);
  if (filtros.limite) q.set("limite", String(filtros.limite));
  const data = await leerJson(await fetch(`/api/unidades/revisiones?${q.toString()}`, { cache: "no-store" }));
  return data.registros || [];
}

// ---------- Componentes pequeños ----------
function Toggle({ activo, onChange, etiqueta, deshabilitado }: { activo: boolean; onChange: () => void; etiqueta: string; deshabilitado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      onClick={onChange}
      disabled={deshabilitado}
      className={`relative flex-none w-[32px] min-w-[32px] h-[18px] rounded-full transition-colors disabled:cursor-not-allowed ${activo ? "bg-[var(--green)]" : "bg-[var(--gray-400)]"}`}
    >
      <span className={`absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-[left] ${activo ? "left-[16px]" : "left-[2px]"}`} />
    </button>
  );
}

function IconoUnidad({ size = 120 }: { size?: number }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 24 15" fill="none" stroke="#c3c8d4" strokeWidth="1.1">
      <rect x="1" y="1.5" width="14" height="10" rx="1" />
      <path d="M15 4.5h4l3 3v4h-7z" />
      <circle cx="5.5" cy="12.3" r="1.7" fill="#fff" />
      <circle cx="17.5" cy="12.3" r="1.7" fill="#fff" />
    </svg>
  );
}

export default function UnidadesPage() {
  const sesion = useSesion();
  const soloConsulta = sesion.rol === "supervisor_tms";
  const esAdmin = sesion.rol === "sysadmin";

  const [registros, setRegistros] = useState<RegistroUnidad[]>([]);
  const [conImagen, setConImagen] = useState<Set<string>>(new Set());
  const [cargando, setCargando] = useState(true);
  const [mensaje, setMensaje] = useState("");
  const [aviso, setAviso] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null); // ECO seleccionado

  // Cachés por ECO (undefined = aún no se consulta)
  const [imagenes, setImagenes] = useState<Record<string, string | null>>({});
  const [ultimas, setUltimas] = useState<Record<string, Revision | null>>({});

  // Borrador del checklist por unidad: { [eco]: { [bloque::item]: boolean } }
  const [checks, setChecks] = useState<Record<string, Record<string, boolean>>>({});
  const [observaciones, setObservaciones] = useState<Record<string, string>>({});
  const [guardandoRevision, setGuardandoRevision] = useState(false);
  const [kilometrajes, setKilometrajes] = useState<Record<string, string>>({}); // borrador por ECO
  const [extraAbierto, setExtraAbierto] = useState<string | null>(null); // título del checklist adicional abierto

  // Ficha completa (modal)
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [modo, setModo] = useState<ModoFicha>("ver");
  const [valores, setValores] = useState<RegistroUnidad>({});
  const [fotoNueva, setFotoNueva] = useState<string | null | undefined>(undefined); // undefined = sin cambios
  const [guardando, setGuardando] = useState(false);
  const [procesandoFoto, setProcesandoFoto] = useState(false);
  const inputFoto = useRef<HTMLInputElement>(null);
  const pedidos = useRef<Set<string>>(new Set()); // evita pedir dos veces la misma foto/revisión

  // Historial de revisiones (modal)
  const [histAbierto, setHistAbierto] = useState(false);
  const [histEco, setHistEco] = useState("");
  const [histDesde, setHistDesde] = useState("");
  const [histHasta, setHistHasta] = useState("");
  const [histRegistros, setHistRegistros] = useState<Revision[]>([]);
  const [histCargando, setHistCargando] = useState(false);
  const [histError, setHistError] = useState("");
  const [histExpandido, setHistExpandido] = useState<number | null>(null);
  const [histConsulta, setHistConsulta] = useState<{ eco: string; desde: string; hasta: string } | null>(null);

  // ---------- Carga de unidades ----------
  const aplicarLista = useCallback((datos: { registros: RegistroUnidad[]; conImagen: string[] }) => {
    setRegistros(datos.registros);
    setConImagen(new Set(datos.conImagen));
    setSeleccion((prev) => (prev && datos.registros.some((r) => r["ECO"] === prev) ? prev : datos.registros[0]?.["ECO"] ?? null));
  }, []);

  const cargar = useCallback(async () => {
    try {
      aplicarLista(await obtenerUnidades());
    } catch {
      setMensaje("No se pudieron cargar las unidades. Revisa tu conexión.");
    } finally {
      setCargando(false);
    }
  }, [aplicarLista]);

  useEffect(() => {
    obtenerUnidades()
      .then(aplicarLista)
      .catch(() => setMensaje("No se pudieron cargar las unidades. Revisa tu conexión."))
      .finally(() => setCargando(false));
  }, [aplicarLista]);

  // Foto y última revisión de la unidad seleccionada (solo se piden una vez por unidad)
  useEffect(() => {
    if (!seleccion) return;
    const eco = seleccion;
    if (imagenes[eco] === undefined && !pedidos.current.has(`img:${eco}`)) {
      pedidos.current.add(`img:${eco}`);
      const peticion = conImagen.has(eco) ? obtenerImagen(eco) : Promise.resolve(null);
      peticion
        .then((img) => setImagenes((prev) => ({ ...prev, [eco]: img })))
        .catch(() => setImagenes((prev) => ({ ...prev, [eco]: null })))
        .finally(() => pedidos.current.delete(`img:${eco}`));
    }
    if (ultimas[eco] === undefined && !pedidos.current.has(`rev:${eco}`)) {
      pedidos.current.add(`rev:${eco}`);
      obtenerRevisiones({ eco, limite: 1 })
        .then((lista) => setUltimas((prev) => ({ ...prev, [eco]: lista[0] || null })))
        .catch(() => setUltimas((prev) => ({ ...prev, [eco]: null })))
        .finally(() => pedidos.current.delete(`rev:${eco}`));
    }
  }, [seleccion, conImagen, imagenes, ultimas]);

  // Aviso temporal
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(""), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((r) => `${r["ECO"] || ""} ${r["Unidad"] || ""}`.toLowerCase().includes(q));
  }, [registros, busqueda]);

  const nombrePorEco = useMemo(() => Object.fromEntries(registros.map((r) => [r["ECO"], r["Unidad"] || ""])), [registros]);

  const indiceActual = registros.findIndex((r) => r["ECO"] === seleccion);
  const actual = indiceActual >= 0 ? registros[indiceActual] : null;
  const ecoActual = actual?.["ECO"] || "";
  const imagenActual = ecoActual ? imagenes[ecoActual] : undefined;
  const ultimaActual = ecoActual ? ultimas[ecoActual] : undefined;
  const hayCambios =
    !!ecoActual &&
    (Object.keys(checks[ecoActual] || {}).length > 0 || !!observaciones[ecoActual]?.trim() || !!kilometrajes[ecoActual]?.trim());
  const bloqueExtra = CHECKLIST_EXTRA.find((b) => b.titulo === extraAbierto) || null;

  const mover = useCallback(
    (dir: 1 | -1) => {
      if (registros.length === 0) return;
      const base = indiceActual < 0 ? 0 : indiceActual;
      const siguiente = (base + dir + registros.length) % registros.length;
      setSeleccion(registros[siguiente]["ECO"]);
    },
    [registros, indiceActual]
  );

  // Navegación con flechas del teclado (solo sin modales abiertos)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (fichaAbierta || histAbierto || extraAbierto) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") mover(1);
      if (e.key === "ArrowLeft") mover(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mover, fichaAbierta, histAbierto, extraAbierto]);

  // ---------- Checklist rápido ----------
  // Valor mostrado: borrador > última revisión guardada > true
  const estaActivo = (eco: string, bloque: string, item: string) =>
    checks[eco]?.[clavePunto(bloque, item)] ?? ultimas[eco]?.resultados?.[bloque]?.[item] ?? true;

  const alternar = (eco: string, bloque: string, item: string) => {
    if (soloConsulta) return;
    const actualValor = estaActivo(eco, bloque, item);
    setChecks((prev) => ({ ...prev, [eco]: { ...prev[eco], [clavePunto(bloque, item)]: !actualValor } }));
  };

  const descartarCambios = (eco: string) => {
    setChecks((prev) => {
      const copia = { ...prev };
      delete copia[eco];
      return copia;
    });
    setObservaciones((prev) => ({ ...prev, [eco]: "" }));
    setKilometrajes((prev) => ({ ...prev, [eco]: "" }));
  };

  const guardarRevision = async () => {
    if (!ecoActual || soloConsulta) return;
    const kmTexto = (kilometrajes[ecoActual] || "").trim();
    const kilometraje = kmTexto === "" ? null : Number(kmTexto);
    if (kilometraje !== null && (!Number.isInteger(kilometraje) || kilometraje < 0)) {
      alert("El kilometraje debe ser un número entero no negativo.");
      return;
    }
    const resultados: Resultados = {};
    for (const bloque of CHECKLIST_TODOS) {
      resultados[bloque.titulo] = {};
      for (const item of bloque.items) resultados[bloque.titulo][item] = estaActivo(ecoActual, bloque.titulo, item);
    }
    const { ok } = contarCumplidos(resultados);
    if (!confirm(`¿Guardar la revisión de ${ecoActual}? (${ok}/${TOTAL_PUNTOS} puntos en orden)`)) return;
    setGuardandoRevision(true);
    try {
      const data = await leerJson(
        await fetch("/api/unidades/revisiones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eco: ecoActual, resultados, observaciones: observaciones[ecoActual] || "", kilometraje }),
        })
      );
      const registro: Revision = data.registro;
      setUltimas((prev) => ({ ...prev, [ecoActual]: registro }));
      descartarCambios(ecoActual);
      if (histAbierto && histConsulta) setHistRegistros((prev) => [registro, ...prev]);
      setAviso(`Revisión de ${ecoActual} guardada.`);
    } catch (err) {
      alert(mensajeError(err, "No se pudo guardar la revisión."));
    } finally {
      setGuardandoRevision(false);
    }
  };

  // ---------- Historial ----------
  const consultarHistorial = async (filtros: { eco: string; desde: string; hasta: string }) => {
    if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
      setHistError("La fecha 'Desde' no puede ser mayor que 'Hasta'.");
      return;
    }
    setHistCargando(true);
    setHistError("");
    setHistExpandido(null);
    try {
      setHistRegistros(await obtenerRevisiones({ ...filtros, limite: 500 }));
      setHistConsulta(filtros);
    } catch (err) {
      setHistError(mensajeError(err, "No se pudo consultar el historial."));
    } finally {
      setHistCargando(false);
    }
  };

  const abrirHistorial = (eco: string, dia: string) => {
    setHistEco(eco);
    setHistDesde(dia);
    setHistHasta(dia);
    setHistRegistros([]);
    setHistConsulta(null);
    setHistAbierto(true);
    consultarHistorial({ eco, desde: dia, hasta: dia });
  };

  const eliminarRevision = async (rev: Revision) => {
    if (!esAdmin) return;
    if (!confirm(`¿Eliminar la revisión de ${rev.eco} del ${formatoFecha(rev.fecha)} ${formatoHora(rev.fecha)}? Esta acción no se puede deshacer.`)) return;
    try {
      await leerJson(await fetch(`/api/unidades/revisiones?id=${rev.id}`, { method: "DELETE" }));
      setHistRegistros((prev) => prev.filter((r) => r.id !== rev.id));
      // Si era la última de la unidad, se vuelve a consultar
      if (ultimas[rev.eco]?.id === rev.id) {
        const lista = await obtenerRevisiones({ eco: rev.eco, limite: 1 });
        setUltimas((prev) => ({ ...prev, [rev.eco]: lista[0] || null }));
      }
      setAviso("Revisión eliminada.");
    } catch (err) {
      alert(mensajeError(err, "No se pudo eliminar la revisión."));
    }
  };

  // Resumen por día: qué unidades se revisaron y cuáles faltan (solo con un día y todas las unidades)
  const resumenDia = useMemo(() => {
    if (!histConsulta || histConsulta.eco || !histConsulta.desde || histConsulta.desde !== histConsulta.hasta) return null;
    const revisadas = new Set(histRegistros.map((r) => r.eco));
    return {
      dia: histConsulta.desde,
      revisadas: registros.filter((r) => revisadas.has(r["ECO"])).map((r) => r["ECO"]),
      pendientes: registros.filter((r) => !revisadas.has(r["ECO"])).map((r) => r["ECO"]),
    };
  }, [histConsulta, histRegistros, registros]);

  const exportarHistorial = () => {
    exportarExcel(`Revisiones_Unidades_${hoyLocal()}.xlsx`, [
      {
        nombre: "Revisiones",
        filas: histRegistros.map((r) => {
          const fila: Record<string, string> = {
            Fecha: formatoFecha(r.fecha),
            Hora: formatoHora(r.fecha),
            ECO: r.eco,
            Unidad: nombrePorEco[r.eco] || "",
            "Puntos en orden": `${contarCumplidos(r.resultados).ok}/${contarCumplidos(r.resultados).total}`,
            Kilometraje: r.kilometraje != null ? String(r.kilometraje) : "",
          };
          for (const bloque of CHECKLIST_TODOS) {
            for (const item of bloque.items) {
              const v = r.resultados?.[bloque.titulo]?.[item];
              fila[`${bloque.titulo} - ${item}`] = v === undefined ? "" : v ? "OK" : "FALLA";
            }
          }
          fila["Observaciones"] = r.observaciones || "";
          fila["Realizó"] = r.realizado_por || "";
          return fila;
        }),
      },
    ]);
  };

  // ---------- Ficha completa ----------
  const abrirFicha = (registro: RegistroUnidad) => {
    setValores({ ...registro });
    setFotoNueva(undefined);
    setModo("ver");
    setFichaAbierta(true);
  };

  const abrirNueva = () => {
    setValores({});
    setFotoNueva(undefined);
    setModo("nuevo");
    setFichaAbierta(true);
  };

  const cerrarFicha = () => {
    if (guardando) return;
    setFichaAbierta(false);
  };

  const cancelarEdicion = () => {
    if (modo === "nuevo") {
      setFichaAbierta(false);
      return;
    }
    const original = registros.find((r) => r["ECO"] === valores["ECO"]);
    if (original) setValores({ ...original });
    setFotoNueva(undefined);
    setModo("ver");
  };

  const seleccionarFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("Selecciona un archivo de imagen.");
      return;
    }
    setProcesandoFoto(true);
    try {
      setFotoNueva(await compressImage(file, 900, 0.7, 450000));
    } catch (err) {
      alert(mensajeError(err, "No se pudo procesar la imagen."));
    } finally {
      setProcesandoFoto(false);
    }
  };

  const guardar = async () => {
    if (!valores["ECO"]?.trim()) {
      alert("Captura al menos el campo ECO.");
      return;
    }
    if (modo === "nuevo" && registros.some((r) => r["ECO"]?.trim().toLowerCase() === valores["ECO"].trim().toLowerCase())) {
      alert(`La unidad ${valores["ECO"]} ya existe. Selecciónala en la lista para editarla.`);
      return;
    }
    setGuardando(true);
    try {
      const eco = valores["ECO"].trim();
      const datos: RegistroUnidad = { ...valores, ECO: eco };
      delete datos["imagen"];
      // La foto solo se envía si cambió (si no se envía, el backend conserva la actual)
      const payload = fotoNueva !== undefined ? { ...datos, imagen: fotoNueva || "" } : datos;
      await leerJson(
        await fetch("/api/unidades", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      if (fotoNueva !== undefined) setImagenes((prev) => ({ ...prev, [eco]: fotoNueva || null }));
      setSeleccion(eco);
      await cargar();
      setValores(datos);
      setFotoNueva(undefined);
      setModo("ver");
      setAviso(`Unidad ${eco} guardada.`);
    } catch (err) {
      alert(mensajeError(err, "Error al guardar la unidad."));
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (eco: string) => {
    if (!confirm(`¿Eliminar la unidad ${eco}? Esta acción no se puede deshacer.`)) return;
    try {
      await leerJson(
        await fetch("/api/unidades/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ eco }),
        })
      );
      setFichaAbierta(false);
      setSeleccion(null);
      setImagenes((prev) => {
        const copia = { ...prev };
        delete copia[eco];
        return copia;
      });
      await cargar();
    } catch (err) {
      alert(mensajeError(err, "Error al eliminar la unidad."));
    }
  };

  const exportar = () => {
    exportarExcel(`Unidades_${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { nombre: "Unidades", filas: registros.map((r) => Object.fromEntries(CAMPOS_UNIDAD.map((c) => [c, r[c] || ""]))) },
    ]);
  };

  const enEdicion = modo === "editar" || modo === "nuevo";
  const ecoFicha = valores["ECO"] || "";
  const fotoFicha = fotoNueva !== undefined ? fotoNueva : modo === "nuevo" ? null : imagenes[ecoFicha];

  return (
    <div className="min-h-screen bg-[#eef1f6]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10 pb-10">
        <PageHeader
          titulo="Unidades"
          subtitulo="Administra y consulta la información de las unidades."
          backHref="/"
          backLabel="Menú principal"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" {...sw}><rect x="1" y="7" width="14" height="11" /><path d="M15 10h4l3 3v5h-7z" /><circle cx="5.5" cy="18.5" r="1.7" /><circle cx="17.5" cy="18.5" r="1.7" /></svg>}
        />

        {mensaje && <p className="text-[12.5px] text-[var(--red)] mb-3">{mensaje}</p>}
        {aviso && (
          <div className="fixed bottom-5 right-5 z-[60] bg-[var(--navy)] text-white text-[12.5px] font-semibold rounded-lg px-4 py-2.5 shadow-lg" role="status">
            {aviso}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 md:gap-5 items-start">
          {/* ===================== MENÚ LATERAL (25%) ===================== */}
          <aside className="lg:col-span-1 bg-white rounded-[18px] p-4 shadow-[0_1px_3px_rgba(22,33,92,0.06)] lg:sticky lg:top-24">
            <div className="flex flex-wrap gap-2 mb-3">
              {!soloConsulta && (
                <button
                  type="button"
                  onClick={abrirNueva}
                  className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M12 5v14M5 12h14" /></svg>
                  Agregar / Editar
                </button>
              )}
              <button
                type="button"
                onClick={() => abrirHistorial("", hoyLocal())}
                className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3.5 py-2.5 text-[12.5px] font-bold hover:bg-[var(--gray-100)]"
                title="Revisiones realizadas por día"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
                Revisiones por día
              </button>
            </div>

            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar ECO o unidad..."
              className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] mb-3"
            />

            <div className="bg-[var(--navy)] text-white text-[12px] font-bold uppercase tracking-wide rounded-t-md px-3 py-2.5 grid grid-cols-[70px_1fr]">
              <span>ECO</span>
              <span>Unidad</span>
            </div>

            <div className="max-h-[260px] lg:max-h-[calc(100vh-300px)] overflow-y-auto">
              {cargando ? (
                <p className="text-center text-[var(--gray-400)] text-[12.5px] py-6">Cargando unidades...</p>
              ) : filtrados.length === 0 ? (
                <p className="text-center text-[var(--gray-400)] text-[12.5px] py-6">
                  {registros.length === 0 ? "Aún no hay unidades registradas." : "Sin coincidencias."}
                </p>
              ) : (
                filtrados.map((r) => {
                  const activo = r["ECO"] === seleccion;
                  return (
                    <button
                      type="button"
                      key={r["ECO"]}
                      onClick={() => setSeleccion(r["ECO"])}
                      onDoubleClick={() => abrirFicha(r)}
                      title="Clic: ver unidad · Doble clic: ficha completa"
                      className={`w-full text-left grid grid-cols-[70px_1fr] items-center px-3 py-2.5 text-[12px] border-b border-[var(--gray-200)] transition-colors ${
                        activo ? "bg-[#a9aec6] text-[var(--navy)] font-semibold rounded-md" : "hover:bg-[var(--gray-100)]"
                      }`}
                    >
                      <span>{r["ECO"]}</span>
                      <span className="truncate">{r["Unidad"] || "—"}</span>
                    </button>
                  );
                })
              )}
            </div>

            {!cargando && registros.length > 0 && (
              <button type="button" onClick={exportar} className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                Exportar Excel
              </button>
            )}
          </aside>

          {/* ===================== PANEL PRINCIPAL (75%) ===================== */}
          <section className="lg:col-span-3 bg-white rounded-[18px] p-4 sm:p-5 md:p-6 shadow-[0_1px_3px_rgba(22,33,92,0.06)] border-2 border-[#8b5cf6]/70">
            {!actual ? (
              <div className="flex flex-col items-center justify-center text-center py-20 text-[var(--gray-400)] text-[13.5px]">
                <IconoUnidad size={140} />
                <p className="mt-4">{cargando ? "Cargando..." : "Selecciona una unidad del menú lateral."}</p>
              </div>
            ) : (
              <>
                {/* Encabezado */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="bg-[#d9d9d9] text-[#3a3a3a] font-display font-bold text-[26px] sm:text-[30px] rounded-md px-4 py-1 leading-tight">
                      {ecoActual}
                    </span>
                    <span className="hidden sm:block text-[13px] text-[var(--gray-400)]">{actual["Unidad"] || ""}</span>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="text-[11.5px] text-[var(--text)] text-right">
                      Fecha de última revisión - Checklist&nbsp;&nbsp;
                      <b>
                        {ultimaActual === undefined
                          ? "..."
                          : ultimaActual
                          ? `${formatoFecha(ultimaActual.fecha)} ${formatoHora(ultimaActual.fecha)}`
                          : "Sin revisiones"}
                      </b>
                    </span>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => abrirHistorial(ecoActual, "")}
                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3 py-1.5 hover:bg-[var(--gray-100)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
                        Historial
                      </button>
                      <button
                        type="button"
                        onClick={() => abrirFicha(actual)}
                        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--blue)] border border-[var(--blue)] rounded-lg px-3 py-1.5 hover:bg-[var(--blue-light)]"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18M3 12h18M3 19h18" /></svg>
                        Ver ficha completa
                      </button>
                    </div>
                  </div>
                </div>

                {/* Imagen + navegación */}
                <div className="relative flex items-center justify-center h-[220px] sm:h-[260px] md:h-[300px] my-2">
                  <button
                    type="button"
                    onClick={() => mover(-1)}
                    aria-label="Unidad anterior"
                    className="absolute left-0 sm:left-2 top-1/2 -translate-y-1/2 p-2 text-[#c3c3c3] hover:text-[var(--navy)]"
                  >
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
                  </button>

                  <button type="button" onClick={() => abrirFicha(actual)} className="h-full max-w-[75%] flex items-center justify-center" title="Ver ficha completa">
                    {imagenActual ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imagenActual} alt={`Unidad ${ecoActual}`} className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center text-[var(--gray-400)] text-[12.5px] gap-2">
                        <IconoUnidad size={170} />
                        <span>
                          {imagenActual === undefined ? "Cargando fotografía..." : soloConsulta ? "Sin fotografía" : "Sin fotografía · clic para agregarla"}
                        </span>
                      </div>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => mover(1)}
                    aria-label="Unidad siguiente"
                    className="absolute right-0 sm:right-2 top-1/2 -translate-y-1/2 p-2 text-[#c3c3c3] hover:text-[var(--navy)]"
                  >
                    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
                  </button>
                </div>

                {/* Kilometraje + checklists adicionales */}
                <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
                  <div className="w-full sm:w-auto">
                    <label htmlFor="kilometraje-actual" className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">
                      Kilometraje actual
                    </label>
                    <div className="flex items-center border border-[var(--gray-200)] rounded-lg overflow-hidden bg-white w-full sm:w-[240px]">
                      <input
                        id="kilometraje-actual"
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={1}
                        value={kilometrajes[ecoActual] || ""}
                        onChange={(e) => setKilometrajes((prev) => ({ ...prev, [ecoActual]: e.target.value }))}
                        disabled={soloConsulta}
                        placeholder={ultimaActual?.kilometraje != null ? `Último: ${ultimaActual.kilometraje.toLocaleString("es-MX")}` : "Ej. 125000"}
                        className="flex-1 min-w-0 px-3 py-2 text-[12.5px] outline-none disabled:bg-[var(--gray-100)]"
                      />
                      <span className="px-3 py-2 text-[11.5px] font-bold text-[var(--gray-400)] bg-[var(--gray-100)] border-l border-[var(--gray-200)]">km</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {CHECKLIST_EXTRA.map((bloque) => {
                      const fallas = bloque.items.filter((item) => !estaActivo(ecoActual, bloque.titulo, item)).length;
                      return (
                        <button
                          key={bloque.titulo}
                          type="button"
                          onClick={() => setExtraAbierto(bloque.titulo)}
                          className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[var(--navy)] bg-white border border-[var(--gray-200)] rounded-lg px-3.5 py-2 hover:bg-[var(--gray-100)]"
                        >
                          {bloque.titulo}
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10.5px] font-bold ${
                              fallas === 0 ? "bg-[#dcf5e8] text-[#137a4a]" : "bg-[#fde4e0] text-[var(--red)]"
                            }`}
                          >
                            {bloque.items.length - fallas}/{bloque.items.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)] gap-3 items-stretch">
                  {CHECKLIST.map((bloque) => {
                    const dosColumnas = bloque.items.length > 4;
                    return (
                      <div key={bloque.titulo} className="bg-[#d9d9d9] rounded-lg p-2.5 flex flex-col min-w-0">
                        <h4 className="text-center text-[14px] font-semibold text-[#333] m-0">{bloque.titulo}</h4>
                        {bloque.nota && <p className="text-[10px] leading-snug text-[#444] mt-0.5 mb-0">- {bloque.nota}</p>}
                        <div className={`grid gap-1.5 mt-2 auto-rows-fr ${dosColumnas ? "grid-cols-2" : "grid-cols-1"}`}>
                          {bloque.items.map((item) => (
                            <div
                              key={item}
                              className="bg-[#f2f2f2] rounded-md pl-2 pr-1.5 py-1.5 min-h-[40px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5"
                            >
                              <span lang="es" className="min-w-0 text-[10.5px] leading-tight text-[#222] break-words hyphens-auto">
                                {item}
                              </span>
                              <Toggle
                                activo={estaActivo(ecoActual, bloque.titulo, item)}
                                onChange={() => alternar(ecoActual, bloque.titulo, item)}
                                etiqueta={`${bloque.titulo}: ${item}`}
                                deshabilitado={soloConsulta}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Guardar revisión */}
                {soloConsulta ? (
                  <p className="text-[10.5px] text-[var(--gray-400)] mt-2 mb-0">* Se muestra la última revisión guardada. Tu usuario es de solo consulta.</p>
                ) : (
                  <div className="mt-3 flex flex-col md:flex-row md:items-end gap-2.5">
                    <div className="flex-1 min-w-0">
                      <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Observaciones (opcional)</label>
                      <textarea
                        value={observaciones[ecoActual] || ""}
                        onChange={(e) => setObservaciones((prev) => ({ ...prev, [ecoActual]: e.target.value }))}
                        maxLength={2000}
                        rows={1}
                        placeholder="Ej. Falla en luz intermitente derecha..."
                        className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] resize-y"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      {hayCambios && (
                        <button
                          type="button"
                          onClick={() => descartarCambios(ecoActual)}
                          disabled={guardandoRevision}
                          className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-4 py-2.5 text-[12.5px] font-bold"
                        >
                          Descartar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={guardarRevision}
                        disabled={guardandoRevision || ultimaActual === undefined}
                        className="bg-[var(--green)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[12.5px] font-bold whitespace-nowrap"
                      >
                        {guardandoRevision ? "Guardando..." : "Guardar revisión"}
                      </button>
                    </div>
                  </div>
                )}
                {!soloConsulta && (
                  <p className="text-[10.5px] text-[var(--gray-400)] mt-2 mb-0">
                    * Los interruptores muestran la última revisión guardada. {hayCambios ? "Tienes cambios sin guardar." : ""}
                  </p>
                )}
              </>
            )}
          </section>
        </div>
      </div>

      {/* ===================== FICHA COMPLETA (MODAL) ===================== */}
      {fichaAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50" onClick={cerrarFicha}>
          <div
            className="bg-white rounded-2xl w-[980px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Encabezado modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0">
                  {modo === "nuevo" ? "Agregar unidad" : `${ecoFicha} · ${valores["Unidad"] || "Sin nombre"}`}
                </h3>
                <p className="text-[12px] text-[var(--gray-400)] m-0">
                  {modo === "ver" ? "Ficha completa de la unidad" : modo === "editar" ? "Editando información de la unidad" : "Captura la información de la nueva unidad"}
                </p>
              </div>
              <button type="button" onClick={cerrarFicha} aria-label="Cerrar" className="text-[var(--gray-400)] hover:text-[var(--navy)] p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5">
              {/* Fotografía */}
              <div>
                <div className="bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-xl h-[200px] flex items-center justify-center overflow-hidden">
                  {fotoFicha ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fotoFicha} alt="Fotografía de la unidad" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center text-[var(--gray-400)] text-[12px] gap-2">
                      <IconoUnidad size={120} />
                      {fotoFicha === undefined ? "Cargando fotografía..." : "Sin fotografía"}
                    </div>
                  )}
                </div>
                {enEdicion && (
                  <div className="flex gap-2 mt-2.5">
                    <input ref={inputFoto} type="file" accept="image/*" className="hidden" onChange={seleccionarFoto} />
                    <button
                      type="button"
                      onClick={() => inputFoto.current?.click()}
                      disabled={procesandoFoto}
                      className="flex-1 bg-[var(--blue-light)] text-[var(--blue)] rounded-lg px-3 py-2 text-[12px] font-bold disabled:opacity-60"
                    >
                      {procesandoFoto ? "Procesando..." : fotoFicha ? "Cambiar foto" : "Agregar foto"}
                    </button>
                    {fotoFicha && (
                      <button
                        type="button"
                        onClick={() => setFotoNueva(null)}
                        className="bg-white text-[var(--red)] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12px] font-bold"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                )}
                {enEdicion && <p className="text-[10.5px] text-[var(--gray-400)] mt-1.5 mb-0">La imagen se comprime automáticamente (JPEG, máx. 900 px).</p>}
              </div>

              {/* Datos */}
              {enEdicion ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3.5">
                  {CAMPOS_UNIDAD.map((campo) => (
                    <div key={campo}>
                      <label className="block text-[12px] font-bold text-[var(--navy)] mb-1.5">{campo}</label>
                      <input
                        disabled={modo === "editar" && campo === "ECO"}
                        value={valores[campo] || ""}
                        onChange={(e) => setValores((prev) => ({ ...prev, [campo]: e.target.value }))}
                        className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] disabled:bg-[var(--gray-100)]"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="border border-[var(--gray-200)] rounded-xl overflow-hidden">
                  <table className="w-full border-collapse">
                    <tbody>
                      {CAMPOS_UNIDAD.map((campo, i) => (
                        <tr key={campo} className={i % 2 === 0 ? "bg-white" : "bg-[var(--gray-100)]"}>
                          <th className="text-left text-[11px] uppercase tracking-wide text-[var(--navy)] font-bold px-3 py-2 w-[45%] align-top">{campo}</th>
                          <td className="px-3 py-2 text-[12.5px] break-words">{valores[campo] || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Acciones */}
            <div className="flex flex-wrap gap-2.5 justify-end mt-6">
              {modo === "ver" ? (
                <>
                  {!soloConsulta && (
                    <button
                      type="button"
                      onClick={() => eliminar(ecoFicha)}
                      className="mr-auto bg-white text-[var(--red)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold"
                    >
                      Eliminar
                    </button>
                  )}
                  <button type="button" onClick={cerrarFicha} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                    Cerrar
                  </button>
                  {!soloConsulta && (
                    <button type="button" onClick={() => setModo("editar")} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                      Editar unidad
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button type="button" onClick={cancelarEdicion} disabled={guardando} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={guardando || procesandoFoto}
                    className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold"
                  >
                    {guardando ? "Guardando..." : "Guardar"}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===================== CHECKLIST ADICIONAL (MODAL) ===================== */}
      {bloqueExtra && actual && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50" onClick={() => setExtraAbierto(null)}>
          <div
            className="bg-white rounded-2xl w-[980px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0">
                  {ecoActual} · {actual["Unidad"] || "Sin nombre"}
                </h3>
                <p className="text-[12px] text-[var(--gray-400)] m-0">Checklist de {bloqueExtra.titulo.toLowerCase()}</p>
              </div>
              <button type="button" onClick={() => setExtraAbierto(null)} aria-label="Cerrar" className="text-[var(--gray-400)] hover:text-[var(--navy)] p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            <div className="bg-[#d9d9d9] rounded-lg p-2.5 flex flex-col min-w-0">
              <h4 className="text-center text-[14px] font-semibold text-[#333] m-0">{bloqueExtra.titulo}</h4>
              {bloqueExtra.nota && <p className="text-[10px] leading-snug text-[#444] mt-0.5 mb-0">- {bloqueExtra.nota}</p>}
              <div className="grid gap-1.5 mt-2 auto-rows-fr grid-cols-2">
                {bloqueExtra.items.map((item) => (
                  <div key={item} className="bg-[#f2f2f2] rounded-md pl-2 pr-1.5 py-1.5 min-h-[40px] grid grid-cols-[minmax(0,1fr)_auto] items-center gap-1.5">
                    <span lang="es" className="min-w-0 text-[10.5px] leading-tight text-[#222] break-words hyphens-auto">
                      {item}
                    </span>
                    <Toggle
                      activo={estaActivo(ecoActual, bloqueExtra.titulo, item)}
                      onChange={() => alternar(ecoActual, bloqueExtra.titulo, item)}
                      etiqueta={`${bloqueExtra.titulo}: ${item}`}
                      deshabilitado={soloConsulta}
                    />
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[10.5px] text-[var(--gray-400)] mt-2 mb-0">
              {soloConsulta
                ? "* Se muestra la última revisión guardada. Tu usuario es de solo consulta."
                : "* Los cambios se guardan junto con la revisión al presionar \"Guardar revisión\"."}
            </p>

            <div className="flex flex-wrap gap-2.5 justify-end mt-6">
              <button type="button" onClick={() => setExtraAbierto(null)} className="bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== HISTORIAL DE REVISIONES (MODAL) ===================== */}
      {histAbierto && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-50" onClick={() => setHistAbierto(false)}>
          <div
            className="bg-white rounded-2xl w-[1100px] max-w-[95%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-[18px] font-bold text-[var(--navy)] m-0">Historial de revisiones</h3>
                <p className="text-[12px] text-[var(--gray-400)] m-0">Consulta los checklists rápidos por unidad y por día.</p>
              </div>
              <button type="button" onClick={() => setHistAbierto(false)} aria-label="Cerrar" className="text-[var(--gray-400)] hover:text-[var(--navy)] p-1">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>

            {/* Filtros */}
            <form
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_auto] gap-2.5 items-end mb-4"
              onSubmit={(e) => {
                e.preventDefault();
                consultarHistorial({ eco: histEco, desde: histDesde, hasta: histHasta });
              }}
            >
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Unidad</label>
                <select value={histEco} onChange={(e) => setHistEco(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] bg-white">
                  <option value="">Todas las unidades</option>
                  {registros.map((r) => (
                    <option key={r["ECO"]} value={r["ECO"]}>
                      {r["ECO"]} · {r["Unidad"] || ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Desde</label>
                <input type="date" value={histDesde} onChange={(e) => setHistDesde(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]" />
              </div>
              <div>
                <label className="block text-[11.5px] font-bold text-[var(--navy)] mb-1">Hasta</label>
                <input type="date" value={histHasta} onChange={(e) => setHistHasta(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]" />
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const hoy = hoyLocal();
                    setHistDesde(hoy);
                    setHistHasta(hoy);
                    consultarHistorial({ eco: histEco, desde: hoy, hasta: hoy });
                  }}
                  className="bg-white text-[var(--navy)] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] font-bold"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setHistDesde("");
                    setHistHasta("");
                    consultarHistorial({ eco: histEco, desde: "", hasta: "" });
                  }}
                  className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px] font-bold"
                >
                  Todas las fechas
                </button>
                <button type="submit" disabled={histCargando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-4 py-2 text-[12.5px] font-bold">
                  Buscar
                </button>
              </div>
            </form>

            {histError && <p className="text-[12.5px] text-[var(--red)] mb-3">{histError}</p>}

            {/* Resumen del día */}
            {resumenDia && !histCargando && (
              <div className="bg-[var(--gray-100)] border border-[var(--gray-200)] rounded-xl p-3 mb-4">
                <p className="text-[12.5px] text-[var(--navy)] font-bold m-0 mb-2">
                  {formatoDia(resumenDia.dia)}: {resumenDia.revisadas.length} de {registros.length} unidades revisadas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {resumenDia.revisadas.map((eco) => (
                    <span key={eco} className="text-[11px] font-semibold rounded-md px-2 py-1 bg-[#dcf5e8] text-[#137a4a]">
                      ✓ {eco}
                    </span>
                  ))}
                  {resumenDia.pendientes.map((eco) => (
                    <span key={eco} className="text-[11px] font-semibold rounded-md px-2 py-1 bg-white border border-[var(--gray-200)] text-[var(--gray-400)]">
                      {eco}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tabla */}
            {histCargando ? (
              <p className="text-center text-[var(--gray-400)] text-[13px] py-8">Consultando revisiones...</p>
            ) : histRegistros.length === 0 ? (
              <p className="text-center text-[var(--gray-400)] text-[13px] py-8">{histConsulta ? "No hay revisiones con esos filtros." : ""}</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11.5px] text-[var(--gray-400)]">{histRegistros.length} registro(s)</span>
                  <button type="button" onClick={exportarHistorial} className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--gray-400)] hover:text-[var(--blue)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></svg>
                    Exportar Excel
                  </button>
                </div>
                <div className="overflow-x-auto border border-[var(--gray-200)] rounded-xl">
                  <table className="w-full border-collapse min-w-[720px]">
                    <thead>
                      <tr>
                        {["Fecha", "Hora", "ECO", "Unidad", "Resultado", "Realizó", "Acciones"].map((h) => (
                          <th key={h} className="text-left text-[10.5px] uppercase tracking-wide text-white bg-[var(--navy)] px-3 py-2.5 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {histRegistros.map((r, i) => {
                        const { ok, total } = contarCumplidos(r.resultados);
                        const fallas = total - ok;
                        const expandido = histExpandido === r.id;
                        const diaAnterior = i > 0 ? diaLocal(histRegistros[i - 1].fecha) : "";
                        const nuevoDia = diaLocal(r.fecha) !== diaAnterior;
                        return (
                          <FilaRevision
                            key={r.id}
                            revision={r}
                            unidad={nombrePorEco[r.eco] || "—"}
                            ok={ok}
                            total={total}
                            fallas={fallas}
                            expandido={expandido}
                            separador={nuevoDia && i > 0}
                            puedeEliminar={esAdmin}
                            onVer={() => setHistExpandido(expandido ? null : r.id)}
                            onEliminar={() => eliminarRevision(r)}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Fila del historial (con detalle desplegable) ----------
function FilaRevision({
  revision,
  unidad,
  ok,
  total,
  fallas,
  expandido,
  separador,
  puedeEliminar,
  onVer,
  onEliminar,
}: {
  revision: Revision;
  unidad: string;
  ok: number;
  total: number;
  fallas: number;
  expandido: boolean;
  separador: boolean;
  puedeEliminar: boolean;
  onVer: () => void;
  onEliminar: () => void;
}) {
  return (
    <>
      <tr className={`border-b border-[var(--gray-200)] hover:bg-[var(--gray-100)] ${separador ? "border-t-2 border-t-[var(--gray-400)]" : ""} ${expandido ? "bg-[var(--gray-100)]" : ""}`}>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap font-semibold">{formatoFecha(revision.fecha)}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{formatoHora(revision.fecha)}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{revision.eco}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{unidad}</td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">
          <span className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-bold ${fallas === 0 ? "bg-[#dcf5e8] text-[#137a4a]" : "bg-[#fde4e0] text-[var(--red)]"}`}>
            {ok}/{total} {fallas === 0 ? "OK" : `· ${fallas} falla(s)`}
          </span>
        </td>
        <td className="px-3 py-2.5 text-[12.5px] whitespace-nowrap">{revision.realizado_por || "—"}</td>
        <td className="px-3 py-2.5 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onVer} className="text-[12px] font-bold text-[var(--blue)] hover:underline">
              {expandido ? "Ocultar" : "Ver"}
            </button>
            {puedeEliminar && (
              <button type="button" onClick={onEliminar} className="text-[var(--red)]" title="Eliminar revisión" aria-label="Eliminar revisión">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /></svg>
              </button>
            )}
          </div>
        </td>
      </tr>
      {expandido && (
        <tr className="bg-[var(--gray-100)] border-b border-[var(--gray-200)]">
          <td colSpan={7} className="px-3 pb-3 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5">
              {CHECKLIST_TODOS.map((bloque) => (
                <div key={bloque.titulo} className="bg-white border border-[var(--gray-200)] rounded-lg p-2.5">
                  <p className="text-[12px] font-bold text-[var(--navy)] m-0 mb-1.5">{bloque.titulo}</p>
                  <ul className="m-0 p-0 list-none space-y-1">
                    {bloque.items.map((item) => {
                      const v = revision.resultados?.[bloque.titulo]?.[item];
                      return (
                        <li key={item} className="flex items-start gap-1.5 text-[11px] leading-tight">
                          <span className={`font-bold ${v === undefined ? "text-[var(--gray-400)]" : v ? "text-[var(--green)]" : "text-[var(--red)]"}`}>
                            {v === undefined ? "–" : v ? "✓" : "✗"}
                          </span>
                          <span className="min-w-0 break-words">{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
            {revision.kilometraje != null && (
              <p className="text-[12px] text-[var(--text)] mt-2.5 mb-0">
                <b className="text-[var(--navy)]">Kilometraje:</b> {Number(revision.kilometraje).toLocaleString("es-MX")} km
              </p>
            )}
            {revision.observaciones && (
              <p className="text-[12px] text-[var(--text)] mt-2.5 mb-0 break-words">
                <b className="text-[var(--navy)]">Observaciones:</b> {revision.observaciones}
              </p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}