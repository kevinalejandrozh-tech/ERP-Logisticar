import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { operador, tallaChamarra, tallaPlayera, tallaPantalon, tallaZapatos } = await req.json();
    if (!operador || !String(operador).trim()) {
      return NextResponse.json({ error: "Falta el nombre del operador." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO uniformes (operador, talla_chamarra, talla_playera, talla_pantalon, talla_zapatos)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, fecha_entrega`,
      [operador.trim(), tallaChamarra || "", tallaPlayera || "", tallaPantalon || "", tallaZapatos || ""]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id, fechaEntrega: result.rows[0].fecha_entrega });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el registro." }, { status: 500 });
  }
}
