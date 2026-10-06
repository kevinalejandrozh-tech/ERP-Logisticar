import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { CONV_VISIBLE, ensureChatSchema, iniciarLecturaGeneral, sesionChat } from "@/lib/chatDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: mis conversaciones (con último mensaje y no leídos) + usuarios con quienes puedo chatear.
export async function GET(req: NextRequest) {
  const s = await sesionChat(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureChatSchema();
    await iniciarLecturaGeneral(s.userId);
    const p = getPool();
    const c = await p.query(
      `SELECT c.id, c.tipo, c.nombre,
         (SELECT json_build_object('texto', m.texto, 'usuario', m.usuario_nombre, 'usuario_id', m.usuario_id, 'fecha', m.created_at) FROM chat_mensajes m WHERE m.conversacion_id = c.id ORDER BY m.id DESC LIMIT 1) AS ultimo,
         (SELECT COUNT(*)::int FROM chat_mensajes m WHERE m.conversacion_id = c.id AND m.id > COALESCE(l.ultimo_leido_id, 0) AND m.usuario_id <> $1) AS no_leidos,
         COALESCE((SELECT json_agg(json_build_object('id', u.id, 'nombre', u.nombre) ORDER BY u.nombre) FROM chat_participantes pp JOIN usuarios u ON u.id = pp.usuario_id WHERE pp.conversacion_id = c.id), '[]') AS miembros
       FROM chat_conversaciones c LEFT JOIN chat_lecturas l ON l.conversacion_id = c.id AND l.usuario_id = $1
       WHERE ${CONV_VISIBLE}
       ORDER BY (c.tipo = 'general') DESC, (SELECT MAX(m.created_at) FROM chat_mensajes m WHERE m.conversacion_id = c.id) DESC NULLS LAST, c.id`,
      [s.userId]
    );
    const u = await p.query(`SELECT id, nombre FROM usuarios WHERE id <> $1 ORDER BY nombre`, [s.userId]);
    return NextResponse.json({ ok: true, yo: { id: s.userId, nombre: s.nombre }, conversaciones: c.rows, usuarios: u.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer el chat." }, { status: 500 });
  }
}

// POST { accion: "directo", usuario_id } → abre (o crea) el chat 1 a 1 · { accion: "grupo", nombre, usuarios[] } → crea un grupo.
export async function POST(req: NextRequest) {
  const s = await sesionChat(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    await ensureChatSchema();
    const p = getPool();
    if (b?.accion === "directo") {
      const otro = Number(b?.usuario_id);
      const ex = await p.query(`SELECT id FROM usuarios WHERE id = $1`, [otro]);
      if (!otro || otro === s.userId || !ex.rowCount) return NextResponse.json({ error: "Usuario no válido." }, { status: 400 });
      const clave = `d:${Math.min(s.userId, otro)}:${Math.max(s.userId, otro)}`;
      await p.query(`INSERT INTO chat_conversaciones (tipo, clave, creado_por) VALUES ('directo', $1, $2) ON CONFLICT (clave) DO NOTHING`, [clave, s.userId]);
      const c = await p.query(`SELECT id FROM chat_conversaciones WHERE clave = $1`, [clave]);
      await p.query(`INSERT INTO chat_participantes (conversacion_id, usuario_id) VALUES ($1, $2), ($1, $3) ON CONFLICT DO NOTHING`, [c.rows[0].id, s.userId, otro]);
      return NextResponse.json({ ok: true, id: c.rows[0].id });
    }
    if (b?.accion === "grupo") {
      const nombre = String(b?.nombre || "").replace(/\s+/g, " ").trim().slice(0, 60);
      const ids: number[] = Array.from(new Set((Array.isArray(b?.usuarios) ? b.usuarios : []).map(Number).filter((n: number) => n > 0 && n !== s.userId))).slice(0, 50) as number[];
      if (!nombre || !ids.length) return NextResponse.json({ error: "Escribe el nombre del grupo y elige al menos a una persona." }, { status: 400 });
      const c = await p.query(`INSERT INTO chat_conversaciones (tipo, nombre, creado_por) VALUES ('grupo', $1, $2) RETURNING id`, [nombre, s.userId]);
      await p.query(`INSERT INTO chat_participantes (conversacion_id, usuario_id) SELECT $1, id FROM usuarios WHERE id = ANY($2::int[]) OR id = $3 ON CONFLICT DO NOTHING`, [c.rows[0].id, ids, s.userId]);
      return NextResponse.json({ ok: true, id: c.rows[0].id });
    }
    return NextResponse.json({ error: "Solicitud no válida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error en el chat." }, { status: 500 });
  }
}
