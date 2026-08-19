import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM historial_mantenimientos`);
    const orden = Number(maxRes.rows[0].m) + 1;

    const maxFolioRes = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '\\D', '', 'g'), '')::int), 0) AS maximo FROM historial_mantenimientos`
    );
    const folio = String((maxFolioRes.rows[0]?.maximo || 0) + 1).padStart(4, "0");
    const hoy = new Date().toISOString().slice(0, 10);

    const result = await pool.query(
      `INSERT INTO historial_mantenimientos (estado, folio, tipo_mantenimiento, fecha_ingreso_taller, orden) VALUES ('', $1, 'Preventivo', $2, $3) RETURNING id, folio`,
      [folio, hoy, orden]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id, folio: result.rows[0].folio });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear la fila." }, { status: 500 });
  }
}
