import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const pool = getPool();

    // El rol supervisor_tms solo puede ver operadores cuya Cuenta sea "TMS".
    // Sysadmin y el acceso publico (p. ej. la pagina de tomar capacitacion, sin sesion) ven todo.
    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;
    const soloTms = sesion?.rol === "supervisor_tms";

    // Las personas dadas de "Baja" no aparecen en ningun lado por defecto (list es el endpoint que
    // consumen tanto el listado de Expedientes como el selector de nombres en Capacitaciones, etc.),
    // salvo que se pida explicitamente incluirlas (usado por el filtro "Baja" del listado de Expedientes).
    const incluirBaja = req.nextUrl.searchParams.get("incluirBaja") === "true";

    const campos = "id, nombre, puesto, categoria, cuenta, rfc, curp, tipo_personal, estatus, asistencia, area, estatus_laboral, fecha_ingreso, motivo_baja, fotografia";
    const condiciones: string[] = [];
    if (soloTms) condiciones.push(`cuenta = 'TMS'`);
    if (!incluirBaja) condiciones.push(`estatus_laboral != 'Baja'`);
    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

    const result = await pool.query(`SELECT ${campos} FROM expedientes ${where} ORDER BY nombre ASC`);
    return NextResponse.json({ ok: true, registros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los expedientes." }, { status: 500 });
  }
}
