import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Falta el id de la actividad." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(`DELETE FROM gantt_actividades WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar la actividad." }, { status: 500 });
  }
}
