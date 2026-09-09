import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS = [
  "nombre",
  "rfc",
  "rfc_pdf",
  "curp",
  "curp_pdf",
  "nss",
  "nss_pdf",
  "categoria",
  "puesto",
  "unidad_maneja",
  "tipo_viajes",
  "tipo_licencia",
  "tipo_licencia_pdf",
  "fecha_ingreso",
  "cuenta",
  "sueldo_ofertado",
  "radio_asignado",
  "resultados_evaluacion",
  "fotografia",
] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.nombre || !String(body.nombre).trim()) {
      return NextResponse.json({ error: "Falta el nombre del colaborador." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    if (body.id) {
      const asignaciones = CAMPOS.map((c, i) => `${c} = $${i + 2}`).join(", ");
      const valores = CAMPOS.map((c) => (body[c] === undefined ? null : body[c]));
      await pool.query(`UPDATE expedientes SET ${asignaciones}, updated_at = now() WHERE id = $1`, [body.id, ...valores]);
      return NextResponse.json({ ok: true, id: body.id });
    }

    const columnas = CAMPOS.join(", ");
    const marcadores = CAMPOS.map((_, i) => `$${i + 1}`).join(", ");
    const valores = CAMPOS.map((c) => (body[c] === undefined ? null : body[c]));
    const result = await pool.query(`INSERT INTO expedientes (${columnas}) VALUES (${marcadores}) RETURNING id`, valores);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el expediente." }, { status: 500 });
  }
}
