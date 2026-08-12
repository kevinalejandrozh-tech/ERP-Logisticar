import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, eco, unidad, fechaUltimoCambio, kmUltimoCambio, kmActual } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del registro." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE cambios_aceite SET
         eco = COALESCE($2, eco),
         unidad = COALESCE($3, unidad),
         fecha_ultimo_cambio = COALESCE($4, fecha_ultimo_cambio),
         km_ultimo_cambio = COALESCE($5, km_ultimo_cambio),
         km_actual = COALESCE($6, km_actual),
         updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, eco ?? null, unidad ?? null, fechaUltimoCambio ?? null, kmUltimoCambio ?? null, kmActual ?? null]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró el registro." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el registro." }, { status: 500 });
  }
}
