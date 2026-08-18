import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, no_empleado, nombre_empleado, rfc, curp, nss, puesto, departamento, salario_diario, fecha_ingreso, estatus, orden
       FROM empleados_datos_generales ORDER BY orden ASC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      noEmpleado: r.no_empleado || "",
      nombreEmpleado: r.nombre_empleado || "",
      rfc: r.rfc || "",
      curp: r.curp || "",
      nss: r.nss || "",
      puesto: r.puesto || "",
      departamento: r.departamento || "",
      salarioDiario: r.salario_diario ?? "",
      fechaIngreso: r.fecha_ingreso || "",
      estatus: r.estatus || "",
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los datos generales." }, { status: 500 });
  }
}
