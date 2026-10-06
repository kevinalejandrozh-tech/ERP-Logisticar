import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { CONV_VISIBLE, ensureChatSchema, iniciarLecturaGeneral, sesionChat } from "@/lib/chatDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Sondeo ligero del icono de Mensajes: total de no leídos + mensajes nuevos para avisar (una sola vez cada uno).
export async function GET(req: NextRequest) {
  const s = await sesionChat(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureChatSchema();
    await iniciarLecturaGeneral(s.userId);
    const p = getPool();
    const tot = await p.query(
      `SELECT COALESCE(SUM((SELECT COUNT(*) FROM chat_mensajes m WHERE m.conversacion_id = c.id AND m.id > COALESCE(l.ultimo_leido_id, 0) AND m.usuario_id <> $1)), 0)::int AS n
       FROM chat_conversaciones c LEFT JOIN chat_lecturas l ON l.conversacion_id = c.id AND l.usuario_id = $1 WHERE ${CONV_VISIBLE}`,
      [s.userId]
    );
    const max = await p.query(`SELECT COALESCE(MAX(m.id), 0)::int AS m FROM chat_mensajes m JOIN chat_conversaciones c ON c.id = m.conversacion_id WHERE ${CONV_VISIBLE}`, [s.userId]);
    const est = await p.query(`SELECT avisado_id FROM chat_estado WHERE usuario_id = $1`, [s.userId]);
    let nuevos: unknown[] = [];
    if (est.rowCount) {
      const n = await p.query(
        `SELECT m.id, m.conversacion_id, m.usuario_nombre AS de, m.texto, c.tipo, c.nombre
         FROM chat_mensajes m JOIN chat_conversaciones c ON c.id = m.conversacion_id
         WHERE m.id > $2 AND m.usuario_id <> $1 AND ${CONV_VISIBLE} ORDER BY m.id DESC LIMIT 3`,
        [s.userId, est.rows[0].avisado_id]
      );
      nuevos = n.rows.reverse();
    }
    await p.query(
      `INSERT INTO chat_estado (usuario_id, avisado_id) VALUES ($1, $2) ON CONFLICT (usuario_id) DO UPDATE SET avisado_id = GREATEST(chat_estado.avisado_id, EXCLUDED.avisado_id)`,
      [s.userId, max.rows[0].m]
    );
    return NextResponse.json({ ok: true, noLeidos: tot.rows[0].n, nuevos });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}
