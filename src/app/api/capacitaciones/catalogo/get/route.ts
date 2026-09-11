import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, titulo, descripcion, preguntas FROM capacitaciones_catalogo WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró la capacitación." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, registro: result.rows[0] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la capacitación." }, { status: 500 });
  }
}
