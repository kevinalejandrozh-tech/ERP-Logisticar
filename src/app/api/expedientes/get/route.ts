import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT * FROM expedientes WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
      return NextResponse.json({ error: "No se encontró el expediente." }, { status: 404 });
    }
    const registro = result.rows[0];

    const token = req.cookies.get(COOKIE_SESION)?.value;
    const sesion = token ? await verificarTokenSesion(token) : null;

    // El rol supervisor_tms solo puede consultar expedientes cuya Cuenta sea "TMS".
    if (sesion?.rol === "supervisor_tms") {
      if (registro.cuenta !== "TMS") {
        return NextResponse.json({ error: "No tienes acceso a este expediente." }, { status: 404 });
      }
      // Y dentro de los que sí puede ver, el sueldo queda completamente fuera de la respuesta.
      delete registro.sueldo_ofertado;
    }

    return NextResponse.json({ ok: true, registro });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el expediente." }, { status: 500 });
  }
}

