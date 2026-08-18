import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: NextRequest) {
  try {
    const { cantidad } = await req.json();
    const n = Math.max(1, Math.min(500, Number(cantidad) || 0));
    await ensureSchema();
    const pool = getPool();

    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      let fila = (await cliente.query(`SELECT id, siguiente FROM etiquetas_contador ORDER BY id ASC LIMIT 1 FOR UPDATE`)).rows[0];
      if (!fila) {
        fila = (await cliente.query(`INSERT INTO etiquetas_contador (siguiente) VALUES (1) RETURNING id, siguiente`)).rows[0];
      }
      const inicio = fila.siguiente;
      const nuevoSiguiente = inicio + n;
      await cliente.query(`UPDATE etiquetas_contador SET siguiente = $2 WHERE id = $1`, [fila.id, nuevoSiguiente]);
      await cliente.query("COMMIT");

      const numeros: string[] = [];
      for (let i = 0; i < n; i++) {
        numeros.push(String(inicio + i).padStart(6, "0"));
      }
      return NextResponse.json({ ok: true, numeros });
    } catch (err) {
      await cliente.query("ROLLBACK");
      throw err;
    } finally {
      cliente.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al generar etiquetas." }, { status: 500 });
  }
}
