import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAPA_COLUMNAS: Record<string, string> = {
  descripcion: "descripcion",
  categoria: "categoria",
  referencia: "referencia",
  costoUnitario: "costo_unitario",
  cantidad: "cantidad",
  proveedor: "proveedor",
  ubicacion: "ubicacion",
  fechaIngreso: "fecha_ingreso",
  unidad: "unidad",
};
const CAMPOS_NUMERICOS = new Set(["costoUnitario", "cantidad"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...campos } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta el id del artículo." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const sets: string[] = [];
    const valores: unknown[] = [id];
    let i = 2;
    for (const [clave, columna] of Object.entries(MAPA_COLUMNAS)) {
      if (!Object.prototype.hasOwnProperty.call(campos, clave)) continue;
      let valor = campos[clave];
      if (CAMPOS_NUMERICOS.has(clave) && (valor === "" || valor === undefined)) valor = null;
      sets.push(`${columna} = $${i}`);
      valores.push(valor);
      i++;
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar." }, { status: 400 });
    }
    sets.push("updated_at = now()");
    const result = await pool.query(`UPDATE inventario_items SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, valores);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró el artículo." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el artículo." }, { status: 500 });
  }
}
