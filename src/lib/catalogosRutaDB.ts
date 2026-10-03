import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, type SesionPayload } from "./sesion";
import { puedeVerSeccion } from "./permisos";
import { CATALOGOS } from "./catalogosRutaData";

let listo: Promise<void> | null = null;
export function ensureCatalogosRutaSchema(): Promise<void> {
  if (!listo)
    listo = (async () => {
      await ensureSchema();
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS catalogos_ruta (
          id SERIAL PRIMARY KEY,
          tipo TEXT NOT NULL,
          nombre TEXT NOT NULL,
          datos JSONB NOT NULL DEFAULT '{}'::jsonb,
          adjunto TEXT,
          adjunto_nombre TEXT,
          activo BOOLEAN NOT NULL DEFAULT true,
          creado_por TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_catalogos_ruta_tipo ON catalogos_ruta (tipo, nombre);
      `);
    })().catch((e) => {
      listo = null;
      throw e;
    });
  return listo;
}

// Sesión válida y con acceso al catálogo (las zonas sin cobertura solo las ve Monitoreo de Rutas).
export async function sesionCatalogo(req: NextRequest, tipo: string): Promise<SesionPayload | NextResponse> {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!CATALOGOS[tipo]) return NextResponse.json({ error: "Catálogo no válido." }, { status: 400 });
  if (CATALOGOS[tipo].soloMonitoreo && !puedeVerSeccion("monitoreo_rutas", s.rol, s.secciones)) {
    return NextResponse.json({ error: "Este catálogo solo lo ve Monitoreo de Rutas." }, { status: 403 });
  }
  return s;
}
