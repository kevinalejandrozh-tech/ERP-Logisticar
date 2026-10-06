import { NextRequest, NextResponse } from "next/server";
import { getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, SesionPayload } from "./sesion";

// Mensajes: chat entre usuarios del sistema (grupo general "Todos", conversaciones 1 a 1 y grupos).
let esquemaListo: Promise<void> | null = null;
async function crear() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS chat_conversaciones (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      nombre TEXT,
      clave TEXT UNIQUE,
      creado_por INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS chat_participantes (
      conversacion_id INTEGER NOT NULL REFERENCES chat_conversaciones(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL,
      PRIMARY KEY (conversacion_id, usuario_id)
    );
    CREATE TABLE IF NOT EXISTS chat_mensajes (
      id SERIAL PRIMARY KEY,
      conversacion_id INTEGER NOT NULL REFERENCES chat_conversaciones(id) ON DELETE CASCADE,
      usuario_id INTEGER NOT NULL,
      usuario_nombre TEXT NOT NULL,
      texto TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_mensajes_conv ON chat_mensajes (conversacion_id, id DESC);
    CREATE TABLE IF NOT EXISTS chat_lecturas (
      usuario_id INTEGER NOT NULL,
      conversacion_id INTEGER NOT NULL REFERENCES chat_conversaciones(id) ON DELETE CASCADE,
      ultimo_leido_id INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (usuario_id, conversacion_id)
    );
    CREATE TABLE IF NOT EXISTS chat_estado (
      usuario_id INTEGER PRIMARY KEY,
      avisado_id INTEGER NOT NULL DEFAULT 0
    );
    INSERT INTO chat_conversaciones (tipo, nombre, clave) VALUES ('general', 'Todos', 'general') ON CONFLICT (clave) DO NOTHING;
  `);
}
export function ensureChatSchema(): Promise<void> {
  if (!esquemaListo) esquemaListo = crear().catch((e) => ((esquemaListo = null), Promise.reject(e)));
  return esquemaListo;
}

// Cualquier usuario con sesión puede usar el chat.
export async function sesionChat(req: NextRequest): Promise<SesionPayload | NextResponse> {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return s;
}

// Condición SQL ($1 = usuario): el grupo general es de todos; los demás, solo de sus participantes.
export const CONV_VISIBLE = `(c.tipo = 'general' OR EXISTS (SELECT 1 FROM chat_participantes p WHERE p.conversacion_id = c.id AND p.usuario_id = $1))`;

// El grupo general empieza "leído" para quien entra por primera vez (no se llena de no leídos con el historial).
export async function iniciarLecturaGeneral(userId: number) {
  await getPool().query(
    `INSERT INTO chat_lecturas (usuario_id, conversacion_id, ultimo_leido_id)
     SELECT $1, c.id, COALESCE((SELECT MAX(id) FROM chat_mensajes WHERE conversacion_id = c.id), 0) FROM chat_conversaciones c WHERE c.tipo = 'general'
     ON CONFLICT DO NOTHING`,
    [userId]
  );
}

export async function puedeVerConversacion(convId: number, userId: number): Promise<boolean> {
  const r = await getPool().query(`SELECT 1 FROM chat_conversaciones c WHERE c.id = $2 AND ${CONV_VISIBLE}`, [userId, convId]);
  return (r.rowCount || 0) > 0;
}
