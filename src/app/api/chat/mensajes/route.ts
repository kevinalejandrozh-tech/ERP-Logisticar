import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureChatSchema, puedeVerConversacion, sesionChat } from "@/lib/chatDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET ?conversacion=ID[&despues=ID] → mensajes (los últimos 100, o solo los nuevos) y los marca como leídos.
export async function GET(req: NextRequest) {
  const s = await sesionChat(req);
  if (s instanceof NextResponse) return s;
  try {
    const conv = Number(req.nextUrl.searchParams.get("conversacion"));
    const despues = Number(req.nextUrl.searchParams.get("despues")) || null;
    await ensureChatSchema();
    if (!conv || !(await puedeVerConversacion(conv, s.userId))) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });
    const p = getPool();
    const r = await p.query(
      `SELECT id, usuario_id, usuario_nombre, texto, created_at FROM chat_mensajes WHERE conversacion_id = $1 AND ($2::int IS NULL OR id > $2) ORDER BY id DESC LIMIT 100`,
      [conv, despues]
    );
    const mensajes = r.rows.reverse();
    const max = await p.query(`SELECT COALESCE(MAX(id), 0)::int AS m FROM chat_mensajes WHERE conversacion_id = $1`, [conv]);
    await p.query(
      `INSERT INTO chat_lecturas (usuario_id, conversacion_id, ultimo_leido_id) VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, conversacion_id) DO UPDATE SET ultimo_leido_id = GREATEST(chat_lecturas.ultimo_leido_id, EXCLUDED.ultimo_leido_id)`,
      [s.userId, conv, max.rows[0].m]
    );
    return NextResponse.json({ ok: true, mensajes });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer mensajes." }, { status: 500 });
  }
}

// POST { conversacion, texto } → envía un mensaje.
export async function POST(req: NextRequest) {
  const s = await sesionChat(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const conv = Number(b?.conversacion);
    const texto = String(b?.texto || "").replace(/\r\n/g, "\n").trim().slice(0, 2000);
    if (!texto) return NextResponse.json({ error: "Escribe un mensaje." }, { status: 400 });
    await ensureChatSchema();
    if (!conv || !(await puedeVerConversacion(conv, s.userId))) return NextResponse.json({ error: "Conversación no disponible." }, { status: 404 });
    const p = getPool();
    const r = await p.query(`INSERT INTO chat_mensajes (conversacion_id, usuario_id, usuario_nombre, texto) VALUES ($1, $2, $3, $4) RETURNING id, created_at`, [conv, s.userId, s.nombre || "Usuario", texto]);
    await p.query(
      `INSERT INTO chat_lecturas (usuario_id, conversacion_id, ultimo_leido_id) VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id, conversacion_id) DO UPDATE SET ultimo_leido_id = GREATEST(chat_lecturas.ultimo_leido_id, EXCLUDED.ultimo_leido_id)`,
      [s.userId, conv, r.rows[0].id]
    );
    // Se conservan los últimos 1000 mensajes de cada conversación (no saturar la base).
    if (Math.random() < 0.03) await p.query(`DELETE FROM chat_mensajes WHERE conversacion_id = $1 AND id < (SELECT id FROM chat_mensajes WHERE conversacion_id = $1 ORDER BY id DESC OFFSET 999 LIMIT 1)`, [conv]).catch(() => {});
    return NextResponse.json({ ok: true, id: r.rows[0].id, created_at: r.rows[0].created_at });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al enviar." }, { status: 500 });
  }
}
