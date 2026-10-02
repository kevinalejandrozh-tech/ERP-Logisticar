import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureSitioSchema, errorSitio, sesionSysadmin } from "@/lib/sitioDB";
import { idsImagenesUsadas, normalizarContenido } from "@/lib/sitioData";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Público: contenido actual del sitio (o los textos iniciales si nunca se ha guardado).
export async function GET() {
  try {
    await ensureSitioSchema();
    const r = await getPool().query(`SELECT contenido FROM sitio_contenido WHERE id = 1`);
    return NextResponse.json({ ok: true, contenido: normalizarContenido(r.rows[0]?.contenido) });
  } catch (err) {
    return errorSitio(err, "No se pudo leer el contenido del sitio.");
  }
}

// Solo sysadmin: guarda el contenido completo y elimina las imágenes subidas que ya no se usan.
export async function PUT(req: NextRequest) {
  const s = await sesionSysadmin(req);
  if (s instanceof NextResponse) return s;
  try {
    const cuerpo = await req.json().catch(() => null);
    if (!cuerpo || typeof cuerpo !== "object" || !("contenido" in cuerpo)) {
      return NextResponse.json({ error: "Falta el contenido a guardar." }, { status: 400 });
    }
    const contenido = normalizarContenido((cuerpo as { contenido: unknown }).contenido);
    await ensureSitioSchema();
    const pool = getPool();
    await pool.query(
      `INSERT INTO sitio_contenido (id, contenido, actualizado_por, updated_at) VALUES (1, $1, $2, now())
       ON CONFLICT (id) DO UPDATE SET contenido = EXCLUDED.contenido, actualizado_por = EXCLUDED.actualizado_por, updated_at = now()`,
      [JSON.stringify(contenido), s.nombre]
    );
    await pool.query(`DELETE FROM sitio_imagenes WHERE NOT (id = ANY($1::int[]))`, [idsImagenesUsadas(contenido)]);
    return NextResponse.json({ ok: true, contenido });
  } catch (err) {
    return errorSitio(err, "No se pudo guardar el contenido del sitio.");
  }
}
