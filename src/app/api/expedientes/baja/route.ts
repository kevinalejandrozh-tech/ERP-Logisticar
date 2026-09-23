import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, motivo_baja, reactivar } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    if (reactivar) {
      await getPool().query(`UPDATE expedientes SET estatus_laboral = 'Activo', updated_at = now() WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true });
    }
    if (!motivo_baja || !String(motivo_baja).trim()) return NextResponse.json({ error: "Escribe el motivo de baja." }, { status: 400 });
    await getPool().query(
      `UPDATE expedientes SET estatus_laboral = 'Baja', motivo_baja = $2, fecha_baja = now(), updated_at = now() WHERE id = $1`,
      [id, String(motivo_baja).trim()]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el estatus." }, { status: 500 });
  }
}

