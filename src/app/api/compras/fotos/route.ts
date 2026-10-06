import { NextRequest, NextResponse } from "next/server";
import { getPool, ensureSchema } from "@/lib/db";
import { sesionCompras } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET ?folio= → fotos de referencia de los artículos de la OC (mismo orden que los productos; null si no tienen).
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    if (!(await sesionCompras(req))) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    const folio = req.nextUrl.searchParams.get("folio") || "";
    const r = await getPool().query(`SELECT productos FROM ordenes_compra WHERE folio = $1 ORDER BY id DESC LIMIT 1`, [folio]);
    const productos: { foto?: string }[] = Array.isArray(r.rows[0]?.productos) ? r.rows[0].productos : [];
    return NextResponse.json({ ok: true, fotos: productos.map((p) => p.foto || null) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer las fotos." }, { status: 500 });
  }
}
