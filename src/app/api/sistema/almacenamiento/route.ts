import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Límite aproximado del plan gratuito de Neon (0.5 GB). Ajustar si el plan cambia.
const LIMITE_BYTES = 512 * 1024 * 1024;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const result = await pool.query(`SELECT pg_database_size(current_database()) AS bytes`);
    const bytesUsados = Number(result.rows[0]?.bytes) || 0;
    const porcentaje = Math.min(100, (bytesUsados / LIMITE_BYTES) * 100);
    return NextResponse.json({
      ok: true,
      bytesUsados,
      limiteBytes: LIMITE_BYTES,
      porcentaje,
      mbUsados: bytesUsados / (1024 * 1024),
      mbLimite: LIMITE_BYTES / (1024 * 1024),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al calcular el almacenamiento." }, { status: 500 });
  }
}
