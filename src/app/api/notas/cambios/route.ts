import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureNotasSchema, sesionNotas, versionNotas } from "@/lib/notasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Sondeo ligero (cada pocos segundos desde el navegador): huella de cambios + avisos nuevos entre usuarios.
// Los avisos se entregan una sola vez (se marcan como mostrados).
export async function GET(req: NextRequest) {
  const s = await sesionNotas(req);
  if (s instanceof NextResponse) return s;
  try {
    await ensureNotasSchema();
    const version = await versionNotas(s.userId);
    const a = await getPool().query(
      `UPDATE notas_avisos SET mostrado = true WHERE usuario_id = $1 AND NOT mostrado RETURNING id, nota_id, de, texto, creado_en`,
      [s.userId]
    );
    return NextResponse.json({ ok: true, version, avisos: a.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al consultar cambios." }, { status: 500 });
  }
}
