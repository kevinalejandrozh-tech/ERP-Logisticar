import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { documentosRequeridos } from "@/lib/evaluacionCandidatosData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/evaluacion-candidatos → listado resumido (sin respuestas) para las etiquetas.
// Privado (requiere sesión). El envío público del candidato está en /api/evaluacion-candidatos/enviar.
export async function GET() {
  try {
    await ensureSchema();
    const r = await getPool().query(
      `SELECT id, puesto, nombre, edad, dictamen_auto, dictamen_final, puntaje_estrategico, max_estrategico,
              puntaje_conocimiento, max_conocimiento, created_at,
              (SELECT COUNT(*)::int FROM jsonb_array_elements(puntos_criticos) x WHERE x->>'nivel' = 'critico') AS criticos,
              (SELECT COALESCE(array_agg(DISTINCT d.tipo), '{}') FROM evaluacion_documentos d WHERE d.evaluacion_id = evaluaciones_candidatos.id) AS doc_tipos
         FROM evaluaciones_candidatos ORDER BY created_at DESC, id DESC`
    );
    // Documentos cargados vs. requeridos (los requeridos dependen del puesto).
    const evaluaciones = r.rows.map(({ doc_tipos, ...e }) => {
      const req = documentosRequeridos(e.puesto);
      return { ...e, docs_cargados: req.filter((d) => (doc_tipos || []).includes(d.id)).length, docs_total: req.length };
    });
    return NextResponse.json({ ok: true, evaluaciones });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las evaluaciones." }, { status: 500 });
  }
}
