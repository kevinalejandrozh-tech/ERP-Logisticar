import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, actividad_id, cantidad, unidad, descripcion, sub_total, proveedor, orden FROM gantt_costos ORDER BY actividad_id ASC, orden ASC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      actividadId: r.actividad_id,
      cantidad: r.cantidad ?? "",
      unidad: r.unidad || "",
      descripcion: r.descripcion || "",
      subTotal: r.sub_total ?? "",
      proveedor: r.proveedor || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los costos." }, { status: 500 });
  }
}
