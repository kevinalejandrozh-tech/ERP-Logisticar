import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { ensureAlmacenSchema } from "@/lib/almacenDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET: lista de ubicaciones con totales. GET ?codigo=X: detalle con existencias y trazabilidad.
export async function GET(req: NextRequest) {
  try {
    await ensureAlmacenSchema();
    const p = getPool();
    const codigo = req.nextUrl.searchParams.get("codigo");
    if (codigo) {
      const u = await p.query(`SELECT * FROM alm_ubicaciones WHERE lower(codigo) = lower($1)`, [codigo]);
      if (!u.rowCount) return NextResponse.json({ error: "La ubicación no existe." }, { status: 404 });
      const id = u.rows[0].id;
      const existencias = await p.query(
        `SELECT a.id, a.nombre, a.tipo, a.categoria, a.costo, (a.imagen IS NOT NULL) AS tiene_imagen, e.cantidad,
                (SELECT string_agg(DISTINCT m.proveedor, ', ') FROM alm_movimientos m WHERE m.articulo_id = a.id AND m.ubicacion_id = e.ubicacion_id AND m.proveedor IS NOT NULL) AS proveedores
         FROM alm_existencias e JOIN alm_articulos a ON a.id = e.articulo_id WHERE e.ubicacion_id = $1 AND e.cantidad > 0 ORDER BY a.nombre`,
        [id]
      );
      const movimientos = await p.query(
        `SELECT tipo, folio, articulo, cantidad, proveedor, referencia, oc_folio, usuario, ubicacion, ubicacion_destino, created_at
         FROM alm_movimientos WHERE ubicacion_id = $1 OR lower(ubicacion_destino) = lower($2) ORDER BY created_at DESC LIMIT 50`,
        [id, u.rows[0].codigo]
      );
      return NextResponse.json({ ok: true, ubicacion: u.rows[0], existencias: existencias.rows, movimientos: movimientos.rows });
    }
    const r = await p.query(
      `SELECT u.*, COALESCE(SUM(e.cantidad), 0)::float AS total_piezas, COUNT(e.articulo_id) FILTER (WHERE e.cantidad > 0)::int AS articulos,
              (SELECT max(created_at) FROM alm_movimientos m WHERE m.ubicacion_id = u.id) AS ultimo_movimiento
       FROM alm_ubicaciones u LEFT JOIN alm_existencias e ON e.ubicacion_id = u.id GROUP BY u.id ORDER BY u.codigo`
    );
    return NextResponse.json({ ok: true, ubicaciones: r.rows });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al leer ubicaciones." }, { status: 500 });
  }
}

// POST { codigo, nombre, tipo, descripcion }
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const codigo = String(b?.codigo || "").trim();
    if (!codigo) return NextResponse.json({ error: "El código de la ubicación es obligatorio." }, { status: 400 });
    await ensureAlmacenSchema();
    const p = getPool();
    const ex = await p.query(`SELECT 1 FROM alm_ubicaciones WHERE lower(codigo) = lower($1)`, [codigo]);
    if (ex.rowCount) return NextResponse.json({ error: "Ya existe una ubicación con ese código." }, { status: 409 });
    await p.query(`INSERT INTO alm_ubicaciones (codigo, nombre, tipo, descripcion) VALUES ($1, $2, $3, $4)`, [
      codigo,
      String(b?.nombre || "").trim() || null,
      String(b?.tipo || "").trim() || null,
      String(b?.descripcion || "").trim() || null,
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error al crear la ubicación." }, { status: 500 });
  }
}
