import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, codigo, descripcion, cantidad_sistema, cantidad_contada, diferencia, contado_por, fecha FROM conteos_ciclicos ORDER BY created_at DESC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      codigo: r.codigo || "",
      descripcion: r.descripcion || "",
      cantidadSistema: r.cantidad_sistema ?? 0,
      cantidadContada: r.cantidad_contada ?? 0,
      diferencia: r.diferencia ?? 0,
      contadoPor: r.contado_por || "",
      fecha: r.fecha || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los conteos." }, { status: 500 });
  }
}
