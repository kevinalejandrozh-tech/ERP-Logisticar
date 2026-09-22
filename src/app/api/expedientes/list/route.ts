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

    const result = await pool.query(
      soloTms
        ? `SELECT id, nombre, puesto, categoria, cuenta, rfc, curp, tipo_personal, fotografia FROM expedientes WHERE cuenta = 'TMS' ORDER BY nombre ASC`
        : `SELECT id, nombre, puesto, categoria, cuenta, rfc, curp, tipo_personal, fotografia FROM expedientes ORDER BY nombre ASC`
    );
    return NextResponse.json({ ok: true, registros: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los expedientes." }, { status: 500 });
  }
}
