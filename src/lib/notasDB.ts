import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, type SesionPayload } from "./sesion";
import { puedeVerSeccion } from "./permisos";

// Notas personales: cada usuario ve y edita las suyas y las que otro usuario le comparte (ambos pueden editarlas; solo el dueño las elimina o cambia con quién se comparten). Los adjuntos se borran con la nota (ON DELETE CASCADE).
let listo: Promise<void> | null = null;

export function ensureNotasSchema(): Promise<void> {
  if (!listo)
    listo = (async () => {
      await ensureSchema();
      await getPool().query(`
        CREATE TABLE IF NOT EXISTS notas (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL,
          titulo TEXT NOT NULL DEFAULT '',
          contenido TEXT NOT NULL DEFAULT '',
          importante BOOLEAN NOT NULL DEFAULT false,
          vence_en TIMESTAMPTZ,
          terminada BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_notas_usuario ON notas (usuario_id);
        CREATE TABLE IF NOT EXISTS notas_compartidas (
          nota_id INTEGER NOT NULL REFERENCES notas(id) ON DELETE CASCADE,
          usuario_id INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (nota_id, usuario_id)
        );
        CREATE INDEX IF NOT EXISTS idx_notas_comp_usuario ON notas_compartidas (usuario_id);
        CREATE TABLE IF NOT EXISTS notas_adjuntos (
          id SERIAL PRIMARY KEY,
          nota_id INTEGER NOT NULL REFERENCES notas(id) ON DELETE CASCADE,
          nombre TEXT NOT NULL,
          mime TEXT NOT NULL,
          contenido TEXT NOT NULL,
          leyenda TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    })().catch((e) => {
      listo = null;
      throw e;
    });
  return listo;
}

// Sesión con acceso a Notas (sysadmin siempre; los demás si su rol tiene la sección activada).
export async function sesionNotas(req: NextRequest): Promise<SesionPayload | NextResponse> {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!puedeVerSeccion("notas", s.rol, s.secciones)) return NextResponse.json({ error: "Tu rol no tiene acceso a Notas." }, { status: 403 });
  return s;
}

// ¿Puede este usuario ver/editar la nota? (dueño o usuario con quien se compartió)
export async function puedeAccederNota(notaId: number, userId: number): Promise<boolean> {
  const r = await getPool().query(
    `SELECT 1 FROM notas n WHERE n.id = $1 AND (n.usuario_id = $2 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $2))`,
    [notaId, userId]
  );
  return (r.rowCount || 0) > 0;
}

// Limpieza básica del HTML del lienzo (las notas son personales, pero no se guardan scripts ni eventos).
export function limpiarHtml(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, "$1=$2#$2")
    .slice(0, 200_000);
}

export const MIMES_NOTAS = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
