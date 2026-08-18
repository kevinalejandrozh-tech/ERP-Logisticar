import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { codigo, descripcion, cantidadSistema, cantidadContada, contadoPor } = await req.json();
    if (!descripcion || cantidadContada === undefined || cantidadContada === "") {
      return NextResponse.json({ error: "Falta la descripción o la cantidad contada." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const diferencia = Number(cantidadContada) - Number(cantidadSistema || 0);
    const result = await pool.query(
      `INSERT INTO conteos_ciclicos (codigo, descripcion, cantidad_sistema, cantidad_contada, diferencia, contado_por, fecha)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [codigo || "", descripcion, cantidadSistema || 0, cantidadContada, diferencia, contadoPor || "", new Date().toISOString().slice(0, 10)]
    );
    return NextResponse.json({ ok: true, id: result.rows[0].id, diferencia });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar el conteo." }, { status: 500 });
  }
}
