import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    const revisadas = new Set(
      (await pool.query(`SELECT DISTINCT eco_unidad FROM checklist_unidades`)).rows.map((r) => r.eco_unidad)
    );
    const filas = (await pool.query(`SELECT id, datos FROM reporte_filas`)).rows;
    for (const f of filas) {
      const eco = f.datos?.["ECO"];
      if (!eco) continue;
      const estado = revisadas.has(eco) ? "Revisada" : "No revisada";
      await pool.query(
        `UPDATE reporte_filas SET datos = jsonb_set(datos, ARRAY['Estado'], to_jsonb($2::text), true), updated_at = now() WHERE id = $1`,
        [f.id, estado]
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el estado." }, { status: 500 });
  }
}
