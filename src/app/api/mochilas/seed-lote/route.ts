import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const existentes = await pool.query(`SELECT folio, contenido FROM mochilas`);
    const origen = existentes.rows.find((r) => /^mch-0*1$/i.test(String(r.folio).trim()));
    if (!origen) {
      return NextResponse.json(
        { error: "No se encontró la mochila origen (MCH-01).", folios: existentes.rows.map((r) => r.folio) },
        { status: 404 }
      );
    }
    const creadas: string[] = [];
    for (let n = 2; n <= 24; n++) {
      const folio = `MCH-${String(n).padStart(2, "0")}`;
      await pool.query(
        `INSERT INTO mochilas (folio, operador, contenido, foto, updated_at)
         VALUES ($1, '', $2, NULL, now())
         ON CONFLICT (folio) DO NOTHING`,
        [folio, JSON.stringify(origen.contenido || [])]
      );
      creadas.push(folio);
    }
    return NextResponse.json({ ok: true, origen: origen.folio, creadas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al duplicar mochilas." }, { status: 500 });
  }
}
