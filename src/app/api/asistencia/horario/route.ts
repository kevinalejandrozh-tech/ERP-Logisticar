import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Horario individual de entrada y salida (se edita desde el expediente).
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const id = Number(req.nextUrl.searchParams.get("expediente_id"));
    if (!id) return NextResponse.json({ error: "Falta el expediente." }, { status: 400 });
    await ensureAsistenciaSchema();
    const r = await getPool().query(`SELECT hora_entrada, hora_salida FROM expedientes WHERE id = $1`, [id]);
    const c = await getPool().query(`SELECT hora_entrada, hora_salida FROM asistencia_config WHERE id = 1`);
    return NextResponse.json({ ok: true, horario: r.rows[0] || null, general: c.rows[0] || null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al leer el horario." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const id = Number(b.expediente_id);
    const ent = b.hora_entrada ? String(b.hora_entrada) : "";
    const sal = b.hora_salida ? String(b.hora_salida) : "";
    if (!id || (ent && !HORA.test(ent)) || (sal && !HORA.test(sal))) return NextResponse.json({ error: "Horario inválido (HH:MM)." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(`UPDATE expedientes SET hora_entrada = $2, hora_salida = $3 WHERE id = $1`, [id, ent || null, sal || null]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al guardar el horario." }, { status: 500 });
  }
}
