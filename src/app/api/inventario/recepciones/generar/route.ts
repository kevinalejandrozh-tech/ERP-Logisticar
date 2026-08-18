import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  try {
    await ensureSchema();
    const pool = getPool();
    const cliente = await pool.connect();
    try {
      await cliente.query("BEGIN");
      let fila = (await cliente.query(`SELECT id, siguiente FROM recepciones_contador ORDER BY id ASC LIMIT 1 FOR UPDATE`)).rows[0];
      if (!fila) {
        fila = (await cliente.query(`INSERT INTO recepciones_contador (siguiente) VALUES (1) RETURNING id, siguiente`)).rows[0];
      }
      const numero = fila.siguiente;
      await cliente.query(`UPDATE recepciones_contador SET siguiente = $2 WHERE id = $1`, [fila.id, numero + 1]);
      await cliente.query("COMMIT");
      return NextResponse.json({ ok: true, numeroRecepcion: `REC-${String(numero).padStart(6, "0")}` });
    } catch (err) {
      await cliente.query("ROLLBACK");
      throw err;
    } finally {
      cliente.release();
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al generar el número de recepción." }, { status: 500 });
  }
}
