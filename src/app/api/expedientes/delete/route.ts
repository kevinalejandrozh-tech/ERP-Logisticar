import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";
import { ensureNominaSchema } from "@/lib/nominaDB";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
    await ensureSchema();
    await ensureNominaSchema();
    const pool = getPool();
    // Eliminar un expediente borra en cascada sus capturas de nómina, créditos y caja de ahorro.
    // Si la persona ya tiene historial de nómina, solo se permite darla de baja para conservarlo.
    const h = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM nomina_registros WHERE expediente_id = $1) AS registros,
              (SELECT COUNT(*)::int FROM nomina_prestamos WHERE expediente_id = $1) AS creditos`,
      [id]
    );
    if (h.rows[0].registros > 0 || h.rows[0].creditos > 0) {
      return NextResponse.json(
        { error: "Esta persona tiene historial de nómina (semanas capturadas o créditos). Para conservarlo, dala de baja en lugar de eliminarla." },
        { status: 409 }
      );
    }
    await pool.query(`DELETE FROM expedientes WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al eliminar el expediente." }, { status: 500 });
  }
}