// Clave de calificación de la Evaluación de Candidatos. SOLO se importa desde el API
// (nunca desde una página "use client"), para que el candidato no pueda ver las respuestas ideales.
import {
  PREGUNTAS_ESTRATEGICAS,
  PREGUNTAS_CONOCIMIENTO,
  UMBRAL_ESTRATEGICO,
  UMBRAL_CONOCIMIENTO,
} from "./evaluacionCandidatosData";

// Puntos por opción (0 a 3), en el mismo orden de las opciones del catálogo.
const PUNTOS_ESTRATEGICOS: Record<string, number[]> = {
  e1: [0, 3, 2, 1],
  e2: [1, 0, 3, 0],
  e3: [3, 0, 2, 0],
  e4: [0, 3, 1, 2],
  e5: [3, 2, 0, 0],
  e6: [1, 0, 3, 0],
  e7: [1, 0, 0, 3],
  e8: [0, 3, 0, 1],
  e9: [0, 0, 3, 0],
  e10: [3, 1, 0, 0],
  e11: [0, 1, 0, 3],
  e12: [0, 3, 1, 2],
  e13: [0, 3, 0, 0],
  e14: [3, 1, 1, 0],
  e15: [1, 0, 3, 0],
};

// Índice de la opción correcta (1 punto por acierto).
const CORRECTAS_CONOCIMIENTO: Record<string, number> = {
  c1: 2,
  c2: 1,
  c3: 2,
  c4: 0,
  c5: 1,
  c6: 3,
  c7: 1,
  c8: 0,
  c9: 2,
  c10: 3,
};

export type RespuestaCalificada = {
  id: string;
  seccion: "estrategica" | "conocimiento";
  pregunta: string;
  respuesta: string;
  puntos: number;
  maximo: number;
  correcta?: string; // solo conocimiento
};

// respuestas: { e1: 2, c3: 1, ... } → índice de la opción elegida
export function calificarEvaluacion(respuestas: Record<string, number>) {
  const detalle: RespuestaCalificada[] = [];
  const faltantes: string[] = [];
  let puntajeEstrategico = 0;
  let maxEstrategico = 0;
  let puntajeConocimiento = 0;
  let maxConocimiento = 0;

  for (const p of PREGUNTAS_ESTRATEGICAS) {
    const idx = respuestas[p.id];
    const tabla = PUNTOS_ESTRATEGICOS[p.id];
    const maximo = Math.max(...tabla);
    maxEstrategico += maximo;
    if (typeof idx !== "number" || idx < 0 || idx >= p.opciones.length) {
      faltantes.push(p.id);
      continue;
    }
    puntajeEstrategico += tabla[idx];
    detalle.push({ id: p.id, seccion: "estrategica", pregunta: p.texto, respuesta: p.opciones[idx], puntos: tabla[idx], maximo });
  }

  for (const p of PREGUNTAS_CONOCIMIENTO) {
    const idx = respuestas[p.id];
    const correcta = CORRECTAS_CONOCIMIENTO[p.id];
    maxConocimiento += 1;
    if (typeof idx !== "number" || idx < 0 || idx >= p.opciones.length) {
      faltantes.push(p.id);
      continue;
    }
    const puntos = idx === correcta ? 1 : 0;
    puntajeConocimiento += puntos;
    detalle.push({ id: p.id, seccion: "conocimiento", pregunta: p.texto, respuesta: p.opciones[idx], puntos, maximo: 1, correcta: p.opciones[correcta] });
  }

  const pctEstrategico = maxEstrategico ? Math.round((puntajeEstrategico / maxEstrategico) * 100) : 0;
  const pctConocimiento = maxConocimiento ? Math.round((puntajeConocimiento / maxConocimiento) * 100) : 0;
  const dictamen = pctEstrategico >= UMBRAL_ESTRATEGICO && pctConocimiento >= UMBRAL_CONOCIMIENTO ? "Apto" : "No apto";

  return { detalle, faltantes, puntajeEstrategico, maxEstrategico, pctEstrategico, puntajeConocimiento, maxConocimiento, pctConocimiento, dictamen };
}
