import { NextRequest } from "next/server";
import { getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, type SesionPayload } from "./sesion";

export async function sesionCompras(req: NextRequest): Promise<SesionPayload | null> {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  return t ? await verificarTokenSesion(t) : null;
}

// Solo el sysadmin y los roles que él asigne pueden autorizar órdenes de compra.
export async function puedeAutorizarOC(rol: string | undefined): Promise<boolean> {
  if (!rol) return false;
  if (rol === "sysadmin") return true;
  const r = await getPool().query(`SELECT 1 FROM compras_autorizadores WHERE rol = $1`, [rol]);
  return (r.rowCount || 0) > 0;
}
