import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { COOKIE_SESION } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get(COOKIE_SESION)?.value;
    if (token) {
      try {
        await getPool().query(`DELETE FROM sesiones WHERE token = $1`, [token]);
      } catch {
        // si falla el borrado en base de datos, igual se limpia la cookie
      }
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_SESION, "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al cerrar sesión." }, { status: 500 });
  }
}
