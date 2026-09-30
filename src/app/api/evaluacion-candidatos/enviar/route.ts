import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { calificarEvaluacion, detectarPuntosCriticos, dictaminar } from "@/lib/evaluacionCandidatosPuntaje";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const txt = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, 10).join(", ") : "");

const CAMPOS_TEXTO: [string, number][] = [
  ["telefono", 30],
  ["estado_civil", 40],
  ["personas_vive", 5],
  ["dependientes", 5],
  ["otro_ingreso", 5],
  ["domicilio_actual", 300],
  ["tipo_vivienda", 80],
  ["familiar", 150],
  ["pago_vivienda", 60],
  ["tiempo_domicilio_actual", 60],
  ["domicilio_anterior", 300],
  ["tiempo_domicilio_anterior", 60],
  ["renta_anterior", 60],
  ["tiene_transporte", 5],
  ["tipo_transporte", 80],
  ["creditos", 5],
  ["creditos_detalle", 200],
  ["licencia_tipo", 60],
  ["licencia_vigencia", 10],
  ["psicofisico", 30],
  ["anios_experiencia", 5],
  ["ultimo_empleo", 150],
  ["tiempo_ultimo_empleo", 60],
  ["motivo_salida", 300],
  ["empleos_3_anios", 10],
  ["condicion_salud", 5],
  ["salud_detalle", 300],
  ["proceso_legal", 5],
  ["legal_detalle", 300],
  ["accidentes", 5],
  ["accidentes_detalle", 300],
  ["robo_ruta", 5],
  ["robo_detalle", 300],
  ["carta_antecedentes", 5],
];

// POST /api/evaluacion-candidatos/enviar  (PÚBLICA: la llena el candidato desde el link/QR)
// body: { puesto, datos: {...}, respuestas: { e1: 0, ..., c10: 3 } }
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const puesto = txt(body.puesto, 150);
    const d = body.datos || {};
    const nombre = txt(d.nombre, 150);
    const edad = Number.parseInt(String(d.edad ?? ""), 10);
    if (!puesto) return NextResponse.json({ error: "Falta el puesto." }, { status: 400 });
    if (!nombre) return NextResponse.json({ error: "Falta el nombre." }, { status: 400 });
    if (!Number.isFinite(edad) || edad < 16 || edad > 99) return NextResponse.json({ error: "Edad no válida." }, { status: 400 });
    if (d.acepta_aviso !== true) return NextResponse.json({ error: "Es necesario aceptar el aviso del proceso." }, { status: 400 });

    const datos: Record<string, string> = { nombre, edad: String(edad) };
    for (const [k, max] of CAMPOS_TEXTO) datos[k] = txt(d[k], max);
    datos.unidades = lista(d.unidades);
    datos.rutas_conocidas = lista(d.rutas_conocidas);
    datos.acepta_aviso = "Sí";

    const respuestas = typeof body.respuestas === "object" && body.respuestas ? body.respuestas : {};
    const cal = calificarEvaluacion(respuestas);
    if (cal.faltantes.length) {
      return NextResponse.json({ error: `Faltan ${cal.faltantes.length} pregunta(s) por responder.` }, { status: 400 });
    }
    const puntos = detectarPuntosCriticos(datos, cal);
    const dictamen = dictaminar(cal, puntos);

    await getPool().query(
      `INSERT INTO evaluaciones_candidatos
        (puesto, nombre, edad, datos, respuestas, puntaje_estrategico, max_estrategico, puntaje_conocimiento, max_conocimiento, dictamen_auto, puntos_criticos, categorias)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [puesto, nombre, edad, JSON.stringify(datos), JSON.stringify(cal.detalle), cal.puntajeEstrategico, cal.maxEstrategico, cal.puntajeConocimiento, cal.maxConocimiento, dictamen, JSON.stringify(puntos), JSON.stringify(cal.categorias)]
    );
    // No se devuelve el resultado: el candidato no debe ver su calificación.
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar la evaluación." }, { status: 500 });
  }
}
