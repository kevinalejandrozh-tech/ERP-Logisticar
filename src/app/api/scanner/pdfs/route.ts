import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { nombre, contenido } = await req.json();
    if (!nombre || !contenido) {
      return NextResponse.json({ error: "Falta el nombre o el contenido del PDF." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`INSERT INTO scanner_pdfs (nombre, contenido) VALUES ($1, $2) RETURNING id`, [nombre, contenido]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el PDF." }, { status: 500 });
  }
}
