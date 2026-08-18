import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT id, folio, no_empleado, tipo, concepto, importe, orden FROM empleados_previsualizacion_pago ORDER BY orden ASC`);
    const registros = result.rows.map((r) => ({
      id: r.id,
      folio: r.folio || "",
      noEmpleado: r.no_empleado || "",
      tipo: r.tipo || "",
      concepto: r.concepto || "",
      importe: r.importe ?? "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la previsualización de pago." }, { status: 500 });
  }
}
