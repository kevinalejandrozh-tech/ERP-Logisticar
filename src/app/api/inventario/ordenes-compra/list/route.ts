import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, folio, proveedor, fecha, items, estado FROM ordenes_compra ORDER BY created_at DESC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      folio: r.folio || "",
      proveedor: r.proveedor || "",
      fecha: r.fecha || "",
      items: r.items || [],
      estado: r.estado || "pendiente",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las órdenes de compra." }, { status: 500 });
  }
}
