"use client";
import { useEffect, useRef, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { useRefrescarAlEnfocar } from "@/lib/useRefrescarAlEnfocar";
import { UMBRAL_ESTRATEGICO, UMBRAL_CONOCIMIENTO, VIDEO_MAX_BYTES, VIDEO_TAM_PARTE } from "@/lib/evaluacionCandidatosData";
import { analizarEmpleos, dinero, aNumero, type Empleo, type Credito } from "@/lib/evaluacionCandidatosAnalisis";

type Resumen = {
  id: number;
  puesto: string;
  nombre: string;
  edad: number | null;
  dictamen_auto: string;
  dictamen_final: string | null;
  puntaje_estrategico: number;
  max_estrategico: number;
  puntaje_conocimiento: number;
  max_conocimiento: number;
  criticos: number;
  created_at: string;
};
type Respuesta = { id: string; seccion: "estrategica" | "conocimiento"; categoria?: string; pregunta: string; respuesta: string; puntos: number; maximo: number; correcta?: string };
type Categoria = { nombre: string; seccion: "estrategica" | "conocimiento"; puntos: number; maximo: number; pct: number };
type PuntoCritico = { nivel: "critico" | "atencion"; texto: string };
type Evaluacion = Resumen & { datos: Record<string, any>; respuestas: Respuesta[]; observaciones: string | null; puntos_criticos: PuntoCritico[] | null; categorias: Categoria[] | null; foto: string | null };

const COLORES_LINEA = ["#f2b134", "#21a866", "#d6246e", "#2f6fed", "#8e44ad", "#16a3b8"];
const duracion = (m: number | null) => {
  if (m === null) return "—";
  const a = Math.floor(m / 12);
  const r = m % 12;
  return a ? `${a} año${a > 1 ? "s" : ""}${r ? ` ${r} m` : ""}` : `${r} mes${r === 1 ? "" : "es"}`;
};
const anioDe = (ym?: string) => (ym ? ym.slice(0, 4) : "");
const periodo = (e: Empleo) => `${anioDe(e.inicio) || "?"} – ${e.actual ? "actual" : anioDe(e.fin) || "?"}`;

// Resumen y análisis de la experiencia previa (texto para la pantalla y el PDF).
function analisisExperiencia(datos: Record<string, any>): string[] {
  if (datos?.primer_empleo === "Sí") return ["Declara que este sería su primer empleo; no hay trayectoria laboral que analizar."];
  const empleos: Empleo[] = Array.isArray(datos?.empleos) ? datos.empleos : [];
  if (!empleos.length) return ["No se capturó historial laboral."];
  const a = analizarEmpleos(empleos);
  const l: string[] = [];
  l.push(`Trayectoria de ${a.total} empleo(s) en aproximadamente ${a.aniosTrayectoria} años; permanencia promedio de ${duracion(a.promedioMeses)} y empleo más largo de ${duracion(a.masLargo)}.`);
  l.push(`${a.ultimos3} empleo(s) en los últimos 3 años${a.ultimos3 >= 4 ? " (alta rotación)" : a.ultimos3 === 3 ? " (rotación moderada)" : " (estable)"}.`);
  const huecos = a.huecos.filter((h) => h > 2);
  l.push(huecos.length ? `Periodos sin empleo de ${huecos.map((h) => `${h} meses`).join(", ")}.` : "Sin periodos relevantes sin empleo.");
  if (a.sueldoMax) {
    const esp = aNumero(datos.sueldo_esperado);
    l.push(`Último sueldo declarado ${dinero(a.sueldoUltimo)}, mayor sueldo ${dinero(a.sueldoMax)}${esp ? `; espera ${dinero(esp)} (${esp >= a.sueldoUltimo ? "+" : ""}${a.sueldoUltimo ? Math.round(((esp - a.sueldoUltimo) / a.sueldoUltimo) * 100) : 0}% vs. último)` : ""}.`);
  }
  l.push(`Referencias laborales en ${a.conReferencia} de ${a.total} empleo(s); ${datos.autoriza_referencias === "Sí" ? "autoriza" : "NO autoriza"} solicitar información a sus empleos anteriores.`);
  const motivos = empleos.filter((e) => (e.motivo || "").trim()).map((e) => `${e.empresa}: ${e.motivo}`);
  if (motivos.length) l.push(`Motivos de salida — ${motivos.join(" · ")}.`);
  return l;
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
const fecha = (iso: string) => new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const dictamenDe = (e: { dictamen_final: string | null; dictamen_auto: string }) => e.dictamen_final || e.dictamen_auto;
const colorPct = (p: number, umbral: number) => (p >= umbral ? "#21a866" : p >= umbral - 20 ? "#f2b134" : "#e2412c");
const umbralDe = (c: Categoria) => (c.seccion === "estrategica" ? UMBRAL_ESTRATEGICO : UMBRAL_CONOCIMIENTO);

const GRUPOS_DATOS: [string, [string, string][]][] = [
  [
    "Datos personales y familiares",
    [
      ["nombre", "Nombre"],
      ["edad", "Edad"],
      ["fecha_nacimiento", "Fecha de nacimiento"],
      ["lugar_nacimiento", "Lugar de nacimiento"],
      ["escolaridad", "Escolaridad"],
      ["telefono", "Teléfono"],
      ["correo", "Correo"],
      ["estado_civil", "Estado civil"],
      ["hijos", "Hijos"],
      ["personas_vive", "Personas con quien vive"],
      ["dependientes", "Dependientes económicos"],
      ["otro_ingreso", "Alguien más aporta en casa"],
    ],
  ],
  [
    "Vivienda y estilo de vida",
    [
      ["domicilio_actual", "Domicilio actual"],
      ["municipio", "Municipio"],
      ["tipo_vivienda", "Tipo de vivienda"],
      ["familiar", "Vive con / domicilio de"],
      ["pago_vivienda", "Renta o apoyo mensual"],
      ["tiempo_domicilio_actual", "Tiempo en domicilio actual"],
      ["domicilio_anterior", "Domicilio anterior"],
      ["tiempo_domicilio_anterior", "Tiempo en domicilio anterior"],
      ["renta_anterior", "Renta anterior"],
      ["tiene_transporte", "Transporte propio"],
      ["tipo_transporte", "Tipo de transporte"],
      ["vehiculo_modelo", "Vehículo"],
      ["vehiculo_valor", "Valor del vehículo"],
      ["vehiculo_pagado", "Situación del vehículo"],
      ["gastos_mensuales", "Gastos mensuales del hogar"],
      ["traslado", "Traslado a la empresa"],
      ["creditos", "Créditos activos"],
      ["creditos_detalle", "Detalle de créditos"],
      ["sueldo_esperado", "Sueldo esperado"],
    ],
  ],
  [
    "Licencia y experiencia de manejo",
    [
      ["licencia_tipo", "Licencia"],
      ["licencia_vigencia", "Vigencia de licencia"],
      ["psicofisico", "Examen psicofísico"],
      ["anios_experiencia", "Años de experiencia"],
      ["unidades", "Unidades que ha manejado"],
      ["rutas_conocidas", "Rutas recorridas"],
      ["ultimo_empleo", "Último empleo"],
      ["tiempo_ultimo_empleo", "Tiempo en último empleo"],
      ["motivo_salida", "Motivo de salida"],
      ["empleos_3_anios", "Empleos en 3 años"],
      ["autoriza_referencias", "Autoriza pedir referencias"],
    ],
  ],
  [
    "Salud, legal y seguridad",
    [
      ["condicion_salud", "Condición de salud"],
      ["salud_detalle", "Detalle de salud"],
      ["proceso_legal", "Asunto legal pendiente"],
      ["legal_detalle", "Detalle legal"],
      ["accidentes", "Accidentes (3 años)"],
      ["accidentes_detalle", "Detalle de accidentes"],
      ["robo_ruta", "Robo en ruta"],
      ["robo_detalle", "Detalle de robo"],
      ["robo_veces", "Veces que lo ha vivido"],
      ["robo_fecha_lugar", "Cuándo y dónde"],
      ["robo_modus", "Cómo ocurrió"],
      ["robo_relato", "Relato"],
      ["robo_observacion", "Detalles que recuerda"],
      ["robo_reaccion", "Cómo reaccionó"],
      ["robo_aviso", "Avisó a la empresa y denunció"],
      ["carta_antecedentes", "Puede tramitar carta de no antecedentes"],
      ["acepta_aviso", "Aceptó aviso de antidoping y examen médico"],
    ],
  ],
];
const valorDato = (datos: Record<string, any>, k: string) => {
  const v = datos?.[k];
  return typeof v === "string" || typeof v === "number" ? String(v).trim() : "";
};
const textoCreditos = (datos: Record<string, any>) =>
  (Array.isArray(datos?.creditos_lista) ? (datos.creditos_lista as Credito[]) : [])
    .map((c) => `${c.tipo}: ${c.pago_mensual ? `${dinero(aNumero(c.pago_mensual))}/mes` : "sin monto"}${c.saldo ? `, saldo ${dinero(aNumero(c.saldo))}` : ""}`)
    .join(" · ");

export default function EvaluacionesCandidatosPage() {
  const [lista, setLista] = useState<Resumen[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState("");
  const [abierta, setAbierta] = useState<Evaluacion | null>(null);
  const [dictamenFinal, setDictamenFinal] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [generando, setGenerando] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Video de inducción
  const [induccion, setInduccion] = useState<{ nombre: string | null; partes: number; updated_at: string | null }>({ nombre: null, partes: 0, updated_at: null });
  const [induccionAbierta, setInduccionAbierta] = useState(false);
  const [subiendo, setSubiendo] = useState("");
  // Configuración (zonas rojas y rango de edad)
  const [configAbierta, setConfigAbierta] = useState(false);
  const [zonasTexto, setZonasTexto] = useState("");
  const [edadMin, setEdadMin] = useState("23");
  const [edadMax, setEdadMax] = useState("55");
  const [guardandoConfig, setGuardandoConfig] = useState(false);

  const abrirConfig = () => {
    setConfigAbierta(true);
    fetch("/api/evaluacion-candidatos/config", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setZonasTexto((d.zonas_rojas || []).join("\n"));
        setEdadMin(String(d.edad_min ?? 23));
        setEdadMax(String(d.edad_max ?? 55));
      })
      .catch(() => {});
  };
  const guardarConfig = async () => {
    setGuardandoConfig(true);
    try {
      const r = await fetch("/api/evaluacion-candidatos/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zonas_rojas: zonasTexto.split(/\n|,/).map((z) => z.trim()).filter(Boolean), edad_min: Number(edadMin), edad_max: Number(edadMax) }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setConfigAbierta(false);
    } catch (err: any) {
      alert(err.message || "No se pudo guardar la configuración.");
    } finally {
      setGuardandoConfig(false);
    }
  };

  const cargar = () =>
    fetch("/api/evaluacion-candidatos", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLista(d.evaluaciones || []))
      .catch(() => {})
      .finally(() => setCargando(false));
  const cargarInduccion = () =>
    fetch("/api/evaluacion-candidatos/induccion", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setInduccion({ nombre: d.nombre || null, partes: d.partes || 0, updated_at: d.updated_at || null }))
      .catch(() => {});
  useEffect(() => {
    cargar();
    cargarInduccion();
  }, []);
  useRefrescarAlEnfocar(cargar);

  const subirInduccion = async (f: File | null) => {
    if (!f) return;
    if (f.type !== "video/mp4" && !f.name.toLowerCase().endsWith(".mp4")) return alert("El video debe estar en formato MP4.");
    if (f.size > VIDEO_MAX_BYTES) return alert(`El video pesa ${(f.size / 1048576).toFixed(1)} MB; el máximo es ${VIDEO_MAX_BYTES / 1048576} MB.`);
    try {
      setSubiendo("Preparando video…");
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(",")[1] || "");
        r.onerror = () => rej(new Error("No se pudo leer el video."));
        r.readAsDataURL(f);
      });
      const total = Math.ceil(b64.length / VIDEO_TAM_PARTE);
      for (let i = 0; i < total; i++) {
        setSubiendo(`Subiendo ${Math.round(((i + 1) / total) * 100)}%`);
        const r = await fetch("/api/evaluacion-candidatos/induccion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ indice: i, total, nombre: f.name, contenido: b64.slice(i * VIDEO_TAM_PARTE, (i + 1) * VIDEO_TAM_PARTE) }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(d.error || "Error de red al subir el video.");
        }
      }
      await cargarInduccion();
    } catch (err: any) {
      alert(err.message || "No se pudo subir el video.");
    } finally {
      setSubiendo("");
    }
  };
  const eliminarInduccion = async () => {
    if (!confirm("¿Quitar el video de inducción? Los candidatos ya no lo verán.")) return;
    await fetch("/api/evaluacion-candidatos/induccion/eliminar", { method: "POST" });
    cargarInduccion();
  };

  const abrir = async (id: number) => {
    try {
      const r = await fetch(`/api/evaluacion-candidatos/get?id=${id}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAbierta(d.evaluacion);
      setDictamenFinal(d.evaluacion.dictamen_final || "");
      setObservaciones(d.evaluacion.observaciones || "");
    } catch (err: any) {
      alert(err.message || "No se pudo abrir la evaluación.");
    }
  };

  const guardarDictamen = async () => {
    if (!abierta) return;
    setGuardando(true);
    try {
      const r = await fetch("/api/evaluacion-candidatos/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: abierta.id, dictamen_final: dictamenFinal, observaciones }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setAbierta({ ...abierta, dictamen_final: dictamenFinal || null, observaciones });
      cargar();
    } catch (err: any) {
      alert(err.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!abierta || !confirm(`¿Eliminar la evaluación de ${abierta.nombre}? Esta acción no se puede deshacer.`)) return;
    const r = await fetch("/api/evaluacion-candidatos/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: abierta.id }) });
    if (!r.ok) return alert("No se pudo eliminar.");
    setAbierta(null);
    cargar();
  };

  // ---- PDF de resultado (mismo estilo que la Responsiva de uniformes) con puntos críticos y gráficas ----
  const generarPdf = async () => {
    if (!abierta) return;
    const ev: Evaluacion = { ...abierta, dictamen_final: dictamenFinal || null, observaciones };
    setGenerando(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "letter" });
      const W = 612;
      const mX = 48;
      const ancho = W - mX * 2;
      let y = 50;
      const saltoSi = (alto: number) => {
        if (y + alto > 750) {
          doc.addPage();
          y = 60;
        }
      };
      const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
      const titulo = (t: string) => {
        saltoSi(40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(22, 33, 92);
        doc.text(t, mX, y);
        y += 10;
      };
      const encabezado = (a: string, b: string, xB: number) => {
        doc.setFillColor(22, 33, 92);
        doc.rect(mX, y, ancho, 20, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(a, mX + 10, y + 14);
        doc.text(b, mX + xB, y + 14, xB > ancho - 60 ? { align: "right" } : undefined);
        y += 20;
      };

      // Encabezado
      const logo = await fetch("/logo-transportes.png")
        .then((r) => r.blob())
        .then((b) => new Promise<string>((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result as string); fr.readAsDataURL(b); }));
      doc.addImage(logo, "PNG", mX, y - 14, 32, 32);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(20, 20, 20);
      doc.text("TRANSPORTES LOGISTICAR", mX + 42, y + 6);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(47, 111, 237);
      doc.text(new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" }), W - mX, y + 6, { align: "right" });
      y += 44;
      doc.setDrawColor(229, 232, 238);
      doc.line(mX, y, W - mX, y);
      y += 26;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(22, 33, 92);
      doc.text("Resultado de evaluación de candidato", mX, y);
      y += 18;
      doc.setFontSize(10);
      doc.setTextColor(90, 90, 90);
      doc.text(`${ev.nombre}  ·  Puesto: ${ev.puesto}  ·  ${fecha(ev.created_at)}  ·  Folio EVC-${String(ev.id).padStart(4, "0")}`, mX, y);
      if (ev.foto) {
        try {
          doc.addImage(ev.foto, "JPEG", W - mX - 64, y - 42, 64, 64);
          doc.setDrawColor(229, 232, 238);
          doc.rect(W - mX - 64, y - 42, 64, 64);
        } catch {}
        y += 28;
      }
      y += 18;

      // Dictamen
      const dict = dictamenDe(ev);
      const apto = dict === "Apto";
      const cDict = hex(apto ? "#21a866" : "#e2412c");
      doc.setFillColor(...hex(apto ? "#e3f6ec" : "#fdeae7"));
      doc.setDrawColor(...cDict);
      doc.roundedRect(mX, y, ancho, 44, 6, 6, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.setTextColor(...cDict);
      doc.text(`DICTAMEN: ${dict.toUpperCase()}`, mX + 16, y + 27);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90, 90, 90);
      doc.text(ev.dictamen_final ? `Dictamen del evaluador (automático: ${ev.dictamen_auto})` : "Dictamen automático según puntaje y puntos críticos", W - mX - 14, y + 27, { align: "right" });
      y += 62;

      // Gráfica 1: resultados globales (dos barras grandes)
      titulo("Resultado general");
      y += 6;
      const pE = pct(ev.puntaje_estrategico, ev.max_estrategico);
      const pC = pct(ev.puntaje_conocimiento, ev.max_conocimiento);
      const barra = (etiqueta: string, valor: number, umbral: number, alto: number, anchoEt: number) => {
        const x0 = mX + anchoEt;
        const largo = ancho - anchoEt - 40;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 30, 30);
        doc.text(etiqueta, mX, y + alto / 2 + 3);
        doc.setFillColor(238, 241, 246);
        doc.rect(x0, y, largo, alto, "F");
        doc.setFillColor(...hex(colorPct(valor, umbral)));
        if (valor > 0) doc.rect(x0, y, (largo * valor) / 100, alto, "F");
        doc.setDrawColor(22, 33, 92);
        doc.setLineDashPattern([2, 2], 0);
        const xu = x0 + (largo * umbral) / 100;
        doc.line(xu, y - 3, xu, y + alto + 3);
        doc.setLineDashPattern([], 0);
        doc.setFont("helvetica", "bold");
        doc.text(`${valor}%`, x0 + largo + 6, y + alto / 2 + 3);
        y += alto + 8;
      };
      barra("Perfil (día a día)", pE, UMBRAL_ESTRATEGICO, 16, 150);
      barra("Conocimientos", pC, UMBRAL_CONOCIMIENTO, 16, 150);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Línea punteada = mínimo requerido (perfil ${UMBRAL_ESTRATEGICO}%, conocimientos ${UMBRAL_CONOCIMIENTO}%).`, mX, y + 2);
      y += 18;

      // Gráfica 2: desempeño por competencia
      const cats = ev.categorias || [];
      if (cats.length) {
        titulo("Desempeño por competencia");
        y += 6;
        cats.forEach((c) => {
          saltoSi(20);
          barra(c.nombre, c.pct, umbralDe(c), 11, 150);
        });
        y += 8;
      }

      // Puntos críticos
      const pcs = ev.puntos_criticos || [];
      titulo(`Puntos críticos del perfil (${pcs.filter((p) => p.nivel === "critico").length} críticos, ${pcs.filter((p) => p.nivel === "atencion").length} de atención)`);
      y += 6;
      if (!pcs.length) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(33, 168, 102);
        doc.text("No se detectaron puntos críticos.", mX, y + 6);
        y += 20;
      }
      pcs.forEach((p) => {
        const lt = doc.splitTextToSize(p.texto, ancho - 90);
        const alto = lt.length * 12 + 8;
        saltoSi(alto);
        const col = hex(p.nivel === "critico" ? "#e2412c" : "#f2b134");
        doc.setFillColor(...col);
        doc.roundedRect(mX, y + 2, 66, 14, 3, 3, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(p.nivel === "critico" ? "CRÍTICO" : "ATENCIÓN", mX + 33, y + 12, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9.5);
        doc.setTextColor(30, 30, 30);
        doc.text(lt, mX + 78, y + 12);
        y += alto;
      });
      y += 10;

      if (ev.observaciones?.trim()) {
        const lo = doc.splitTextToSize(ev.observaciones.trim(), ancho);
        titulo("Observaciones del evaluador");
        y += 6;
        saltoSi(lo.length * 13);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(30, 30, 30);
        doc.text(lo, mX, y + 4);
        y += lo.length * 13 + 14;
      }

      // Línea de tiempo laboral (camino con pines, estilo infografía)
      const empleosPdf = analizarEmpleos(Array.isArray(ev.datos?.empleos) ? ev.datos.empleos : []).lista.slice(-6);
      if (empleosPdf.length) {
        saltoSi(270);
        titulo("Línea de tiempo laboral");
        const n = empleosPdf.length;
        const anchoEt = n > 1 ? Math.min(130, ancho / n - 6) : 160;
        const x0 = mX + 16;
        const x1 = W - mX - anchoEt + 14;
        const base = y + 228;
        const sube = n > 1 ? Math.min(28, 110 / (n - 1)) : 0;
        const pts = empleosPdf.map((_, i) => ({ x: n > 1 ? x0 + ((x1 - x0) * i) / (n - 1) : (x0 + x1) / 2, y: base - i * sube }));
        // Camino
        doc.setDrawColor(222, 226, 233);
        doc.setLineWidth(16);
        doc.setLineCap("round");
        doc.setLineJoin("round");
        const camino = [{ x: mX, y: base + 12 }, ...pts, { x: W - mX, y: (pts[pts.length - 1]?.y ?? base) - 10 }];
        for (let i = 1; i < camino.length; i++) doc.line(camino[i - 1].x, camino[i - 1].y, camino[i].x, camino[i].y);
        doc.setDrawColor(255, 255, 255);
        doc.setLineWidth(1.2);
        doc.setLineDashPattern([5, 4], 0);
        for (let i = 1; i < camino.length; i++) doc.line(camino[i - 1].x, camino[i - 1].y, camino[i].x, camino[i].y);
        doc.setLineDashPattern([], 0);
        doc.setLineWidth(1);
        empleosPdf.forEach((e, i) => {
          const c = hex(COLORES_LINEA[i % COLORES_LINEA.length]);
          const p = pts[i];
          const cy = p.y - 46;
          // sombra, poste y pin
          doc.setFillColor(200, 204, 212);
          doc.ellipse(p.x, p.y, 7, 2.5, "F");
          doc.setDrawColor(...c);
          doc.setLineWidth(2);
          doc.line(p.x, p.y, p.x, cy + 14);
          doc.setLineWidth(1);
          doc.setFillColor(...c);
          doc.circle(p.x, cy, 15, "F");
          doc.setFillColor(255, 255, 255);
          doc.circle(p.x, cy, 9, "F");
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(...c);
          doc.text(String(i + 1), p.x, cy + 3.2, { align: "center" });
          // Etiqueta: triángulo + periodo, empresa, puesto, duración y subrayado de color
          let ty = cy - 70;
          const tx = Math.max(mX, p.x - 14);
          doc.setFillColor(...c);
          doc.triangle(tx, ty - 7, tx, ty + 1, tx + 6, ty - 3, "F");
          doc.setFontSize(10);
          doc.setTextColor(30, 30, 30);
          doc.text(periodo(e), tx + 9, ty);
          ty += 11;
          doc.setFontSize(8);
          const lineas = [
            ...doc.splitTextToSize(e.empresa || "—", anchoEt).slice(0, 2),
            ...doc.splitTextToSize(e.puesto || "", anchoEt).slice(0, 1),
            `${duracion(e.meses)}${e.sueldoN ? ` · ${dinero(e.sueldoN)}` : ""}`,
          ];
          lineas.forEach((t: string, k: number) => {
            doc.setFont("helvetica", k === 0 ? "bold" : "normal");
            doc.setTextColor(k === 0 ? 30 : 100, k === 0 ? 30 : 100, k === 0 ? 30 : 100);
            doc.text(t, tx, ty);
            ty += 9.5;
          });
          doc.setDrawColor(...c);
          doc.setLineWidth(1.5);
          doc.line(tx, ty - 5, tx + anchoEt * 0.85, ty - 5);
          doc.setLineWidth(1);
        });
        y = base + 30;
      }

      // Resumen y análisis de la experiencia previa
      const analisis = analisisExperiencia(ev.datos);
      titulo("Resumen y análisis de experiencia previa");
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      analisis.forEach((t) => {
        const lt = doc.splitTextToSize(`• ${t}`, ancho);
        saltoSi(lt.length * 12 + 4);
        doc.text(lt, mX, y + 4);
        y += lt.length * 12 + 3;
      });
      const credTxt = textoCreditos(ev.datos);
      if (credTxt) {
        const lt = doc.splitTextToSize(`• Créditos: ${credTxt}.`, ancho);
        saltoSi(lt.length * 12 + 4);
        doc.text(lt, mX, y + 4);
        y += lt.length * 12 + 3;
      }
      y += 12;

      // Datos del candidato
      GRUPOS_DATOS.forEach(([grupo, campos]) => {
        const filas = campos.filter(([k]) => valorDato(ev.datos, k));
        if (!filas.length) return;
        saltoSi(60);
        y += 6;
        encabezado(grupo.toUpperCase(), "", 190);
        filas.forEach(([k, et], idx) => {
          const lineas = doc.splitTextToSize(valorDato(ev.datos, k), ancho - 200);
          const alto = Math.max(20, lineas.length * 12 + 8);
          saltoSi(alto);
          if (idx % 2 === 1) {
            doc.setFillColor(244, 245, 248);
            doc.rect(mX, y, ancho, alto, "F");
          }
          doc.setFont("helvetica", "normal");
          doc.setFontSize(9.5);
          doc.setTextColor(90, 90, 90);
          doc.text(et, mX + 10, y + 13);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 30, 30);
          doc.text(lineas, mX + 190, y + 13);
          y += alto;
        });
        y += 8;
      });
      y += 10;

      // Detalle de respuestas
      const bloque = (t: string, seccion: Respuesta["seccion"]) => {
        const items = (ev.respuestas || []).filter((r) => r.seccion === seccion);
        if (!items.length) return;
        titulo(t);
        encabezado("PREGUNTA / RESPUESTA", "PTS", ancho - 12);
        items.forEach((r, idx) => {
          const lp = doc.splitTextToSize(`${idx + 1}. ${r.pregunta}`, ancho - 60);
          const lr = doc.splitTextToSize(`R: ${r.respuesta}`, ancho - 60);
          const lc = seccion === "conocimiento" && r.puntos === 0 && r.correcta ? doc.splitTextToSize(`Correcta: ${r.correcta}`, ancho - 60) : [];
          const alto = (lp.length + lr.length + lc.length) * 11.5 + 10;
          saltoSi(alto);
          if (idx % 2 === 1) {
            doc.setFillColor(244, 245, 248);
            doc.rect(mX, y, ancho, alto, "F");
          }
          let yy = y + 13;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);
          doc.setTextColor(30, 30, 30);
          doc.text(lp, mX + 10, yy);
          yy += lp.length * 11.5;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(60, 60, 60);
          doc.text(lr, mX + 10, yy);
          yy += lr.length * 11.5;
          if (lc.length) {
            doc.setTextColor(33, 168, 102);
            doc.text(lc, mX + 10, yy);
          }
          doc.setFont("helvetica", "bold");
          doc.setFontSize(10);
          doc.setTextColor(...hex(r.puntos === r.maximo ? "#21a866" : r.puntos === 0 ? "#e2412c" : "#b48214"));
          doc.text(`${r.puntos}/${r.maximo}`, W - mX - 12, y + 13, { align: "right" });
          y += alto;
        });
        y += 18;
      };
      bloque("Detalle — Perfil (día a día)", "estrategica");
      bloque("Detalle — Mecánica, rutas y manejo defensivo", "conocimiento");

      // Firmas
      saltoSi(70);
      y += 30;
      doc.setDrawColor(60, 60, 60);
      doc.line(mX, y, mX + 190, y);
      doc.line(340, y, 340 + 190, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(30, 30, 30);
      doc.text("Evaluó (Recursos Humanos)", mX + 95, y + 16, { align: "center" });
      doc.text("Vo. Bo. Jefe directo", 340 + 95, y + 16, { align: "center" });

      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(doc.output("blob")));
    } catch (err: any) {
      alert(err.message || "No se pudo generar el PDF.");
    } finally {
      setGenerando(false);
    }
  };

  const imprimirPdf = () => {
    const w = iframeRef.current?.contentWindow;
    if (w) {
      w.focus();
      w.print();
    }
  };
  const descargarPdf = () => {
    if (!pdfUrl || !abierta) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `Evaluacion_${abierta.nombre.replace(/\s+/g, "_")}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const visibles = lista.filter((e) => `${e.nombre} ${e.puesto}`.toLowerCase().includes(filtro.toLowerCase()));
  const Barra = ({ etiqueta, valor, umbral }: { etiqueta: string; valor: number; umbral: number }) => (
    <div className="grid grid-cols-[150px_1fr_40px] items-center gap-2 text-[12px]">
      <span className="text-[var(--navy)] font-semibold truncate" title={etiqueta}>{etiqueta}</span>
      <div className="relative h-3 bg-[#eef1f6] rounded">
        <div className="h-3 rounded" style={{ width: `${valor}%`, background: colorPct(valor, umbral) }} />
        <div className="absolute -top-1 -bottom-1 border-l-2 border-dashed border-[var(--navy)]" style={{ left: `${umbral}%` }} />
      </div>
      <b className="text-right">{valor}%</b>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#eef1f6] pb-12">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-10 lg:px-14 pt-6 md:pt-10">
        <PageHeader
          titulo="Evaluaciones de candidatos"
          subtitulo="Consulta las evaluaciones enviadas y genera el resultado."
          backHref="/personas"
          backLabel="Personas"
          icono={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2f6fed" strokeWidth="2"><path d="M9 11l3 3 8-8" /><path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V5a2 2 0 012-2h9" /></svg>}
        />

        <div className="flex flex-wrap gap-2.5 mb-5">
          <button type="button" onClick={() => setInduccionAbierta(true)} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="15" height="14" rx="2" /><path d="M17 10l5-3v10l-5-3z" /></svg>
            Video de inducción {induccion.partes > 0 ? "✓" : ""}
          </button>
          <button type="button" onClick={abrirConfig} className="flex items-center gap-2 bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16215c" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
            Configuración (zonas rojas y edad)
          </button>
        </div>

        <div className="bg-white rounded-[18px] p-4 sm:p-6 md:p-8 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <p className="text-[13px] text-[var(--gray-400)] m-0">
              {lista.length} evaluación(es) · <span className="text-[var(--green)] font-bold">{lista.filter((e) => dictamenDe(e) === "Apto").length} aptos</span>
            </p>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar por nombre o puesto…" className="border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] w-full sm:w-[280px]" />
          </div>

          {cargando ? (
            <p className="text-[13px] text-[var(--gray-400)]">Cargando…</p>
          ) : visibles.length === 0 ? (
            <p className="text-[13px] text-[var(--gray-400)]">Aún no hay evaluaciones enviadas.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {visibles.map((e) => {
                const apto = dictamenDe(e) === "Apto";
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => abrir(e.id)}
                    className={`text-left rounded-xl border px-3.5 py-2.5 bg-white hover:shadow-md transition-shadow ${apto ? "border-[#bfe8d2]" : "border-[#f6c9c1]"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${apto ? "bg-[var(--green)]" : "bg-[var(--red)]"}`} />
                      <span className="text-[13px] font-bold text-[var(--navy)]">{e.nombre}</span>
                      {e.criticos > 0 && <span className="text-[10.5px] font-bold text-white bg-[var(--red)] rounded-full px-1.5">⚠ {e.criticos}</span>}
                    </div>
                    <p className="text-[11.5px] text-[var(--gray-400)] m-0 mt-0.5">
                      {e.puesto} · {fecha(e.created_at)} · <b className={apto ? "text-[var(--green)]" : "text-[var(--red)]"}>{dictamenDe(e)}</b>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {configAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-40">
          <div className="bg-white rounded-2xl w-[560px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-1">Configuración de la evaluación</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">Se aplica a las evaluaciones que se envíen a partir de ahora; genera alertas en el reporte.</p>
            <label className="block text-[13px] font-bold text-[var(--navy)] mb-1.5">Municipios o alcaldías en zona roja (uno por renglón)</label>
            <textarea value={zonasTexto} onChange={(e) => setZonasTexto(e.target.value)} rows={8} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px] mb-4" placeholder={"Ej.\nEcatepec de Morelos\nNezahualcóyotl"} />
            <label className="block text-[13px] font-bold text-[var(--navy)] mb-1.5">Rango de edad aceptado</label>
            <div className="flex items-center gap-2 mb-2">
              <input type="number" min={16} max={99} value={edadMin} onChange={(e) => setEdadMin(e.target.value)} className="w-24 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              <span className="text-[13px]">a</span>
              <input type="number" min={16} max={99} value={edadMax} onChange={(e) => setEdadMax(e.target.value)} className="w-24 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              <span className="text-[13px]">años</span>
            </div>
            <div className="flex justify-end gap-2.5 mt-6">
              <button type="button" onClick={() => setConfigAbierta(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cancelar
              </button>
              <button type="button" onClick={guardarConfig} disabled={guardandoConfig} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                {guardandoConfig ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {induccionAbierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 overflow-y-auto z-40">
          <div className="bg-white rounded-2xl w-[520px] max-w-[92%] p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-1">Video de inducción</h3>
            <p className="text-[12.5px] text-[var(--gray-400)] mb-4">Lo verá el candidato al abrir la evaluación. Formato MP4, máximo {VIDEO_MAX_BYTES / 1048576} MB.</p>
            <p className="text-[13px] mb-4">
              {induccion.partes > 0 ? (
                <>
                  Video actual: <b>{induccion.nombre}</b>
                  {induccion.updated_at ? ` · ${fecha(induccion.updated_at)}` : ""}
                </>
              ) : (
                "No hay video cargado."
              )}
            </p>
            {subiendo ? (
              <p className="text-[13px] text-[var(--blue)] font-semibold">{subiendo}</p>
            ) : (
              <label className="inline-block bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold cursor-pointer">
                {induccion.partes > 0 ? "Reemplazar video" : "Subir video"}
                <input type="file" accept="video/mp4,.mp4" className="hidden" onChange={(e) => { subirInduccion(e.target.files?.[0] || null); e.target.value = ""; }} />
              </label>
            )}
            <div className="flex justify-between mt-6">
              {induccion.partes > 0 && !subiendo ? (
                <button type="button" onClick={eliminarInduccion} className="text-[var(--red)] border border-[#f6c9c1] rounded-lg px-4 py-2.5 text-[13px] font-bold">
                  Quitar video
                </button>
              ) : (
                <span />
              )}
              <button type="button" disabled={!!subiendo} onClick={() => setInduccionAbierta(false)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {abierta && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-8 overflow-y-auto z-40">
          <div className="bg-white rounded-2xl w-[900px] max-w-[94%] p-5 sm:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <div className="flex flex-wrap justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                {abierta.foto && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={abierta.foto} alt={abierta.nombre} className="w-16 h-16 rounded-full object-cover border border-[var(--gray-200)]" />
                )}
                <div>
                <h3 className="text-[17px] font-bold text-[var(--navy)] m-0">{abierta.nombre}</h3>
                <p className="text-[12.5px] text-[var(--gray-400)] m-0">
                  {abierta.puesto} · {fecha(abierta.created_at)} · Folio EVC-{String(abierta.id).padStart(4, "0")}
                </p>
                </div>
              </div>
              <span className={`self-start rounded-lg px-3 py-1.5 text-[13px] font-bold text-white ${dictamenDe({ dictamen_final: dictamenFinal || null, dictamen_auto: abierta.dictamen_auto }) === "Apto" ? "bg-[var(--green)]" : "bg-[var(--red)]"}`}>
                {dictamenDe({ dictamen_final: dictamenFinal || null, dictamen_auto: abierta.dictamen_auto })}
              </span>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-5">
              <div className="border border-[var(--gray-200)] rounded-xl p-4 grid gap-2">
                <h4 className="text-[13.5px] font-bold text-[var(--navy)] m-0 mb-1">Resultados</h4>
                <Barra etiqueta="Perfil (día a día)" valor={pct(abierta.puntaje_estrategico, abierta.max_estrategico)} umbral={UMBRAL_ESTRATEGICO} />
                <Barra etiqueta="Conocimientos" valor={pct(abierta.puntaje_conocimiento, abierta.max_conocimiento)} umbral={UMBRAL_CONOCIMIENTO} />
                {(abierta.categorias || []).length > 0 && <div className="border-t border-[var(--gray-200)] my-1" />}
                {(abierta.categorias || []).map((c) => (
                  <Barra key={c.nombre} etiqueta={c.nombre} valor={c.pct} umbral={umbralDe(c)} />
                ))}
              </div>
              <div className="border border-[var(--gray-200)] rounded-xl p-4">
                <h4 className="text-[13.5px] font-bold text-[var(--navy)] m-0 mb-2">Puntos críticos</h4>
                {(abierta.puntos_criticos || []).length === 0 ? (
                  <p className="text-[12.5px] text-[var(--green)] m-0">No se detectaron puntos críticos.</p>
                ) : (
                  <div className="grid gap-1.5 max-h-[260px] overflow-y-auto">
                    {(abierta.puntos_criticos || []).map((p, i) => (
                      <div key={i} className="flex gap-2 items-start text-[12px]">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-white ${p.nivel === "critico" ? "bg-[var(--red)]" : "bg-[var(--amber)]"}`}>
                          {p.nivel === "critico" ? "CRÍTICO" : "ATENCIÓN"}
                        </span>
                        <span>{p.texto}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border border-[var(--gray-200)] rounded-xl p-4 mb-5">
              <h4 className="text-[13.5px] font-bold text-[var(--navy)] m-0 mb-3">Experiencia laboral</h4>
              {(() => {
                const lista = analizarEmpleos(Array.isArray(abierta.datos?.empleos) ? abierta.datos.empleos : []).lista;
                return lista.length ? (
                  <div className="flex gap-0 overflow-x-auto pb-2 mb-3">
                    {lista.map((e, i) => {
                      const color = COLORES_LINEA[i % COLORES_LINEA.length];
                      return (
                        <div key={i} className="min-w-[170px] flex-1">
                          <div className="flex items-center">
                            <span className="w-7 h-7 rounded-full text-white text-[12px] font-bold flex items-center justify-center shrink-0" style={{ background: color }}>{i + 1}</span>
                            <span className="h-1.5 flex-1 bg-[var(--gray-200)]" />
                          </div>
                          <div className="pr-3 mt-2 text-[12px]">
                            <p className="m-0 font-bold" style={{ color }}>{periodo(e)}</p>
                            <p className="m-0 font-bold text-[var(--navy)]">{e.empresa}</p>
                            <p className="m-0 text-[var(--gray-400)]">{e.puesto}</p>
                            <p className="m-0 text-[var(--gray-400)]">{duracion(e.meses)}{e.sueldoN ? ` · ${dinero(e.sueldoN)}` : ""}</p>
                            {e.motivo && <p className="m-0 text-[11.5px]">Salida: {e.motivo}</p>}
                            {e.ref_nombre && <p className="m-0 text-[11.5px] text-[var(--blue)]">Ref.: {e.ref_nombre} {e.ref_telefono}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null;
              })()}
              <ul className="m-0 pl-5 text-[12.5px] grid gap-1">
                {analisisExperiencia(abierta.datos).map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
                {textoCreditos(abierta.datos) && <li>Créditos: {textoCreditos(abierta.datos)}.</li>}
              </ul>
            </div>

            {GRUPOS_DATOS.map(([grupo, campos]) => {
              const filas = campos.filter(([k]) => valorDato(abierta.datos, k));
              if (!filas.length) return null;
              return (
                <div key={grupo} className="mb-4">
                  <h4 className="text-[13.5px] font-bold text-[var(--navy)] mb-2">{grupo}</h4>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5 text-[12.5px]">
                    {filas.map(([k, et]) => (
                      <div key={k}>
                        <span className="text-[var(--gray-400)]">{et}: </span>
                        <b>{valorDato(abierta.datos, k)}</b>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {(["estrategica", "conocimiento"] as const).map((sec) => (
              <div key={sec} className="mb-5">
                <h4 className="text-[13.5px] font-bold text-[var(--navy)] mb-2">{sec === "estrategica" ? "Perfil (día a día)" : "Mecánica, rutas y manejo defensivo"}</h4>
                <div className="grid gap-1.5">
                  {abierta.respuestas
                    .filter((r) => r.seccion === sec)
                    .map((r, i) => {
                      const color = r.puntos === r.maximo ? "text-[var(--green)]" : r.puntos === 0 ? "text-[var(--red)]" : "text-[var(--amber)]";
                      return (
                        <div key={r.id} className="flex gap-3 border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[12.5px]">
                          <div className="flex-1">
                            <p className="m-0 font-semibold">
                              {i + 1}. {r.pregunta} {r.categoria && <span className="text-[10.5px] text-[var(--blue)] font-bold">· {r.categoria}</span>}
                            </p>
                            <p className="m-0 text-[var(--gray-400)]">R: {r.respuesta}</p>
                            {sec === "conocimiento" && r.puntos === 0 && r.correcta && <p className="m-0 text-[var(--green)]">Correcta: {r.correcta}</p>}
                          </div>
                          <b className={`${color} shrink-0`}>{r.puntos}/{r.maximo}</b>
                        </div>
                      );
                    })}
                </div>
              </div>
            ))}

            <div className="border-t border-[var(--gray-200)] pt-4 grid sm:grid-cols-[220px_1fr] gap-4">
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Dictamen</label>
                <select value={dictamenFinal} onChange={(e) => setDictamenFinal(e.target.value)} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2.5 text-[13px]">
                  <option value="">Automático ({abierta.dictamen_auto})</option>
                  <option value="Apto">Apto</option>
                  <option value="No apto">No apto</option>
                </select>
              </div>
              <div>
                <label className="block text-[12.5px] font-bold text-[var(--navy)] mb-1.5">Observaciones del evaluador</label>
                <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} rows={2} maxLength={2000} className="w-full border border-[var(--gray-200)] rounded-lg px-3 py-2 text-[13px]" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 justify-between mt-5">
              <button type="button" onClick={eliminar} className="text-[var(--red)] border border-[#f6c9c1] rounded-lg px-4 py-2.5 text-[13px] font-bold">
                Eliminar
              </button>
              <div className="flex flex-wrap gap-2.5">
                <button type="button" onClick={() => setAbierta(null)} className="bg-white text-[var(--gray-400)] border border-[var(--gray-200)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  Cerrar
                </button>
                <button type="button" onClick={guardarDictamen} disabled={guardando} className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  {guardando ? "Guardando…" : "Guardar dictamen"}
                </button>
                <button type="button" onClick={generarPdf} disabled={generando} className="bg-[var(--navy)] disabled:opacity-60 text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                  {generando ? "Generando…" : "Previsualizar resultado"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {pdfUrl && (
        <div className="fixed inset-0 bg-[rgba(22,33,92,0.45)] flex items-start justify-center py-10 z-50">
          <div className="bg-white rounded-2xl w-[720px] max-w-[94%] p-4 sm:p-6 md:p-7 shadow-[0_1px_3px_rgba(22,33,92,0.06)]">
            <h3 className="text-[17px] font-bold text-[var(--navy)] mb-4">Previsualización — Resultado de evaluación</h3>
            <iframe ref={iframeRef} src={pdfUrl} className="w-full h-[560px] border border-[var(--gray-200)] rounded-lg" />
            <div className="flex gap-2.5 justify-end mt-4 flex-wrap">
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
              <button type="button" onClick={descargarPdf} className="bg-white text-[var(--navy)] border border-[var(--navy)] rounded-lg px-5 py-2.5 text-[13px] font-bold">
                Descargar PDF
              </button>
              <button type="button" onClick={imprimirPdf} className="flex items-center gap-2 bg-[var(--navy)] text-white rounded-lg px-5 py-2.5 text-[13px] font-bold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M6 9V3h12v6" /><rect x="3" y="9" width="18" height="8" rx="2" /><path d="M7 14h10v7H7z" /></svg>
                Imprimir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
