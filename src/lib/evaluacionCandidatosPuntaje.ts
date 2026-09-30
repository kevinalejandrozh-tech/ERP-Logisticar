// Clave de calificación de la Evaluación de Candidatos. SOLO se importa desde el API
// (nunca desde una página "use client"), para que el candidato no pueda ver las respuestas ideales.
import {
  PREGUNTAS_ESTRATEGICAS,
  PREGUNTAS_CONOCIMIENTO,
  PREGUNTAS_MECANICA,
  CATEGORIAS_ESTRATEGICAS,
  TEMAS_CONOCIMIENTO,
  UMBRAL_ESTRATEGICO,
  UMBRAL_CONOCIMIENTO,
} from "./evaluacionCandidatosData";
import { analizarEmpleos, aNumero, normalizar, dinero, type Credito, type ConfigEvaluacion } from "./evaluacionCandidatosAnalisis";

// Puntos por opción (0 a 3), en el mismo orden de las opciones del catálogo.
const PUNTOS_ESTRATEGICOS: Record<string, number[]> = {
  e1: [3, 1, 1, 0],
  e3: [0, 3, 2, 1],
  e4: [3, 2, 0, 1],
  e5: [1, 2, 3, 0],
  e6: [1, 3, 1, 0],
  e7: [0, 3, 1, 2],
  e8: [0, 0, 3, 0],
  e18: [0, 3, 0, 1],
  e9: [0, 3, 1, 2],
  e10: [1, 3, 0, 0],
  e11: [0, 3, 1, 0],
  e12: [2, 3, 0, 1],
  e14: [1, 3, 1, 0],
  e15: [1, 3, 0, 0],
  e16: [1, 3, 0, 0],
  e17: [0, 2, 1, 3],
};

// Índice de la opción correcta (1 punto por acierto).
const CORRECTAS_CONOCIMIENTO: Record<string, number> = {
  c1: 1,
  c2: 2,
  c3: 3,
  c4: 0,
  c5: 1,
  c6: 2,
  c7: 0,
  c8: 3,
  c9: 0,
  c10: 1,
  m1: 1,
  m2: 2,
  m3: 1,
  m4: 3,
  m5: 0,
  m6: 2,
  m7: 1,
};

export type RespuestaCalificada = {
  id: string;
  seccion: "estrategica" | "conocimiento";
  categoria: string;
  pregunta: string;
  respuesta: string;
  puntos: number;
  maximo: number;
  correcta?: string; // solo conocimiento
};
export type Categoria = { nombre: string; seccion: "estrategica" | "conocimiento"; puntos: number; maximo: number; pct: number };
export type PuntoCritico = { nivel: "critico" | "atencion"; texto: string };

const categoriaDe = (mapa: Record<string, string[]>, id: string) => Object.keys(mapa).find((k) => mapa[k].includes(id)) || "General";

// respuestas: { e1: 2, c3: 1, ... } → índice de la opción elegida
export function calificarEvaluacion(respuestas: Record<string, number>) {
  const detalle: RespuestaCalificada[] = [];
  const faltantes: string[] = [];

  for (const p of PREGUNTAS_ESTRATEGICAS) {
    const idx = respuestas[p.id];
    const tabla = PUNTOS_ESTRATEGICOS[p.id];
    if (typeof idx !== "number" || idx < 0 || idx >= p.opciones.length) {
      faltantes.push(p.id);
      continue;
    }
    detalle.push({ id: p.id, seccion: "estrategica", categoria: categoriaDe(CATEGORIAS_ESTRATEGICAS, p.id), pregunta: p.texto, respuesta: p.opciones[idx], puntos: tabla[idx], maximo: Math.max(...tabla) });
  }
  for (const p of [...PREGUNTAS_CONOCIMIENTO, ...PREGUNTAS_MECANICA]) {
    const idx = respuestas[p.id];
    const correcta = CORRECTAS_CONOCIMIENTO[p.id];
    if (typeof idx !== "number" || idx < 0 || idx >= p.opciones.length) {
      faltantes.push(p.id);
      continue;
    }
    detalle.push({ id: p.id, seccion: "conocimiento", categoria: categoriaDe(TEMAS_CONOCIMIENTO, p.id), pregunta: p.texto, respuesta: p.opciones[idx], puntos: idx === correcta ? 1 : 0, maximo: 1, correcta: p.opciones[correcta] });
  }

  const suma = (sec: RespuestaCalificada["seccion"], campo: "puntos" | "maximo") => detalle.filter((d) => d.seccion === sec).reduce((a, d) => a + d[campo], 0);
  const puntajeEstrategico = suma("estrategica", "puntos");
  const maxEstrategico = suma("estrategica", "maximo");
  const puntajeConocimiento = suma("conocimiento", "puntos");
  const maxConocimiento = suma("conocimiento", "maximo");
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

  const categorias: Categoria[] = [
    ...Object.keys(CATEGORIAS_ESTRATEGICAS).map((n) => ({ nombre: n, seccion: "estrategica" as const })),
    ...Object.keys(TEMAS_CONOCIMIENTO).map((n) => ({ nombre: n, seccion: "conocimiento" as const })),
  ].map((c) => {
    const items = detalle.filter((d) => d.categoria === c.nombre);
    const puntos = items.reduce((a, d) => a + d.puntos, 0);
    const maximo = items.reduce((a, d) => a + d.maximo, 0);
    return { ...c, puntos, maximo, pct: pct(puntos, maximo) };
  });

  return {
    detalle,
    faltantes,
    categorias,
    puntajeEstrategico,
    maxEstrategico,
    pctEstrategico: pct(puntajeEstrategico, maxEstrategico),
    puntajeConocimiento,
    maxConocimiento,
    pctConocimiento: pct(puntajeConocimiento, maxConocimiento),
  };
}

// Puntos críticos del perfil (datos declarados + respuestas de riesgo + configuración de la empresa).
export function detectarPuntosCriticos(datos: Record<string, any>, cal: ReturnType<typeof calificarEvaluacion>, config: ConfigEvaluacion): PuntoCritico[] {
  const pc: PuntoCritico[] = [];
  const critico = (texto: string) => pc.push({ nivel: "critico", texto });
  const atencion = (texto: string) => pc.push({ nivel: "atencion", texto });
  const si = (k: string) => datos[k] === "Sí";

  // Edad y zona de residencia (definidas en Configuración)
  const edad = Number(datos.edad);
  if (Number.isFinite(edad) && (edad < config.edad_min || edad > config.edad_max)) atencion(`Edad (${edad}) fuera del rango definido (${config.edad_min} a ${config.edad_max} años).`);
  const muni = normalizar(String(datos.municipio || ""));
  if (muni && config.zonas_rojas.some((z) => normalizar(z) === muni)) atencion(`Vive en un municipio marcado como zona roja: ${datos.municipio}.`);

  // Licencia
  if (!datos.licencia_tipo || datos.licencia_tipo === "No tengo licencia") critico("No cuenta con licencia de conducir.");
  else if (!String(datos.licencia_tipo).startsWith("Federal")) atencion(`No cuenta con licencia federal (declaró: ${datos.licencia_tipo}).`);
  if (datos.licencia_vigencia) {
    const dias = Math.floor((new Date(datos.licencia_vigencia).getTime() - Date.now()) / 86400000);
    if (dias < 0) critico("La licencia está vencida.");
    else if (dias <= 60) atencion(`La licencia vence en ${dias} día(s).`);
  }
  if (datos.psicofisico === "No / vencido") critico("No cuenta con examen psicofísico vigente.");
  else if (datos.psicofisico === "En trámite") atencion("Examen psicofísico en trámite.");
  const anios = Number(datos.anios_experiencia);
  if (Number.isFinite(anios) && datos.anios_experiencia !== "" && anios < 2) critico(`Experiencia de manejo limitada (${anios} año(s)).`);
  else if (Number.isFinite(anios) && anios < 4) atencion(`Experiencia de manejo moderada (${anios} años).`);

  // Estabilidad laboral (con base en el historial capturado)
  const emp = analizarEmpleos(Array.isArray(datos.empleos) ? datos.empleos : []);
  if (datos.primer_empleo !== "Sí") {
    if (emp.ultimos3 >= 4) critico(`Inestabilidad laboral: ${emp.ultimos3} empleos en los últimos 3 años.`);
    else if (emp.ultimos3 === 3) atencion("Rotación moderada: 3 empleos en los últimos 3 años.");
    if (emp.total >= 2 && emp.promedioMeses < 12) atencion(`Permanencia promedio baja: ${emp.promedioMeses} meses por empleo.`);
    const hueco = Math.max(0, ...emp.huecos);
    if (hueco > 6) atencion(`Periodo sin empleo de ${hueco} meses entre trabajos.`);
    const ultimo = emp.lista[emp.lista.length - 1];
    if (ultimo && ultimo.meses !== null && ultimo.meses < 6) atencion(`Permaneció ${ultimo.meses} mes(es) en su último empleo.`);
    if (emp.total && !emp.conReferencia) atencion("No proporcionó referencias laborales.");
    emp.lista
      .filter((e) => /desp|corri|liquid|robo|faltante|accident|problema|conflict/i.test(e.motivo || ""))
      .forEach((e) => atencion(`Motivo de salida a verificar en ${e.empresa || "un empleo"}: “${e.motivo}”.`));
  }
  if (datos.autoriza_referencias === "No") critico("No autoriza que se soliciten referencias a sus empleos anteriores.");

  // Congruencia entre ingresos previos y estilo de vida
  const sueldoRef = emp.sueldoMax;
  if (sueldoRef > 0) {
    const valorAuto = aNumero(datos.vehiculo_valor);
    if (valorAuto > sueldoRef * 12) atencion(`Posible incongruencia: su vehículo (${dinero(valorAuto)}) equivale a ${Math.round(valorAuto / sueldoRef)} meses de su mayor sueldo declarado (${dinero(sueldoRef)}).`);
    const vivienda = aNumero(datos.pago_vivienda);
    if (vivienda > sueldoRef * 0.5) atencion(`Posible incongruencia: paga ${dinero(vivienda)} de vivienda, más del 50% de su mayor sueldo declarado (${dinero(sueldoRef)}).`);
    const gastos = aNumero(datos.gastos_mensuales);
    if (gastos > sueldoRef * 1.1) atencion(`Posible incongruencia: gastos mensuales (${dinero(gastos)}) mayores que su mayor sueldo declarado (${dinero(sueldoRef)}).`);
    const pagos = (Array.isArray(datos.creditos_lista) ? datos.creditos_lista : []).reduce((a: number, c: Credito) => a + aNumero(c.pago_mensual), 0);
    if (pagos > sueldoRef * 0.4) atencion(`Endeudamiento alto: paga ${dinero(pagos)} al mes en créditos (${Math.round((pagos / sueldoRef) * 100)}% de su mayor sueldo).`);
    const esperado = aNumero(datos.sueldo_esperado);
    if (esperado > sueldoRef * 1.6) atencion(`Expectativa salarial (${dinero(esperado)}) muy superior a su mayor sueldo declarado (${dinero(sueldoRef)}).`);
  } else if (datos.primer_empleo !== "Sí" && emp.total) {
    atencion("No declaró sueldos anteriores; no es posible validar la congruencia de su estilo de vida.");
  }
  if (si("creditos")) {
    const n = Array.isArray(datos.creditos_lista) ? datos.creditos_lista.length : 0;
    if (n >= 3) atencion(`Tiene ${n} créditos activos.`);
  }
  const dep = Number(datos.dependientes);
  if (Number.isFinite(dep) && dep >= 4 && datos.otro_ingreso === "No") atencion(`${dep} dependientes económicos y es el único ingreso del hogar.`);

  // Salud, legal y seguridad
  if (si("condicion_salud")) atencion(`Declara condición de salud${datos.salud_detalle ? `: ${datos.salud_detalle}` : "."}`);
  if (si("proceso_legal")) critico(`Declara asunto legal pendiente${datos.legal_detalle ? `: ${datos.legal_detalle}` : "."}`);
  if (si("accidentes")) atencion(`Accidente(s) en los últimos 3 años${datos.accidentes_detalle ? `: ${datos.accidentes_detalle}` : "."}`);
  if (si("robo_ruta")) {
    const veces = aNumero(datos.robo_veces);
    if (veces >= 2) critico(`Ha vivido ${veces} robos o intentos de robo en ruta: revisar a detalle.`);
    else atencion("Ha vivido un robo o intento de robo en ruta: revisar su relato.");
    if (datos.robo_aviso === "No") atencion("En el robo que vivió no avisó a la empresa ni denunció.");
  }
  if (datos.carta_antecedentes === "No") critico("Indica que no podría tramitar la carta de no antecedentes penales.");

  // Respuestas de riesgo y categorías bajas
  cal.detalle
    .filter((d) => d.seccion === "estrategica" && d.puntos === 0)
    .forEach((d) => critico(`Respuesta de riesgo en ${d.categoria}: “${d.respuesta}”`));
  cal.categorias
    .filter((c) => c.pct < 50)
    .forEach((c) => atencion(`Bajo desempeño en ${c.nombre} (${c.pct}%).`));

  return pc.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "critico" ? -1 : 1));
}

export function dictaminar(cal: ReturnType<typeof calificarEvaluacion>, puntos: PuntoCritico[]) {
  const sinCriticos = !puntos.some((p) => p.nivel === "critico");
  return cal.pctEstrategico >= UMBRAL_ESTRATEGICO && cal.pctConocimiento >= UMBRAL_CONOCIMIENTO && sinCriticos ? "Apto" : "No apto";
}
