import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { nombre, comentario } = await req.json();
    if (!comentario || !String(comentario).trim()) {
      return NextResponse.json({ error: "Escribe tu sugerencia o idea antes de enviarla." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`INSERT INTO buzon_sugerencias (nombre, comentario) VALUES ($1,$2) RETURNING id`, [
      nombre && String(nombre).trim() ? String(nombre).trim() : null,
      String(comentario).trim(),
    ]);
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "No se pudo enviar tu sugerencia." }, { status: 500 });
  }
}
