import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Lista de operadores para los selectores (Uniformes, Mochilas Covid, Monitoreo, Reportar falla, Credenciales).
// La fuente es el módulo Expedientes: personal de tipo "Operador" que no esté dado de Baja.
// (Si tipo_personal está vacío se considera Operador, igual que en el listado de Expedientes.)
export async function GET() {
  try {
    await ensureSchema();
    const result = await getPool().query(
      `SELECT id, nombre, fecha_ingreso
       FROM expedientes
       WHERE COALESCE(tipo_personal, 'operador') = 'operador'
         AND estatus_laboral != 'Baja'
       ORDER BY nombre ASC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      fechaIngreso: r.fecha_ingreso ? new Date(r.fecha_ingreso).toISOString().slice(0, 10) : "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer operadores." }, { status: 500 });
  }
}
