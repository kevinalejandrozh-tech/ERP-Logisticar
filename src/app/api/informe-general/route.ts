import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { FECHA_RE, ensureInformeSchema, sesionInforme } from "@/lib/informeDB";
import { ahoraMx } from "@/lib/asistenciaData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const txt = (v: unknown, max: number) => String(v ?? "").slice(0, max);

// GET ?fecha=AAAA-MM-DD → informe de ese día (vacío si aún no existe).
export async function GET(req: NextRequest) {
  const s = await sesionInforme(req);
  if (s instanceof NextResponse) return s;
  try {
    const fecha = req.nextUrl.searchParams.get("fecha") || ahoraMx().fecha;
    if (!FECHA_RE.test(fecha)) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
    await ensureInformeSchema();
    const r = await getPool().query(`SELECT monitoreo, tarjetas, incidencias, liquidacion, actualizado_por, updated_at FROM informe_general WHERE fecha = $1`, [fecha]);
    const x = r.rows[0];
    return NextResponse.json({ ok: true, fecha, monitoreo: x?.monitoreo || [], tarjetas: x?.tarjetas || "", incidencias: x?.incidencias || "", liquidacion: x?.liquidacion || "", actualizado_por: x?.actualizado_por || null, updated_at: x?.updated_at || null });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer el informe." }, { status: 500 });
  }
}

// PUT { fecha, monitoreo[], tarjetas, incidencias, liquidacion } → guarda el informe del día.
export async function PUT(req: NextRequest) {
  const s = await sesionInforme(req);
  if (s instanceof NextResponse) return s;
  try {
    const b = await req.json();
    const fecha = String(b?.fecha || "");
    if (!FECHA_RE.test(fecha)) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
    const filas = (Array.isArray(b?.monitoreo) ? b.monitoreo : []).slice(0, 300).map((f: Record<string, unknown>) => ({
      id: txt(f?.id, 40) || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      eco: txt(f?.eco, 40),
      operador: txt(f?.operador, 120),
      ruta: txt(f?.ruta, 200),
      estatus: txt(f?.estatus, 120),
      ubicacion: txt(f?.ubicacion, 300),
      comentarios: txt(f?.comentarios, 1000),
    }));
    await ensureInformeSchema();
    const r = await getPool().query(
      `INSERT INTO informe_general (fecha, monitoreo, tarjetas, incidencias, liquidacion, actualizado_por)
       VALUES ($1, $2::jsonb, $3, $4, $5, $6)
       ON CONFLICT (fecha) DO UPDATE SET monitoreo = EXCLUDED.monitoreo, tarjetas = EXCLUDED.tarjetas, incidencias = EXCLUDED.incidencias,
         liquidacion = EXCLUDED.liquidacion, actualizado_por = EXCLUDED.actualizado_por, updated_at = now()
       RETURNING updated_at`,
      [fecha, JSON.stringify(filas), txt(b?.tarjetas, 30000), txt(b?.incidencias, 30000), txt(b?.liquidacion, 30000), s.nombre || null]
    );
    return NextResponse.json({ ok: true, updated_at: r.rows[0].updated_at });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar el informe." }, { status: 500 });
  }
}
