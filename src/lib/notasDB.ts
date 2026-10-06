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
        ALTER TABLE notas ADD COLUMN IF NOT EXISTS editado_por TEXT;
        CREATE TABLE IF NOT EXISTS notas_carpetas (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL,
          nombre TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_notas_carpetas_usuario ON notas_carpetas (usuario_id);
        CREATE TABLE IF NOT EXISTS notas_usuario (
          usuario_id INTEGER NOT NULL,
          nota_id INTEGER NOT NULL REFERENCES notas(id) ON DELETE CASCADE,
          orden INTEGER,
          carpeta_id INTEGER,
          PRIMARY KEY (usuario_id, nota_id)
        );
        CREATE TABLE IF NOT EXISTS notas_avisos (
          id SERIAL PRIMARY KEY,
          usuario_id INTEGER NOT NULL,
          nota_id INTEGER,
          tipo TEXT NOT NULL,
          de TEXT NOT NULL DEFAULT '',
          texto TEXT NOT NULL,
          mostrado BOOLEAN NOT NULL DEFAULT false,
          creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS idx_notas_avisos_usuario ON notas_avisos (usuario_id, creado_en DESC);
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

// Condición SQL: la nota la ve el usuario ($1 = id del usuario) por ser suya o compartida con él.
export const NOTA_VISIBLE = `(n.usuario_id = $1 OR EXISTS (SELECT 1 FROM notas_compartidas c WHERE c.nota_id = n.id AND c.usuario_id = $1))`;

// Dueño y usuarios con quienes se comparte la nota.
export async function participantesNota(notaId: number): Promise<number[]> {
  const r = await getPool().query(
    `SELECT usuario_id FROM notas WHERE id = $1 UNION SELECT usuario_id FROM notas_compartidas WHERE nota_id = $1`,
    [notaId]
  );
  return r.rows.map((x) => Number(x.usuario_id));
}

// Aviso inmediato entre usuarios (toast + campana). Si ya hay uno igual de hace < 30 s, se actualiza en lugar de duplicarlo.
export async function avisar(destinatarios: number[], notaId: number | null, tipo: string, de: string, texto: string) {
  const p = getPool();
  for (const uid of Array.from(new Set(destinatarios))) {
    const u = await p.query(
      `UPDATE notas_avisos SET texto = $5, de = $4, creado_en = now(), mostrado = false
       WHERE usuario_id = $1 AND nota_id IS NOT DISTINCT FROM $2 AND tipo = $3 AND creado_en > now() - interval '30 seconds'`,
      [uid, notaId, tipo, de, texto]
    );
    if (!u.rowCount) await p.query(`INSERT INTO notas_avisos (usuario_id, nota_id, tipo, de, texto) VALUES ($1, $2, $3, $4, $5)`, [uid, notaId, tipo, de, texto]);
  }
}

// Huella de todo lo que el usuario ve en Notas (cambia con cualquier edición, compartido, orden, carpeta, archivos u OC).
// El navegador la consulta cada pocos segundos y recarga solo cuando cambia.
export async function versionNotas(userId: number): Promise<string> {
  const r = await getPool().query(
    `SELECT md5(
       COALESCE((SELECT string_agg(
         n.id::text || ':' || (extract(epoch from n.updated_at) * 1000)::bigint::text || ':' || n.terminada::text || ':' || COALESCE(nu.orden, -1)::text || ':' || COALESCE(nu.carpeta_id, 0)::text
         || ':' || (SELECT count(*) FROM notas_adjuntos a WHERE a.nota_id = n.id)::text
         || ':' || COALESCE((SELECT string_agg(c2.usuario_id::text, '.' ORDER BY c2.usuario_id) FROM notas_compartidas c2 WHERE c2.nota_id = n.id), '')
         || ':' || COALESCE((SELECT sum(o.total_general) FROM ordenes_compra o WHERE o.nota_id = n.id), 0)::text,
         ',' ORDER BY n.id)
         FROM notas n LEFT JOIN notas_usuario nu ON nu.nota_id = n.id AND nu.usuario_id = $1
         WHERE ${NOTA_VISIBLE}), '')
       || '|' || COALESCE((SELECT string_agg(f.id::text || '-' || f.nombre, ',' ORDER BY f.id) FROM notas_carpetas f WHERE f.usuario_id = $1), '')
     ) AS v`,
    [userId]
  );
  return String(r.rows[0]?.v || "");
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
