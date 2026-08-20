import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, titulo, descripcion, columnas } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id del comparativo." }, { status: 400 });
    }
    if (!titulo || !String(titulo).trim()) {
      return NextResponse.json({ error: "Falta el título del comparativo." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(`UPDATE comparativos SET titulo = $2, descripcion = $3, columnas = $4::jsonb WHERE id = $1`, [
      id,
      titulo.trim(),
      descripcion || "",
      JSON.stringify(columnas || []),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el comparativo." }, { status: 500 });
  }
}
