import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM scanner_pdfs RETURNING id`);
    return NextResponse.json({ ok: true, borrados: result.rowCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar los PDFs." }, { status: 500 });
  }
}
