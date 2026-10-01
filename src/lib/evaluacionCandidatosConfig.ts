import { getPool } from "@/lib/db";
import { CONFIG_DEFECTO } from "@/lib/evaluacionCandidatosData";
import type { ConfigEvaluacion } from "@/lib/evaluacionCandidatosAnalisis";

// Lee la configuración de la evaluación (servidor). Llamar después de ensureSchema().
export async function leerConfigEvaluacion(): Promise<ConfigEvaluacion> {
  const r = await getPool().query(`SELECT zonas_rojas, edad_min, edad_max FROM evaluacion_config WHERE id = 1`);
  const f = r.rows[0];
  return f ? { zonas_rojas: f.zonas_rojas || [], edad_min: f.edad_min, edad_max: f.edad_max } : { ...CONFIG_DEFECTO };
}
