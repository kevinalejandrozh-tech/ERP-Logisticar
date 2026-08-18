import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { proveedor, fecha, items } = await req.json();
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(folio, '\\D', '', 'g'), '')::int), 0) AS maximo FROM ordenes_compra`
    );
    const folio = `OC-${String((maxRes.rows[0]?.maximo || 0) + 1).padStart(5, "0")}`;
    const result = await pool.query(
      `INSERT INTO ordenes_compra (folio, proveedor, fecha, items) VALUES ($1,$2,$3,$4::jsonb) RETURNING id, folio`,
      [folio, proveedor || "", fecha || new Date().toISOString().slice(0, 10), JSON.stringify(items || [])]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id, folio: result.rows[0].folio });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear la orden de compra." }, { status: 500 });
  }
}
