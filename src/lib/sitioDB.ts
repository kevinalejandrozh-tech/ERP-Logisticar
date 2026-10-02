import { NextRequest, NextResponse } from "next/server";
import { getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, SesionPayload } from "./sesion";

// Esquema propio del sitio web público (/sitio): contenido editable, imágenes subidas y suscriptores del boletín.
let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS sitio_contenido (
      id INTEGER PRIMARY KEY DEFAULT 1,
      contenido JSONB NOT NULL,
      actualizado_por TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS sitio_imagenes (
      id SERIAL PRIMARY KEY,
      mime TEXT NOT NULL,
      datos TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS sitio_suscriptores (
      id SERIAL PRIMARY KEY,
      correo TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export function ensureSitioSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((e) => {
      esquemaListo = null;
      throw e;
    });
  }
  return esquemaListo;
}

// Las rutas del sitio son públicas en el middleware; las que modifican el sitio
// verifican aquí que la sesión sea de sysadmin.
export async function sesionSysadmin(req: NextRequest): Promise<SesionPayload | NextResponse> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarTokenSesion(token) : null;
  if (!sesion) return NextResponse.json({ error: "Inicia sesión para editar el sitio." }, { status: 401 });
  if (sesion.rol !== "sysadmin") return NextResponse.json({ error: "Solo el administrador del sistema puede editar el sitio." }, { status: 403 });
  return sesion;
}

export function errorSitio(err: unknown, mensaje: string) {
  console.error(mensaje, err);
  return NextResponse.json({ error: mensaje }, { status: 500 });
}
