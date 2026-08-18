import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, cantidad, unidad, descripcion, subTotal, proveedor } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del registro." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `UPDATE gantt_costos SET
         cantidad = COALESCE($2, cantidad),
         unidad = COALESCE($3, unidad),
         descripcion = COALESCE($4, descripcion),
         sub_total = COALESCE($5, sub_total),
         proveedor = COALESCE($6, proveedor),
         updated_at = now()
       WHERE id = $1 RETURNING id`,
      [id, cantidad ?? null, unidad ?? null, descripcion ?? null, subTotal ?? null, proveedor ?? null]
    );
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró el registro." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el registro." }, { status: 500 });
  }
}
