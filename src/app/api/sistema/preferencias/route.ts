import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureActividadSchema, sesionDeRequest } from "@/lib/actividadDB";
import { CLAVES_PREFERENCIAS, OPCIONES_NOTIF_MAX, ensureSistemaSchema } from "@/lib/sistemaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Preferencias personales: orden del inicio, límite de notificaciones y notas minimizadas.
export async function GET(req: NextRequest) {
  const s = await sesionDeRequest(req);
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const clave = req.nextUrl.searchParams.get("clave") || "";
  if (!CLAVES_PREFERENCIAS.includes(clave)) return NextResponse.json({ error: "Preferencia no válida." }, { status: 400 });
  try {
    await ensureSistemaSchema();
    const r = await getPool().query(`SELECT valor FROM usuario_preferencias WHERE usuario_id = $1 AND clave = $2`, [s.userId, clave]);
    return NextResponse.json({ ok: true, valor: r.rowCount ? r.rows[0].valor : null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionDeRequest(req);
  if (!s) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const b = await req.json();
    const clave = String(b?.clave || "");
    if (!CLAVES_PREFERENCIAS.includes(clave)) return NextResponse.json({ error: "Preferencia no válida." }, { status: 400 });
    let valor = b?.valor;
    if (clave === "notif_max") {
      valor = Number(valor);
      if (!OPCIONES_NOTIF_MAX.includes(valor)) return NextResponse.json({ error: "Límite no válido." }, { status: 400 });
    }
    if (JSON.stringify(valor ?? null).length > 20000) return NextResponse.json({ error: "Valor demasiado grande." }, { status: 400 });
    await ensureSistemaSchema();
    const p = getPool();
    await p.query(
      `INSERT INTO usuario_preferencias (usuario_id, clave, valor) VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (usuario_id, clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = now()`,
      [s.userId, clave, JSON.stringify(valor ?? null)]
    );
    // Al bajar el límite de notificaciones se libera espacio: se conservan solo las N más recientes.
    if (clave === "notif_max") {
      await ensureActividadSchema();
      const tope = await p.query(`SELECT COALESCE(MAX((valor #>> '{}')::int), 50) AS m FROM usuario_preferencias WHERE clave = 'notif_max'`);
      await p.query(`DELETE FROM actividad_usuarios WHERE id NOT IN (SELECT id FROM actividad_usuarios ORDER BY updated_at DESC LIMIT $1)`, [Math.max(50, Number(tope.rows[0]?.m) || 50)]);
      await p.query(`DELETE FROM notas_avisos WHERE usuario_id = $1 AND id NOT IN (SELECT id FROM notas_avisos WHERE usuario_id = $1 ORDER BY creado_en DESC LIMIT $2)`, [s.userId, valor]).catch(() => {});
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}
