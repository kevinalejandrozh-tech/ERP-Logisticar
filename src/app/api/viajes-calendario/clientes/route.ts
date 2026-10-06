import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAsistenciaSchema, sesionAsistencia } from "@/lib/asistenciaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Catálogo de clientes para "Nombre cuenta": los dados de alta + los que ya se usaron en viajes (sin repetir).
export async function GET(req: NextRequest) {
  const s = await sesionAsistencia(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureAsistenciaSchema();
    const r = await getPool().query(
      `SELECT MIN(nombre) AS nombre FROM (
         SELECT nombre FROM clientes_catalogo
         UNION ALL
         SELECT TRIM(datos->>'NOMBRE CUENTA') FROM viajes_calendario WHERE COALESCE(TRIM(datos->>'NOMBRE CUENTA'), '') <> ''
       ) t GROUP BY LOWER(nombre) ORDER BY LOWER(MIN(nombre))`
    );
    return NextResponse.json({ ok: true, clientes: r.rows.map((x) => x.nombre) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer los clientes." }, { status: 500 });
  }
}
