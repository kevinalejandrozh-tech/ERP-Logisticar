import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { actividadId, cantidad, unidad, descripcion, subTotal, proveedor } = await req.json();
    if (!actividadId) {
      return NextResponse.json({ error: "Falta la actividad." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const maxRes = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM gantt_costos WHERE actividad_id = $1`, [actividadId]);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(
      `INSERT INTO gantt_costos (actividad_id, cantidad, unidad, descripcion, sub_total, proveedor, orden) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [actividadId, cantidad || null, unidad || "", descripcion || "", subTotal || null, proveedor || "", orden]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al crear el registro de costo." }, { status: 500 });
  }
}
