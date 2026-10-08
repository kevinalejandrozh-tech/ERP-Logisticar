import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema, procesarRequisicion, siguienteFolio, usuarioDe, type ItemSolicitado } from "@/lib/almacenDB";
import { puedeAutorizarOC, sesionCompras } from "@/lib/comprasDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: historial de requisiciones y si el usuario puede aprobarlas (mismos roles que autorizan OC).
export async function GET(req: NextRequest) {
  try {
    await ensureAlmacenSchema();
    const sesion = await sesionCompras(req).catch(() => null);
    const puedeAprobar = await puedeAutorizarOC(sesion?.rol).catch(() => false);
    const r = await getPool().query(`SELECT * FROM alm_requisiciones ORDER BY created_at DESC LIMIT 300`);
    return NextResponse.json({ ok: true, requisiciones: r.rows, puedeAprobar });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error." }, { status: 500 });
  }
}

// POST { referencia, items: [{ articulo_id, ubicacion_id, cantidad }] } — registra la requisición
// (folio REQ-…) en "Pendiente de aprobación". Las existencias se descuentan hasta que se aprueba.
export async function POST(req: NextRequest) {
  const usuario = await usuarioDe(req);
  const b = await req.json().catch(() => ({}));
  const referencia = String(b?.referencia || "").trim();
  const items: ItemSolicitado[] = Array.isArray(b?.items) ? b.items.filter((x: any) => Number(x?.cantidad) > 0) : [];
  if (!referencia) return NextResponse.json({ error: "Indica el folio de orden de trabajo, concepto o referencia del consumo." }, { status: 400 });
  if (!items.length) return NextResponse.json({ error: "El carrito está vacío." }, { status: 400 });
  await ensureAlmacenSchema();
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const { detalle, total } = await procesarRequisicion(c, items, { descontar: false });
    const folio = await siguienteFolio(c, "REQ");
    const r = await c.query(
      `INSERT INTO alm_requisiciones (folio, referencia, items, total, usuario, estado) VALUES ($1, $2, $3, $4, $5, 'Pendiente de aprobación') RETURNING *`,
      [folio, referencia, JSON.stringify(detalle), total, usuario]
    );
    await c.query("COMMIT");
    return NextResponse.json({ ok: true, requisicion: r.rows[0] });
  } catch (e) {
    await c.query("ROLLBACK");
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al registrar la requisición." }, { status: 400 });
  } finally {
    c.release();
  }
}
