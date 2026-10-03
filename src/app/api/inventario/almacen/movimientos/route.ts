import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET ?tipo=&desde=&hasta=&q= — bitácora de movimientos de almacén.
export async function GET(req: NextRequest) {
  try {
    await ensureAlmacenSchema();
    const sp = req.nextUrl.searchParams;
    const cond: string[] = [];
    const val: unknown[] = [];
    const add = (sql: string, v: unknown) => {
      val.push(v);
      cond.push(sql.replace("?", `$${val.length}`));
    };
    if (sp.get("tipo")) add("tipo = ?", sp.get("tipo"));
    if (sp.get("desde")) add("created_at >= ?::date", sp.get("desde"));
    if (sp.get("hasta")) add("created_at < (?::date + 1)", sp.get("hasta"));
    if (sp.get("q")) add("(articulo ILIKE ? OR folio ILIKE $X OR referencia ILIKE $X OR ubicacion ILIKE $X OR COALESCE(oc_folio,'') ILIKE $X)".replace(/\$X/g, `$${val.length + 1}`), `%${sp.get("q")}%`);
    const r = await getPool().query(
      `SELECT id, tipo, folio, articulo, ubicacion, ubicacion_destino, cantidad::float AS cantidad, costo_unitario::float AS costo_unitario, proveedor, referencia, oc_folio, fecha_compra, usuario, created_at
       FROM alm_movimientos ${cond.length ? "WHERE " + cond.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 1000`,
      val
    );
    return NextResponse.json({ ok: true, movimientos: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer movimientos." }, { status: 500 });
  }
}
