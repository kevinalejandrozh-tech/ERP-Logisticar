import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: catálogo de artículos con existencias por ubicación (para existencias y requisiciones).
// ?imagen=ID devuelve solo la imagen del artículo.
export async function GET(req: NextRequest) {
  try {
    await ensureAlmacenSchema();
    const p = getPool();
    const img = Number(req.nextUrl.searchParams.get("imagen"));
    if (img) {
      const r = await p.query(`SELECT imagen FROM alm_articulos WHERE id = $1`, [img]);
      return NextResponse.json({ ok: true, imagen: r.rows[0]?.imagen || null });
    }
    const r = await p.query(
      `SELECT a.id, a.nombre, a.tipo, a.categoria, a.costo::float AS costo, (a.imagen IS NOT NULL) AS tiene_imagen,
              COALESCE(SUM(e.cantidad), 0)::float AS total,
              COALESCE(json_agg(json_build_object('ubicacion_id', u.id, 'codigo', u.codigo, 'cantidad', e.cantidad::float) ORDER BY u.codigo)
                FILTER (WHERE e.cantidad > 0), '[]') AS ubicaciones
       FROM alm_articulos a LEFT JOIN alm_existencias e ON e.articulo_id = a.id LEFT JOIN alm_ubicaciones u ON u.id = e.ubicacion_id
       GROUP BY a.id ORDER BY a.nombre`
    );
    return NextResponse.json({ ok: true, articulos: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer artículos." }, { status: 500 });
  }
}

// POST { id, imagen } — foto del artículo para el catálogo de requisiciones.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const id = Number(b?.id);
    const imagen = typeof b?.imagen === "string" ? b.imagen : "";
    if (!id || (imagen && (!imagen.startsWith("data:image/") || imagen.length > 1_000_000))) {
      return NextResponse.json({ error: "Imagen no válida." }, { status: 400 });
    }
    await ensureAlmacenSchema();
    await getPool().query(`UPDATE alm_articulos SET imagen = $2, updated_at = now() WHERE id = $1`, [id, imagen || null]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al guardar la imagen." }, { status: 500 });
  }
}
