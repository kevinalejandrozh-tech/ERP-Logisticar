import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const { eco } = await req.json();
    if (!eco) {
      return NextResponse.json({ error: "Falta el ECO de la unidad." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`DELETE FROM unidades WHERE eco = $1 RETURNING eco`, [eco]);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró la unidad." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar la unidad." }, { status: 500 });
  }
}
