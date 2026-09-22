import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ESTATUS_VALIDOS = ["En ruta", "Descanso viaje", "Disponible"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    const pool = getPool();

    if (body.estatus !== undefined) {
      if (!ESTATUS_VALIDOS.includes(body.estatus)) return NextResponse.json({ error: "Estatus inválido." }, { status: 400 });
      // Si el estatus es "En ruta" o "Descanso viaje", la asistencia se cuenta automaticamente como verdadera.
      // Si es "Disponible", se respeta el valor de asistencia enviado (o false si no se envio).
      const asistencia = body.estatus === "Disponible" ? !!body.asistencia : true;
      await pool.query(`UPDATE expedientes SET estatus = $2, asistencia = $3, updated_at = now() WHERE id = $1`, [id, body.estatus, asistencia]);
      return NextResponse.json({ ok: true, asistencia });
    }

    if (body.asistencia !== undefined) {
      // Solo se permite alternar manualmente la asistencia cuando el estatus actual es "Disponible".
      const actual = await pool.query(`SELECT estatus FROM expedientes WHERE id = $1`, [id]);
      if (actual.rows[0]?.estatus !== "Disponible") {
        return NextResponse.json({ error: "La asistencia solo se puede editar manualmente cuando el estatus es Disponible." }, { status: 400 });
      }
      await pool.query(`UPDATE expedientes SET asistencia = $2, updated_at = now() WHERE id = $1`, [id, !!body.asistencia]);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Falta estatus o asistencia." }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar." }, { status: 500 });
  }
}
