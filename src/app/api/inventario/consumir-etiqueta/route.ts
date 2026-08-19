import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { numeroEtiqueta, comentario, historialId } = await req.json();
    if (!numeroEtiqueta) {
      return NextResponse.json({ error: "Falta el número de etiqueta." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const item = await pool.query(
      `SELECT id, codigo, descripcion, cantidad, costo_unitario FROM inventario_items WHERE numero_etiqueta = $1`,
      [numeroEtiqueta]
    );
    if (item.rows.length === 0) {
      return NextResponse.json({ error: `No se encontró ningún artículo con la etiqueta ${numeroEtiqueta}.` }, { status: 404 });
    }
    const fila = item.rows[0];

    let folioActualizado = "";
    if (historialId) {
      const historial = await pool.query(`SELECT folio, costo, detalle_servicio FROM historial_mantenimientos WHERE id = $1`, [historialId]);
      if (historial.rows.length === 0) {
        return NextResponse.json({ error: "No se encontró el folio de mantenimiento seleccionado." }, { status: 404 });
      }
      const h = historial.rows[0];
      const costoActual = parseFloat(h.costo) || 0;
      const costoArticulo = (parseFloat(fila.costo_unitario) || 0) * (parseFloat(fila.cantidad) || 1);
      const nuevoCosto = costoActual + costoArticulo;
      const notaDetalle = `${fila.descripcion} (etiqueta ${numeroEtiqueta})`;
      const nuevoDetalle = h.detalle_servicio ? `${h.detalle_servicio} | ${notaDetalle}` : notaDetalle;
      await pool.query(`UPDATE historial_mantenimientos SET costo = $2, detalle_servicio = $3 WHERE id = $1`, [historialId, nuevoCosto, nuevoDetalle]);
      folioActualizado = h.folio || "";
    }

    await pool.query(`DELETE FROM inventario_items WHERE id = $1`, [fila.id]);

    await pool.query(
      `INSERT INTO inventario_movimientos (tipo, codigo, descripcion, cantidad, datos) VALUES ('salida', $1, $2, $3, $4::jsonb)`,
      [
        fila.codigo,
        fila.descripcion,
        fila.cantidad,
        JSON.stringify({
          numeroEtiqueta,
          comentario: comentario || "",
          historialId: historialId || null,
          folio: folioActualizado || undefined,
        }),
      ]
    );

    return NextResponse.json({ ok: true, folio: folioActualizado });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al consumir el artículo." }, { status: 500 });
  }
}
