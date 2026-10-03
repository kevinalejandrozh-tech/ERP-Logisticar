import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema, siguienteFolio, sumarExistencia, ubicacionPorCodigo, usuarioDe } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";

// POST { articulo_id, origen, destino, cantidad } — cambio de ubicación.
export async function POST(req: NextRequest) {
  const usuario = await usuarioDe(req);
  const b = await req.json().catch(() => ({}));
  const cant = Number(b?.cantidad);
  if (!Number(b?.articulo_id) || !(cant > 0) || !b?.origen || !b?.destino) return NextResponse.json({ error: "Datos incompletos." }, { status: 400 });
  await ensureAlmacenSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const o = await ubicacionPorCodigo(c, String(b.origen));
    const d = await ubicacionPorCodigo(c, String(b.destino));
    if (o.id === d.id) throw new Error("El origen y el destino son la misma ubicación.");
    const a = await c.query(`SELECT nombre, costo FROM alm_articulos WHERE id = $1`, [b.articulo_id]);
    if (!a.rowCount) throw new Error("El artículo no existe.");
    await sumarExistencia(c, Number(b.articulo_id), o.id, -cant);
    await sumarExistencia(c, Number(b.articulo_id), d.id, cant);
    const folio = await siguienteFolio(c, "TRS");
    await c.query(
      `INSERT INTO alm_movimientos (tipo, folio, articulo_id, articulo, ubicacion_id, ubicacion, ubicacion_destino, cantidad, costo_unitario, referencia, usuario)
       VALUES ('Cambio de ubicación', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [folio, b.articulo_id, a.rows[0].nombre, o.id, o.codigo, d.codigo, cant, a.rows[0].costo, `${o.codigo} → ${d.codigo}`, usuario]
    );
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, folio });
  } catch (e) {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error en el cambio de ubicación." }, { status: 400 });
  } finally {
    c.release();
  }
}
