import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, estado } = await req.json();
    if (!id || !estado) {
      return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(`UPDATE solicitudes_material SET estado = $2, updated_at = now() WHERE id = $1`, [id, estado]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar la solicitud." }, { status: 500 });
  }
}
