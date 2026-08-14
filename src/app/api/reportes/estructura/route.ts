import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();

    let columnas = (await pool.query(`SELECT id, nombre, orden FROM reporte_columnas ORDER BY orden ASC`)).rows;
    if (columnas.length === 0) {
      const defecto = ["ECO", "Unidad", "Estado"];
      for (let i = 0; i < defecto.length; i++) {
        await pool.query(`INSERT INTO reporte_columnas (nombre, orden) VALUES ($1, $2)`, [defecto[i], i]);
      }
      columnas = (await pool.query(`SELECT id, nombre, orden FROM reporte_columnas ORDER BY orden ASC`)).rows;
    }

    let filas = (await pool.query(`SELECT id, datos, orden FROM reporte_filas ORDER BY orden ASC`)).rows;
    if (filas.length === 0) {
      const unidades = (await pool.query(`SELECT eco, datos FROM unidades ORDER BY eco ASC`)).rows;
      const revisadas = new Set(
        (await pool.query(`SELECT DISTINCT eco_unidad FROM checklist_unidades`)).rows.map((r) => r.eco_unidad)
      );
      for (let i = 0; i < unidades.length; i++) {
        const eco = unidades[i].eco;
        const unidadTxt = unidades[i].datos?.["Unidad"] || "";
        const datosFila = { ECO: eco, Unidad: unidadTxt, Estado: revisadas.has(eco) ? "Revisada" : "No revisada" };
        await pool.query(`INSERT INTO reporte_filas (datos, orden) VALUES ($1::jsonb, $2)`, [JSON.stringify(datosFila), i]);
      }
      filas = (await pool.query(`SELECT id, datos, orden FROM reporte_filas ORDER BY orden ASC`)).rows;
    }

    return NextResponse.json({ ok: true, columnas, filas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer el reporte." }, { status: 500 });
  }
}
