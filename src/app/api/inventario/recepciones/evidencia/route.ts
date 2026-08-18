import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { numeroRecepcion, evidencias } = await req.json();
    if (!numeroRecepcion) {
      return NextResponse.json({ error: "Falta el número de recepción." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    await pool.query(
      `INSERT INTO recepciones_evidencia (numero_recepcion, evidencias) VALUES ($1, $2::jsonb)
       ON CONFLICT (numero_recepcion) DO UPDATE SET evidencias = EXCLUDED.evidencias`,
      [numeroRecepcion, JSON.stringify(evidencias || [])]
    );
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al guardar la evidencia." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const numeroRecepcion = req.nextUrl.searchParams.get("numeroRecepcion");
    if (!numeroRecepcion) {
      return NextResponse.json({ error: "Falta el número de recepción." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT evidencias FROM recepciones_evidencia WHERE numero_recepcion = $1`, [numeroRecepcion]);
    return NextResponse.json({ ok: true, evidencias: result.rows[0]?.evidencias || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer la evidencia." }, { status: 500 });
  }
}
