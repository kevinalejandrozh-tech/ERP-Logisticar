import { NextRequest } from "next/server";
import { getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, SesionPayload } from "./sesion";

// Esquema propio de: registro de actividad (notificaciones) y favoritos por usuario.
let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS actividad_usuarios (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL,
      usuario_nombre TEXT NOT NULL,
      metodo TEXT NOT NULL,
      api TEXT NOT NULL,
      pagina TEXT NOT NULL,
      pagina_titulo TEXT NOT NULL,
      veces INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`CREATE INDEX IF NOT EXISTS actividad_usuarios_fecha_idx ON actividad_usuarios (updated_at DESC);`);
  await p.query(`
    CREATE TABLE IF NOT EXISTS notificaciones_vistas (
      usuario_id INTEGER PRIMARY KEY,
      visto_hasta TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS favoritos_usuarios (
      usuario_id INTEGER NOT NULL,
      ruta TEXT NOT NULL,
      titulo TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (usuario_id, ruta)
    );
  `);
}

export function ensureActividadSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((e) => {
      esquemaListo = null;
      throw e;
    });
  }
  return esquemaListo;
}

export async function sesionDeRequest(req: NextRequest): Promise<SesionPayload | null> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  return token ? await verificarTokenSesion(token) : null;
}

// Muchos endpoints usan POST para editar o borrar (…/update, …/delete), así que también se revisa la ruta de la API.
export function describirAccion(metodo: string, api: string): string {
  const m = metodo.toUpperCase();
  const a = api.toLowerCase();
  if (m === "DELETE" || /\/(delete|eliminar|baja)(\/|$)/.test(a)) return "Eliminó información";
  if (m === "PUT" || m === "PATCH" || /\/(update|celda|estado|abono)(\/|$)/.test(a)) return "Actualizó información";
  return "Agregó información";
}
