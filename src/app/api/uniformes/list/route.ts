import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, operador, talla_chamarra, talla_playera, talla_pantalon, talla_zapatos, fecha_entrega
       FROM uniformes ORDER BY fecha_entrega DESC`
    );
    const registros = result.rows.map((r) => ({
      id: r.id,
      operador: r.operador || "",
      tallaChamarra: r.talla_chamarra || "",
      tallaPlayera: r.talla_playera || "",
      tallaPantalon: r.talla_pantalon || "",
      tallaZapatos: r.talla_zapatos || "",
      fechaEntrega: r.fecha_entrega,
    }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer los registros." }, { status: 500 });
  }
}
