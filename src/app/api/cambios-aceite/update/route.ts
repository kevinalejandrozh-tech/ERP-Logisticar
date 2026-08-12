import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAPA_COLUMNAS: Record<string, string> = {
  eco: "eco",
  unidad: "unidad",
  fechaUltimoCambio: "fecha_ultimo_cambio",
  kmUltimoCambio: "km_ultimo_cambio",
  kmActual: "km_actual",
  servicioRealizado: "servicio_realizado",
};
const CAMPOS_NUMERICOS = new Set(["kmUltimoCambio", "kmActual"]);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...campos } = body;
    if (!id) {
      return NextResponse.json({ error: "Falta el id del registro." }, { status: 400 });
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
    const result = await pool.query(`UPDATE cambios_aceite SET ${sets.join(", ")} WHERE id = $1 RETURNING id`, valores);
    if (result.rowCount === 0) {
      return NextResponse.json({ error: "No se encontró el registro." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al actualizar el registro." }, { status: 500 });
  }
}
