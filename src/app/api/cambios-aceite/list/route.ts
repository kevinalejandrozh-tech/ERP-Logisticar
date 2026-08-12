import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, eco, unidad, fecha_ultimo_cambio, km_ultimo_cambio, km_actual FROM cambios_aceite ORDER BY id DESC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      eco: r.eco || "",
      unidad: r.unidad || "",
      fechaUltimoCambio: r.fecha_ultimo_cambio || "",
      kmUltimoCambio: r.km_ultimo_cambio ?? "",
      kmActual: r.km_actual ?? "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los cambios de aceite." }, { status: 500 });
  }
}
