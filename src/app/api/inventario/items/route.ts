import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descripcion, categoria, referencia, costoUnitario, cantidad, proveedor, ubicacion, fechaIngreso, unidad } = body;
    if (!descripcion || !String(descripcion).trim()) {
      return NextResponse.json({ error: "Falta la descripción del artículo." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    let codigo = body.codigo && String(body.codigo).trim();
    if (!codigo) {
      const maxRes = await pool.query(`SELECT COALESCE(MAX(NULLIF(regexp_replace(codigo, '\\D', '', 'g'), '')::int), 0) AS maximo FROM inventario_items`);
      const siguiente = (maxRes.rows[0]?.maximo || 0) + 1;
      codigo = String(siguiente).padStart(4, "0");
    }

    const result = await pool.query(
      `INSERT INTO inventario_items (codigo, descripcion, categoria, referencia, costo_unitario, cantidad, proveedor, ubicacion, fecha_ingreso, unidad)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (codigo) DO UPDATE SET
         descripcion = EXCLUDED.descripcion,
         categoria = EXCLUDED.categoria,
         referencia = EXCLUDED.referencia,
         costo_unitario = EXCLUDED.costo_unitario,
         cantidad = inventario_items.cantidad + EXCLUDED.cantidad,
         proveedor = EXCLUDED.proveedor,
         ubicacion = EXCLUDED.ubicacion,
         fecha_ingreso = EXCLUDED.fecha_ingreso,
         unidad = EXCLUDED.unidad,
         updated_at = now()
       RETURNING id, codigo`,
      [
        codigo,
        descripcion.trim(),
        categoria || null,
        referencia || null,
        costoUnitario || null,
        cantidad || 0,
        proveedor || null,
        ubicacion || null,
        fechaIngreso || null,
        unidad || null,
      ]
    );

    await pool.query(
      `INSERT INTO inventario_movimientos (tipo, codigo, descripcion, cantidad, datos) VALUES ('entrada', $1, $2, $3, $4::jsonb)`,
      [result.rows[0].codigo, descripcion.trim(), cantidad || 0, JSON.stringify({ referencia, costoUnitario, proveedor, ubicacion, unidad })]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id, codigo: result.rows[0].codigo });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al registrar la entrada." }, { status: 500 });
  }
}
