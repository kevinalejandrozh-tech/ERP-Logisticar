import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { calificarEvaluacion, detectarPuntosCriticos, dictaminar } from "@/lib/evaluacionCandidatosPuntaje";
import { leerConfigEvaluacion } from "@/lib/evaluacionCandidatosConfig";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const txt = (v: unknown, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v).slice(0, max) : "");
const lista = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => x.slice(0, 60)).slice(0, 12).join(", ") : "");
const objetos = (v: unknown, campos: [string, number][], maxItems: number) =>
  (Array.isArray(v) ? v : [])
    .slice(0, maxItems)
    .filter((o) => o && typeof o === "object")
    .map((o: any) => {
      const r: Record<string, any> = {};
      for (const [k, max] of campos) r[k] = txt(o[k], max);
      if ("actual" in o) r.actual = o.actual === true;
      return r;
    });

const CAMPOS_TEXTO: [string, number][] = [
  ["telefono", 30], ["correo", 120], ["fecha_nacimiento", 10], ["lugar_nacimiento", 120], ["escolaridad", 60],
  ["estado_civil", 40], ["hijos", 5], ["personas_vive", 5], ["dependientes", 5], ["otro_ingreso", 5],
  ["calle_numero", 150], ["colonia", 120], ["municipio", 80], ["estado", 60], ["cp", 10],
  ["tipo_vivienda", 80], ["familiar", 150], ["pago_vivienda", 60], ["tiempo_domicilio_actual", 60],
  ["domicilio_anterior", 300], ["tiempo_domicilio_anterior", 60], ["renta_anterior", 60],
  ["tiene_transporte", 5], ["tipo_transporte", 80], ["vehiculo_modelo", 120], ["vehiculo_valor", 30], ["vehiculo_pagado", 30],
  ["gastos_mensuales", 30], ["sueldo_esperado", 30], ["traslado", 200], ["creditos", 5],
  ["primer_empleo", 5], ["autoriza_referencias", 5],
  ["licencia_tipo", 60], ["licencia_vigencia", 10], ["psicofisico", 30], ["anios_experiencia", 5],
  ["condicion_salud", 5], ["salud_detalle", 300], ["proceso_legal", 5], ["legal_detalle", 300],
  ["accidentes", 5], ["accidentes_detalle", 300],
  ["robo_ruta", 5], ["robo_veces", 5], ["robo_fecha_lugar", 200], ["robo_modus", 80], ["robo_relato", 800],
  ["robo_observacion", 600], ["robo_reaccion", 600], ["robo_aviso", 5],
  ["carta_antecedentes", 5],
];
const CAMPOS_EMPLEO: [string, number][] = [
  ["empresa", 150], ["direccion", 200], ["puesto", 100], ["inicio", 7], ["fin", 7], ["sueldo", 30], ["motivo", 300], ["ref_nombre", 120], ["ref_telefono", 30],
];
const CAMPOS_CREDITO: [string, number][] = [["tipo", 80], ["pago_mensual", 30], ["saldo", 30]];
const FOTO = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;

// POST /api/evaluacion-candidatos/enviar  (PÚBLICA: la llena el candidato desde el link/QR)
// body: { puesto, datos: {...}, respuestas: { e1: 0, ..., m7: 1 }, foto?: "data:image/jpeg;base64,..." }
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

    const datos: Record<string, any> = { nombre, edad: String(edad) };
    for (const [k, max] of CAMPOS_TEXTO) datos[k] = txt(d[k], max);
    datos.domicilio_actual = [datos.calle_numero, datos.colonia, datos.municipio, datos.estado, datos.cp ? `C.P. ${datos.cp}` : ""].filter(Boolean).join(", ");
    datos.unidades = lista(d.unidades);
    datos.rutas_conocidas = lista(d.rutas_conocidas);
    datos.empleos = objetos(d.empleos, CAMPOS_EMPLEO, 10);
    datos.creditos_lista = datos.creditos === "Sí" ? objetos(d.creditos_lista, CAMPOS_CREDITO, 12) : [];
    datos.acepta_aviso = "Sí";

    const foto = typeof body.foto === "string" && body.foto.length < 400_000 && FOTO.test(body.foto) ? body.foto : null;

    const respuestas = typeof body.respuestas === "object" && body.respuestas ? body.respuestas : {};
    const cal = calificarEvaluacion(respuestas);
    if (cal.faltantes.length) {
      return NextResponse.json({ error: `Faltan ${cal.faltantes.length} pregunta(s) por responder.` }, { status: 400 });
    }
    const puntos = detectarPuntosCriticos(datos, cal, await leerConfigEvaluacion());
    const dictamen = dictaminar(cal, puntos);

    await getPool().query(
      `INSERT INTO evaluaciones_candidatos
        (puesto, nombre, edad, datos, respuestas, puntaje_estrategico, max_estrategico, puntaje_conocimiento, max_conocimiento, dictamen_auto, puntos_criticos, categorias, foto)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [puesto, nombre, edad, JSON.stringify(datos), JSON.stringify(cal.detalle), cal.puntajeEstrategico, cal.maxEstrategico, cal.puntajeConocimiento, cal.maxConocimiento, dictamen, JSON.stringify(puntos), JSON.stringify(cal.categorias), foto]
    );
    // No se devuelve el resultado: el candidato no debe ver su calificación.
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo guardar la evaluación." }, { status: 500 });
  }
}
