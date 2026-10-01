import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, leerConfigAsistencia, sesionAsistencia } from "@/lib/asistenciaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    return NextResponse.json({ ok: true, config: await leerConfigAsistencia() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al leer la configuración." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const entrada = String(b.hora_entrada || "");
    const salida = String(b.hora_salida || "");
    const tolerancia = Math.max(0, Math.min(240, Math.floor(Number(b.tolerancia_min) || 0)));
    const espera = Math.max(0, Math.min(120, Math.floor(Number(b.minutos_entre_registros) || 0)));
    if (!HORA.test(entrada) || !HORA.test(salida)) return NextResponse.json({ error: "Las horas deben tener formato HH:MM." }, { status: 400 });
    await ensureAsistenciaSchema();
    await getPool().query(
      `UPDATE asistencia_config SET hora_entrada = $1, hora_salida = $2, tolerancia_min = $3, minutos_entre_registros = $4, updated_at = now() WHERE id = 1`,
      [entrada, salida, tolerancia, espera]
    );
    return NextResponse.json({ ok: true, config: await leerConfigAsistencia() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Error al guardar la configuración." }, { status: 500 });
  }
}
