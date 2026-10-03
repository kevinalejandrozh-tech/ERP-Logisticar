import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { articuloId, ensureAlmacenSchema, siguienteFolio, sumarExistencia, ubicacionPorCodigo, usuarioDe } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";

type Item = { cantidad: number; articulo: string; categoria?: string; tipo?: string; precio?: number; fechaCompra?: string; proveedor?: string; ubicacion: string; ocFolio?: string; ocIndice?: number };

// POST { origen: "Directo" | "OC", items } — suma existencias, registra movimientos, genera folio de recibo
// y, si viene de OC, actualiza lo recibido y marca la OC como Recibida o Parcialmente recibida.
export async function POST(req: NextRequest) {
  const usuario = await usuarioDe(req);
  const b = await req.json().catch(() => ({}));
  const origen = b?.origen === "OC" ? "OC" : "Directo";
  const items: Item[] = Array.isArray(b?.items) ? b.items : [];
  const validos = items.filter((x) => Number(x.cantidad) > 0);
  if (!validos.length) return NextResponse.json({ error: "Captura al menos un artículo con cantidad." }, { status: 400 });
  for (const [i, x] of validos.entries()) {
    if (!String(x.articulo || "").trim()) return NextResponse.json({ error: `Fila ${i + 1}: falta el artículo.` }, { status: 400 });
    if (!String(x.ubicacion || "").trim()) return NextResponse.json({ error: `Fila ${i + 1}: falta la ubicación.` }, { status: 400 });
  }
  await ensureAlmacenSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const folio = await siguienteFolio(c, "REC");
    let total = 0;
    const ocTocadas = new Map<string, Map<number, number>>();
    for (const x of validos) {
      const cant = Number(x.cantidad);
      const precio = Number(x.precio) || 0;
      const u = await ubicacionPorCodigo(c, x.ubicacion);
      const aid = await articuloId(c, String(x.articulo), String(x.tipo || "Inventario"), x.categoria?.trim() || null, precio);
      await sumarExistencia(c, aid, u.id, cant);
      await c.query(
        `INSERT INTO alm_movimientos (tipo, folio, articulo_id, articulo, ubicacion_id, ubicacion, cantidad, costo_unitario, proveedor, referencia, oc_folio, fecha_compra, usuario)
         VALUES ('Entrada', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [folio, aid, String(x.articulo).trim(), u.id, u.codigo, cant, precio, x.proveedor?.trim() || null, origen === "OC" ? `OC ${x.ocFolio}` : "Entrada directa", x.ocFolio || null, x.fechaCompra || null, usuario]
      );
      total += cant * precio;
      if (origen === "OC" && x.ocFolio && Number.isInteger(x.ocIndice)) {
        const m = ocTocadas.get(x.ocFolio) || new Map<number, number>();
        m.set(Number(x.ocIndice), (m.get(Number(x.ocIndice)) || 0) + cant);
        ocTocadas.set(x.ocFolio, m);
      }
    }
    for (const [ocFolio, recibos] of ocTocadas) {
      const r = await c.query(`SELECT id, estado, productos FROM ordenes_compra WHERE folio = $1 ORDER BY id DESC LIMIT 1 FOR UPDATE`, [ocFolio]);
      if (!r.rowCount) throw new Error(`La OC ${ocFolio} no existe.`);
      const estado = String(r.rows[0].estado || "").toLowerCase();
      if (!["autorizada", "parcialmente recibida"].includes(estado)) throw new Error(`La OC ${ocFolio} no está autorizada.`);
      const productos: any[] = Array.isArray(r.rows[0].productos) ? r.rows[0].productos : [];
      recibos.forEach((cant, idx) => {
        if (productos[idx]) productos[idx] = { ...productos[idx], recibido: (Number(productos[idx].recibido) || 0) + cant };
      });
      const completa = productos.filter((p) => p.autorizado !== false).every((p) => (Number(p.recibido) || 0) >= (Number(p.cantidad) || 0));
      await c.query(`UPDATE ordenes_compra SET productos = $2, estado = $3 WHERE id = $1`, [r.rows[0].id, JSON.stringify(productos), completa ? "Recibida" : "Parcialmente recibida"]);
    }
    await c.query(`INSERT INTO alm_recibos (folio, origen, oc_folios, items, total, usuario) VALUES ($1, $2, $3, $4, $5, $6)`, [
      folio,
      origen,
      JSON.stringify([...ocTocadas.keys()]),
      JSON.stringify(validos),
      total,
      usuario,
    ]);
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, folio, total });
  } catch (e) {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al generar la entrada." }, { status: 400 });
  } finally {
    c.release();
  }
}
