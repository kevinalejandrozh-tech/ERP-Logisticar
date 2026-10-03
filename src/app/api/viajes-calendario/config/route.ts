import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Día de inicio y de término de la semana, exclusivo del Calendario de viajes (0 = domingo … 6 = sábado).
const esDia = (v: unknown) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 6;

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const r = await getPool().query(`SELECT dia_inicio, dia_fin FROM viajes_calendario_config WHERE id = 1`);
    const f = r.rows[0];
    return NextResponse.json({ ok: true, dia_inicio: f ? Number(f.dia_inicio) : 1, dia_fin: f ? Number(f.dia_fin) : 0 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer la configuración." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const ini = Number(b?.dia_inicio);
    const fin = Number(b?.dia_fin);
    if (!esDia(ini) || !esDia(fin)) return NextResponse.json({ error: "Días de la semana inválidos." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(
      `INSERT INTO viajes_calendario_config (id, dia_inicio, dia_fin, actualizado_por, updated_at) VALUES (1, $1, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET dia_inicio = EXCLUDED.dia_inicio, dia_fin = EXCLUDED.dia_fin, actualizado_por = EXCLUDED.actualizado_por, updated_at = now()`,
      [ini, fin, s.nombre]
    );
    return NextResponse.json({ ok: true, dia_inicio: ini, dia_fin: fin });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar la configuración." }, { status: 500 });
  }
}
