import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde + "T00:00:00Z").getTime();
  const b = new Date(hasta + "T00:00:00Z").getTime();
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
}

export async function GET(req: NextRequest) {
  try {
    const desde = req.nextUrl.searchParams.get("desde");
    const hasta = req.nextUrl.searchParams.get("hasta");
    if (!desde || !hasta) return NextResponse.json({ error: "Faltan las fechas desde/hasta." }, { status: 400 });

    await ensureSchema();
    const pool = getPool();
    const hoy = new Date().toISOString().slice(0, 10);

    const personasRes = await pool.query(`SELECT id, nombre, puesto, fecha_ingreso FROM expedientes WHERE estatus_laboral != 'Baja' ORDER BY nombre ASC`);
    const marcasRango = await pool.query(`SELECT expediente_id, to_char(fecha, 'YYYY-MM-DD') AS fecha, presente FROM asistencia_diaria WHERE fecha BETWEEN $1 AND $2`, [desde, hasta]);
    const conteoTotal = await pool.query(`SELECT expediente_id, COUNT(*) FILTER (WHERE presente)::int AS presentes FROM asistencia_diaria GROUP BY expediente_id`);

    const presentesPorPersona: Record<number, number> = {};
    for (const row of conteoTotal.rows) presentesPorPersona[row.expediente_id] = row.presentes;

    const marcas: Record<number, Record<string, boolean>> = {};
    for (const row of marcasRango.rows) {
      if (!marcas[row.expediente_id]) marcas[row.expediente_id] = {};
      marcas[row.expediente_id][row.fecha] = row.presente;
    }

    const personas = personasRes.rows.map((p) => {
      const inicio = p.fecha_ingreso ? String(p.fecha_ingreso).slice(0, 10) : hoy;
      const diasTranscurridos = diasEntre(inicio > hoy ? hoy : inicio, hoy);
      const diasPresente = presentesPorPersona[p.id] || 0;
      const porcentaje = diasTranscurridos > 0 ? Math.round((diasPresente / diasTranscurridos) * 100) : 0;
      const inasistencias = Math.max(0, diasTranscurridos - diasPresente);
      return { id: p.id, nombre: p.nombre, puesto: p.puesto, porcentaje, inasistencias, marcas: marcas[p.id] || {} };
    });

    return NextResponse.json({ ok: true, personas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la asistencia." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { expediente_id, fecha, presente } = await req.json();
    if (!expediente_id || !fecha) return NextResponse.json({ error: "Faltan datos." }, { status: 400 });
    await ensureSchema();
    await getPool().query(
      `INSERT INTO asistencia_diaria (expediente_id, fecha, presente) VALUES ($1,$2,$3)
       ON CONFLICT (expediente_id, fecha) DO UPDATE SET presente = $3`,
      [expediente_id, fecha, !!presente]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la asistencia." }, { status: 500 });
  }
}
