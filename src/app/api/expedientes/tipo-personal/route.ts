import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id, tipo_personal } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    if (tipo_personal !== "administrativo" && tipo_personal !== "operador") {
      return NextResponse.json({ error: "Tipo de personal inválido." }, { status: 400 });
    }
    await ensureSchema();
    await getPool().query(`UPDATE expedientes SET tipo_personal = $2, updated_at = now() WHERE id = $1`, [id, tipo_personal]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el tipo de personal." }, { status: 500 });
  }
}
