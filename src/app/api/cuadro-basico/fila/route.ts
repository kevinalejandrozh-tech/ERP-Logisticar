import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const CAMPOS = ["categoria", "puesto", "area", "jefe_directo", "subordinacion", "descripcion_puesto", "actividades_diarias"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await ensureSchema();
    const pool = getPool();
    const valores = CAMPOS.map((c) => body[c] ?? "");

    if (body.id) {
      await pool.query(
        `UPDATE cuadro_basico SET categoria=$2, puesto=$3, area=$4, jefe_directo=$5, subordinacion=$6, descripcion_puesto=$7, actividades_diarias=$8 WHERE id=$1`,
        [body.id, ...valores]
      );
      return NextResponse.json({ ok: true, id: body.id });
    }

    const maxOrden = await pool.query(`SELECT COALESCE(MAX(orden), -1)::int AS m FROM cuadro_basico`);
    const result = await pool.query(
      `INSERT INTO cuadro_basico (categoria, puesto, area, jefe_directo, subordinacion, descripcion_puesto, actividades_diarias, orden) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [...valores, maxOrden.rows[0].m + 1]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la fila." }, { status: 500 });
  }
}
