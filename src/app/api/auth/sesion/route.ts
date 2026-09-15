import { NextRequest, NextResponse } from "next/server";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  if (!token) return NextResponse.json({ ok: false });
  const sesion = await verificarTokenSesion(token);
  if (!sesion) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: true, nombre: sesion.nombre, correo: sesion.correo, rol: sesion.rol });
}
