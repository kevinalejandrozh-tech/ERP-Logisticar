import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const result = await getPool().query(`SELECT * FROM cuadro_basico ORDER BY orden ASC, id ASC`);
    return NextResponse.json({ ok: true, filas: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el cuadro básico." }, { status: 500 });
  }
}
