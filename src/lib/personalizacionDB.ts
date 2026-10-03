import { NextRequest } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion } from "./sesion";

// Modo edición (solo sysadmin): textos personalizados por página y botones nuevos del inicio.
let listo: Promise<void> | null = null;
export function ensurePersonalizacionSchema(): Promise<void> {
  if (!listo)
    listo = (async () => {
      await ensureSchema();
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS textos_personalizados (
          pagina TEXT NOT NULL,
          original TEXT NOT NULL,
          texto TEXT NOT NULL,
          actualizado_por TEXT,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (pagina, original)
        );
        CREATE TABLE IF NOT EXISTS inicio_botones (
          id SERIAL PRIMARY KEY,
          slug TEXT UNIQUE NOT NULL,
          titulo TEXT NOT NULL,
          descripcion TEXT,
          orden INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    })().catch((e) => {
      listo = null;
      throw e;
    });
  return listo;
}

export async function sesionDe(req: NextRequest) {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  return t ? await verificarTokenSesion(t) : null;
}
