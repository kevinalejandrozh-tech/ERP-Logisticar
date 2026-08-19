import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const campo = req.nextUrl.searchParams.get("campo") === "reparacion" ? "evidencia_reparacion" : "evidencias";
    if (!id) {
      return NextResponse.json({ error: "Falta el id del registro." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT ${campo} AS datos FROM historial_mantenimientos WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true, evidencias: result.rows[0]?.datos || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer las evidencias." }, { status: 500 });
  }
}
