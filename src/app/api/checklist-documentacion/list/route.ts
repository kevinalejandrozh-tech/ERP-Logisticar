import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lista de registros (sin fotos, solo resumen). Filtro opcional por día: ?fecha=YYYY-MM-DD (hora de Ciudad de México).
export async function GET(req: NextRequest) {
  try {
    const fecha = req.nextUrl.searchParams.get("fecha");
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return NextResponse.json({ error: "Fecha inválida." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const filtro = fecha ? `WHERE (fecha_hora AT TIME ZONE 'America/Mexico_City')::date = $1::date` : "";
    const result = await pool.query(
      `SELECT id, folio, eco_unidad, descripcion_unidad, placas, fecha_hora,
              (SELECT jsonb_object_agg(e.k, jsonb_build_object('respuesta', e.v->>'respuesta',
                        'fotos', jsonb_array_length(COALESCE(e.v->'fotos', '[]'::jsonb))))
                 FROM jsonb_each(documentos) AS e(k, v)) AS resumen
       FROM checklist_documentacion ${filtro}
       ORDER BY fecha_hora DESC LIMIT 500`,
      fecha ? [fecha] : []
    );
    return NextResponse.json({ ok: true, registros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los registros." }, { status: 500 });
  }
}
