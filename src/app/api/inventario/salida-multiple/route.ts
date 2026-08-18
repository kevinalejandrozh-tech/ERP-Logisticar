import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ItemSalida = {
  numeroEtiqueta: string;
  descripcion: string;
  cantidad: number;
  folioServicio: string;
  paraUnidad: string;
  entregadoA: string;
};

export async function POST(req: NextRequest) {
  try {
    const { items } = (await req.json()) as { items: ItemSalida[] };
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "No hay artículos para procesar." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const resultados: Array<{ numeroEtiqueta: string; ok: boolean; motivo?: string }> = [];

    for (const item of items) {
      const cantidadSolicitada = Number(item.cantidad) || 0;
      const encontrado = item.numeroEtiqueta
        ? (await pool.query(`SELECT codigo, descripcion, cantidad FROM inventario_items WHERE numero_etiqueta = $1`, [item.numeroEtiqueta])).rows[0]
        : null;

      if (!encontrado) {
        resultados.push({ numeroEtiqueta: item.numeroEtiqueta, ok: false, motivo: "no_encontrado" });
        continue;
      }
      if (Number(encontrado.cantidad) < cantidadSolicitada) {
        resultados.push({ numeroEtiqueta: item.numeroEtiqueta, ok: false, motivo: "insuficiente" });
        continue;
      }

      await pool.query(`UPDATE inventario_items SET cantidad = cantidad - $2, updated_at = now() WHERE codigo = $1`, [encontrado.codigo, cantidadSolicitada]);
      await pool.query(
        `INSERT INTO inventario_movimientos (tipo, codigo, descripcion, cantidad, datos) VALUES ('salida', $1, $2, $3, $4::jsonb)`,
        [
          encontrado.codigo,
          encontrado.descripcion,
          cantidadSolicitada,
          JSON.stringify({ folioServicio: item.folioServicio, paraUnidad: item.paraUnidad, entregadoA: item.entregadoA }),
        ]
      );
      resultados.push({ numeroEtiqueta: item.numeroEtiqueta, ok: true });
    }

    return NextResponse.json({ ok: true, resultados });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al procesar la salida." }, { status: 500 });
  }
}
