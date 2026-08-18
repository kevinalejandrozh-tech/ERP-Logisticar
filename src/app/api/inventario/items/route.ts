import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function reservarNumeroEtiqueta(pool: ReturnType<typeof getPool>): Promise<string> {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    let fila = (await cliente.query(`SELECT id, siguiente FROM etiquetas_contador ORDER BY id ASC LIMIT 1 FOR UPDATE`)).rows[0];
    if (!fila) {
      fila = (await cliente.query(`INSERT INTO etiquetas_contador (siguiente) VALUES (1) RETURNING id, siguiente`)).rows[0];
    }
    const numero = fila.siguiente;
    await cliente.query(`UPDATE etiquetas_contador SET siguiente = $2 WHERE id = $1`, [fila.id, numero + 1]);
    await cliente.query("COMMIT");
    return String(numero).padStart(6, "0");
  } catch (err) {
    await cliente.query("ROLLBACK");
    throw err;
  } finally {
    cliente.release();
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { descripcion, categoria, referencia, costoUnitario, cantidad, proveedor, ubicacion, fechaIngreso, unidad, refCompra, numeroRecepcion } = body;
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

    let numeroEtiqueta = body.numeroEtiqueta && String(body.numeroEtiqueta).trim();
    if (!numeroEtiqueta) {
      numeroEtiqueta = await reservarNumeroEtiqueta(pool);
    }

    const result = await pool.query(
      `INSERT INTO inventario_items (codigo, descripcion, categoria, referencia, costo_unitario, cantidad, proveedor, ubicacion, fecha_ingreso, unidad, numero_etiqueta, ref_compra, numero_recepcion)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
         numero_etiqueta = COALESCE(inventario_items.numero_etiqueta, EXCLUDED.numero_etiqueta),
         ref_compra = EXCLUDED.ref_compra,
         numero_recepcion = EXCLUDED.numero_recepcion,
         updated_at = now()
       RETURNING id, codigo, numero_etiqueta`,
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
        numeroEtiqueta,
        refCompra || null,
        numeroRecepcion || null,
      ]
    );

    await pool.query(
      `INSERT INTO inventario_movimientos (tipo, codigo, descripcion, cantidad, datos) VALUES ('entrada', $1, $2, $3, $4::jsonb)`,
      [result.rows[0].codigo, descripcion.trim(), cantidad || 0, JSON.stringify({ referencia, costoUnitario, proveedor, ubicacion, unidad })]
    );

    return NextResponse.json({ ok: true, id: result.rows[0].id, codigo: result.rows[0].codigo, numeroEtiqueta: result.rows[0].numero_etiqueta });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al registrar la entrada." }, { status: 500 });
  }
}

