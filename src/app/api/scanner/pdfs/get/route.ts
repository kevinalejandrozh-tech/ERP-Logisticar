import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta el id del PDF." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT nombre, contenido FROM scanner_pdfs WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró el PDF." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, nombre: result.rows[0].nombre, contenido: result.rows[0].contenido });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el PDF." }, { status: 500 });
  }
}
