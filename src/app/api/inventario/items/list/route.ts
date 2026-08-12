import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, codigo, descripcion, categoria, referencia, costo_unitario, cantidad, proveedor, ubicacion, fecha_ingreso, unidad
       FROM inventario_items ORDER BY codigo ASC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      codigo: r.codigo,
      descripcion: r.descripcion || "",
      categoria: r.categoria || "",
      referencia: r.referencia || "",
      costoUnitario: r.costo_unitario ?? "",
      cantidad: r.cantidad ?? 0,
      proveedor: r.proveedor || "",
      ubicacion: r.ubicacion || "",
      fechaIngreso: r.fecha_ingreso || "",
      unidad: r.unidad || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el inventario." }, { status: 500 });
  }
}
