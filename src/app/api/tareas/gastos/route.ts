import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { tareaId, tareaNombre, cantidad, descripcion, monto, tipoTransaccion, referencia, fondo, fecha } = await req.json();
    if (!descripcion) {
      return NextResponse.json({ error: "Falta la descripción." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const maxRes = tareaId
      ? await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM tareas_gastos WHERE tarea_id = $1`, [tareaId])
      : await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM tareas_gastos`);
    const orden = Number(maxRes.rows[0].m) + 1;
    const result = await pool.query(
      `INSERT INTO tareas_gastos (tarea_id, tarea_nombre, cantidad, descripcion, monto, tipo_transaccion, referencia, fondo, fecha, orden)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [tareaId || null, tareaNombre || "", cantidad || null, descripcion || "", monto || null, tipoTransaccion || "", referencia || "", fondo || "", fecha || new Date().toISOString().slice(0, 10), orden]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el gasto." }, { status: 500 });
  }
}
