import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS: Record<string, string> = {
  folio: "folio",
  noEmpleado: "no_empleado",
  tipo: "tipo",
  concepto: "concepto",
  importe: "importe",
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta el id del registro." }, { status: 400 });
    }
    const campo = Object.keys(body).find((k) => k !== "id" && CAMPOS[k]);
    if (!campo) {
      return NextResponse.json({ error: "Campo no reconocido." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(`UPDATE empleados_previsualizacion_pago SET ${CAMPOS[campo]} = $2, updated_at = now() WHERE id = $1`, [id, body[campo] === "" ? null : body[campo]]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el registro." }, { status: 500 });
  }
}
