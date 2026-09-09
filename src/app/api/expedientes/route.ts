import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS_TEXTO = [
  "nombre",
  "rfc",
  "curp",
  "nss",
  "categoria",
  "puesto",
  "unidad_maneja",
  "tipo_viajes",
  "tipo_licencia",
  "fecha_ingreso",
  "cuenta",
  "sueldo_ofertado",
  "radio_asignado",
  "resultados_evaluacion",
  "fotografia",
  "indicador_asistencia",
  "indicador_puntualidad",
  "indicador_combustible",
  "indicador_incidencias",
] as const;
const CAMPOS_JSON = ["documentos", "notas", "cursos"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre || !String(body.nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre del colaborador." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    if (body.id) {
      const asignaciones = [
        ...CAMPOS_TEXTO.map((c, i) => `${c} = $${i + 2}`),
        ...CAMPOS_JSON.map((c, i) => `${c} = $${CAMPOS_TEXTO.length + i + 2}::jsonb`),
      ].join(", ");
      const valores = [
        ...CAMPOS_TEXTO.map((c) => (body[c] === undefined || body[c] === "" ? null : body[c])),
        ...CAMPOS_JSON.map((c) => JSON.stringify(body[c] || [])),
      ];
      await pool.query(`UPDATE expedientes SET ${asignaciones}, updated_at = now() WHERE id = $1`, [body.id, ...valores]);
      return NextResponse.json({ ok: true, id: body.id });
    }

    const columnas = [...CAMPOS_TEXTO, ...CAMPOS_JSON].join(", ");
    const marcadoresTexto = CAMPOS_TEXTO.map((_, i) => `$${i + 1}`);
    const marcadoresJson = CAMPOS_JSON.map((_, i) => `$${CAMPOS_TEXTO.length + i + 1}::jsonb`);
    const marcadores = [...marcadoresTexto, ...marcadoresJson].join(", ");
    const valores = [
      ...CAMPOS_TEXTO.map((c) => (body[c] === undefined || body[c] === "" ? null : body[c])),
      ...CAMPOS_JSON.map((c) => JSON.stringify(body[c] || [])),
    ];
    const result = await pool.query(`INSERT INTO expedientes (${columnas}) VALUES (${marcadores}) RETURNING id`, valores);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el expediente." }, { status: 500 });
  }
}
