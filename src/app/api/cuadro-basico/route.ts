import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const result = await getPool().query(`SELECT cb.*, a.nombre_archivo AS archivo_nombre, a.mime AS archivo_mime
       FROM cuadro_basico cb LEFT JOIN cuadro_basico_archivos a ON a.cuadro_id = cb.id
       ORDER BY cb.orden ASC, cb.id ASC`);
    return NextResponse.json({ ok: true, filas: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el cuadro básico." }, { status: 500 });
  }
}
