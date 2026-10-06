import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureActividadSchema, sesionDeRequest } from "@/lib/actividadDB";
import { tituloDeRuta } from "@/lib/paginas";
import { sinNotificacion } from "@/lib/actividadReglas";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Registra un movimiento hecho por el usuario en sesión (lo envía RegistroActividad desde el navegador).
// Cambios repetidos en la misma página y API dentro de 3 minutos se agrupan en un solo registro.
export async function POST(req: NextRequest) {
  const sesion = await sesionDeRequest(req);
  if (!sesion) return NextResponse.json({ ok: false });
  try {
    const body = await req.json().catch(() => ({}));
    const metodo = String(body.metodo || "POST").toUpperCase().slice(0, 10);
    const api = String(body.api || "").split("?")[0].slice(0, 200);
    const pagina = String(body.pagina || "/").split("?")[0].slice(0, 200);
    if (!api.startsWith("/api/") || sinNotificacion(api)) return NextResponse.json({ ok: false });
    await ensureActividadSchema();
    const p = getPool();
    const actualizado = await p.query(
      `UPDATE actividad_usuarios SET veces = veces + 1, updated_at = now()
       WHERE id = (
         SELECT id FROM actividad_usuarios
         WHERE usuario_id = $1 AND metodo = $2 AND api = $3 AND pagina = $4 AND updated_at > now() - interval '3 minutes'
         ORDER BY updated_at DESC LIMIT 1
       )`,
      [sesion.userId, metodo, api, pagina]
    );
    if (!actualizado.rowCount) {
      await p.query(
        `INSERT INTO actividad_usuarios (usuario_id, usuario_nombre, metodo, api, pagina, pagina_titulo) VALUES ($1, $2, $3, $4, $5, $6)`,
        [sesion.userId, sesion.nombre || "Usuario", metodo, api, pagina, tituloDeRuta(pagina)]
      );
      // Limpieza ligera: conserva solo los últimos 60 días.
      if (Math.random() < 0.05) await p.query(`DELETE FROM actividad_usuarios WHERE updated_at < now() - interval '60 days'`);
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Error al registrar actividad." }, { status: 500 });
  }
}
