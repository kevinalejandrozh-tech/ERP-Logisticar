import { NextRequest, NextResponse } from "next/server";
import { getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, SesionPayload } from "./sesion";
import { puedeVerSeccion } from "./permisos";

// Informe General: un informe por día (reporte de monitoreo, tarjetas/radios/mochilas, incidencias y liquidación).
let esquemaListo: Promise<void> | null = null;
async function crear() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS informe_general (
      fecha DATE PRIMARY KEY,
      monitoreo JSONB NOT NULL DEFAULT '[]'::jsonb,
      tarjetas TEXT NOT NULL DEFAULT '',
      incidencias TEXT NOT NULL DEFAULT '',
      liquidacion TEXT NOT NULL DEFAULT '',
      actualizado_por TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
export function ensureInformeSchema(): Promise<void> {
  if (!esquemaListo) esquemaListo = crear().catch((e) => ((esquemaListo = null), Promise.reject(e)));
  return esquemaListo;
}

export async function sesionInforme(req: NextRequest): Promise<SesionPayload | NextResponse> {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!puedeVerSeccion("informe_general", s.rol, s.secciones)) return NextResponse.json({ error: "Tu rol no tiene acceso al Informe General." }, { status: 403 });
  return s;
}

export const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
