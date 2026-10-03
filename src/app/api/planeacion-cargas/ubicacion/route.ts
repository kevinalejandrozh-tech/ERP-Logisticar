import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema } from "@/lib/asistenciaDB";
import { COOKIE_SESION, verificarTokenSesion } from "@/lib/sesion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Monitoreo de Rutas: viajes en curso (iniciados en los últimos 14 días y sin arribo a patio) con su ubicación actual.
export async function GET() {
  try {
    await ensureAsistenciaSchema();
    const r = await getPool().query(
      `SELECT v.id, v.eco, to_char(v.fecha, 'YYYY-MM-DD') AS fecha, v.datos
       FROM viajes_calendario v
       WHERE v.fecha >= (now() AT TIME ZONE 'America/Mexico_City')::date - 14
         AND COALESCE(v.datos->>'ARRIBO A PATIOO', '') = ''
       ORDER BY v.fecha DESC, v.eco`
    );
    return NextResponse.json({ ok: true, viajes: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer los viajes." }, { status: 500 });
  }
}

// POST { id, ubicacion } — registra la ubicación actual (con hora y usuario) en el viaje del calendario.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const id = Number(b?.id);
    const ubicacion = String(b?.ubicacion || "").trim().slice(0, 300);
    if (!id || !ubicacion) return NextResponse.json({ error: "Escribe la ubicación actual." }, { status: 400 });
    const t = req.cookies.get(COOKIE_SESION)?.value;
    const s = t ? await verificarTokenSesion(t) : null;
    await ensureAsistenciaSchema();
    const r = await getPool().query(
      `UPDATE viajes_calendario SET datos = datos || jsonb_build_object('UBICACION ACTUAL', $2::text, 'UBICACION ACTUALIZADA', to_char(now() AT TIME ZONE 'America/Mexico_City', 'YYYY-MM-DD"T"HH24:MI'), 'UBICACION USUARIO', $3::text), updated_at = now()
       WHERE id = $1 RETURNING datos`,
      [id, ubicacion, s?.nombre || "—"]
    );
    if (!r.rowCount) return NextResponse.json({ error: "El viaje no existe." }, { status: 404 });
    return NextResponse.json({ ok: true, datos: r.rows[0].datos });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar la ubicación." }, { status: 500 });
  }
}
