import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema, siguienteFolio, sumarExistencia, usuarioDe } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: historial de requisiciones.
export async function GET() {
  try {
    await ensureAlmacenSchema();
    const r = await getPool().query(`SELECT * FROM alm_requisiciones ORDER BY created_at DESC LIMIT 300`);
    return NextResponse.json({ ok: true, requisiciones: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

// POST { referencia, items: [{ articulo_id, ubicacion_id, cantidad }] } — confirma el surtido:
// descuenta existencias, registra salidas y guarda la requisición (folio REQ-…).
export async function POST(req: NextRequest) {
  const usuario = await usuarioDe(req);
  const b = await req.json().catch(() => ({}));
  const referencia = String(b?.referencia || "").trim();
  const items: { articulo_id: number; ubicacion_id: number; cantidad: number }[] = Array.isArray(b?.items) ? b.items.filter((x: any) => Number(x?.cantidad) > 0) : [];
  if (!referencia) return NextResponse.json({ error: "Indica el folio de orden de trabajo, concepto o referencia del consumo." }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: "El carrito está vacío." }, { status: 400 });
  await ensureAlmacenSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const folio = await siguienteFolio(c, "REQ");
    const detalle: any[] = [];
    let total = 0;
    for (const x of items) {
      const cant = Number(x.cantidad);
      const a = await c.query(`SELECT a.id, a.nombre, a.categoria, a.tipo, a.costo::float AS costo, u.codigo FROM alm_articulos a, alm_ubicaciones u WHERE a.id = $1 AND u.id = $2`, [x.articulo_id, x.ubicacion_id]);
      if (!a.rowCount) throw new Error("Artículo o ubicación no encontrados.");
      const art = a.rows[0];
      const ex = await c.query(`SELECT cantidad::float AS cantidad FROM alm_existencias WHERE articulo_id = $1 AND ubicacion_id = $2 FOR UPDATE`, [x.articulo_id, x.ubicacion_id]);
      if ((ex.rows[0]?.cantidad || 0) < cant) throw new Error(`No hay suficiente "${art.nombre}" en ${art.codigo} (disponible: ${ex.rows[0]?.cantidad || 0}).`);
      const quedaUbic = await sumarExistencia(c, x.articulo_id, x.ubicacion_id, -cant);
      const totalArt = await c.query(`SELECT COALESCE(SUM(cantidad), 0)::float AS t FROM alm_existencias WHERE articulo_id = $1`, [x.articulo_id]);
      await c.query(
        `INSERT INTO alm_movimientos (tipo, folio, articulo_id, articulo, ubicacion_id, ubicacion, cantidad, costo_unitario, referencia, usuario)
         VALUES ('Salida', $1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [folio, art.id, art.nombre, x.ubicacion_id, art.codigo, cant, art.costo, referencia, usuario]
      );
      const importe = cant * (art.costo || 0);
      total += importe;
      detalle.push({ articulo_id: art.id, articulo: art.nombre, categoria: art.categoria, tipo: art.tipo, ubicacion: art.codigo, cantidad: cant, costo: art.costo, importe, queda_ubicacion: quedaUbic, queda_total: totalArt.rows[0].t });
    }
    const r = await c.query(`INSERT INTO alm_requisiciones (folio, referencia, items, total, usuario) VALUES ($1, $2, $3, $4, $5) RETURNING *`, [folio, referencia, JSON.stringify(detalle), total, usuario]);
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, requisicion: r.rows[0] });
  } catch (e) {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al surtir la requisición." }, { status: 400 });
  } finally {
    c.release();
  }
}
