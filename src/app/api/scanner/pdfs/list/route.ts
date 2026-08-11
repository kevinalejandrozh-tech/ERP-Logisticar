import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, nombre, creado_en FROM scanner_pdfs ORDER BY creado_en DESC`);
    const registros = result.rows.map((r) => ({ id: r.id, nombre: r.nombre, creadoEn: r.creado_en }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los PDFs guardados." }, { status: 500 });
  }
}
