import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 60;

// Endpoint de un solo uso: recibe { columnas: string[], filas: string[][] } y:
// 1) Resuelve cada columna (reutiliza la existente por nombre, o la crea; caso especial:
//    si llega "No  EMBARQUE" y existe la columna previamente fusionada "No. EMBARQUE CARTA PORTE",
//    la renombra y reutiliza su id en vez de crear una nueva).
// 2) Reordena TODAS las columnas para que su "orden" coincida exactamente con el orden recibido.
// 3) Inserta cada fila como un nuevo registro, mapeando los valores a cada columnaId.
export async function POST(req: NextRequest) {
  try {
    const { columnas, filas } = await req.json();
    if (!Array.isArray(columnas) || !Array.isArray(filas)) {
      return NextResponse.json({ error: "Formato inválido." }, { status: 400 });
    }
    await ensureSchema();
    const pool = getPool();

    const existentes = await pool.query(`SELECT id, nombre FROM planeacion_cargas_columnas`);
    const porNombre = new Map<string, number>();
    for (const row of existentes.rows) porNombre.set(String(row.nombre).trim().toLowerCase(), row.id);

    const idsPorIndice: number[] = [];
    for (let i = 0; i < columnas.length; i++) {
      const nombre = String(columnas[i]).trim();
      const clave = nombre.toLowerCase();
      let id = porNombre.get(clave);

      // Caso especial: columna fusionada previamente "No. EMBARQUE CARTA PORTE"
      if (!id && clave.startsWith("no") && clave.includes("embarque")) {
        const fusionada = existentes.rows.find((r: any) => String(r.nombre).toLowerCase().includes("embarque") && String(r.nombre).toLowerCase().includes("carta porte"));
        if (fusionada) {
          await pool.query(`UPDATE planeacion_cargas_columnas SET nombre = $2 WHERE id = $1`, [fusionada.id, nombre]);
          id = fusionada.id;
        }
      }

      if (!id) {
        const result = await pool.query(`INSERT INTO planeacion_cargas_columnas (nombre, orden) VALUES ($1,$2) RETURNING id`, [nombre, i]);
        id = result.rows[0].id;
      } else {
        await pool.query(`UPDATE planeacion_cargas_columnas SET nombre = $2, orden = $3 WHERE id = $1`, [id, nombre, i]);
      }
      idsPorIndice.push(id as number);
    }

    let filasInsertadas = 0;
    const maxOrdenActual = await pool.query(`SELECT COALESCE(MAX(orden), -1) AS m FROM planeacion_cargas_filas`);
    let siguienteOrden = maxOrdenActual.rows[0].m + 1;
    for (const fila of filas) {
      const datos: Record<string, string> = {};
      for (let i = 0; i < idsPorIndice.length; i++) {
        const valor = fila[i];
        if (valor) datos[String(idsPorIndice[i])] = String(valor);
      }
      await pool.query(`INSERT INTO planeacion_cargas_filas (datos, orden) VALUES ($1::jsonb, $2)`, [JSON.stringify(datos), siguienteOrden]);
      siguienteOrden++;
      filasInsertadas++;
    }

    return NextResponse.json({ ok: true, columnas: idsPorIndice.length, filas: filasInsertadas });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al importar." }, { status: 500 });
  }
}
