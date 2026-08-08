import { NextResponse } from "next/server";
import { ensureSchema, getPool } from "@/lib/db";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NOMBRES_INICIALES = [
  "Diego Benitez Martinez",
  "Florencio Ochoa Camacho",
  "Felipe Cruz Vargas",
  "Ulises Gonzalez Chavez",
  "Francisco J. Rodriguez Torres",
  "Cuauhtemoc Perez Martinez",
  "Aurelio Martinez Ovalle",
  "Jose Giovanni Nieto Dominguez",
  "Jesus Enrique Rodriguez Caballero",
  "Juan Gabriel Cruz Ortega",
  "Hugo Cesar Gutierrez Barrera",
  "Luis Eduardo Martinez Perez",
  "Antonio Martin Garcia Gomora",
  "Hugo Enrique Vega Nieves",
  "Jesus David Martinez Palacios",
  "Arnulfo Suarez Santana",
  "Rafael Trejo Rodriguez",
  "Jose De Jesus Gutierrez Aldana",
  "Carlos Moncibais Mondragon",
  "Dario Cruz Cruz",
  "Adriel Pineda Gonzalez",
  "David Maximiliano Ferrusca Galas",
  "Brandon Antonio Alvarez Alvarado",
  "Jesus Angel Serrano Zuñiga",
];

export async function GET() {
  try {
    await ensureSchema();
    const pool = getPool();
    const conteo = await pool.query(`SELECT COUNT(*)::int AS n FROM operadores`);
    if (conteo.rows[0].n === 0) {
      for (const nombre of NOMBRES_INICIALES) {
        await pool.query(`INSERT INTO operadores (nombre, fecha_ingreso) VALUES ($1, NULL)`, [nombre]);
      }
    }
    const result = await pool.query(`SELECT id, nombre, fecha_ingreso FROM operadores ORDER BY nombre ASC`);
    const registros = result.rows.map((r) => ({ id: r.id, nombre: r.nombre, fechaIngreso: r.fecha_ingreso || "" }));
    return NextResponse.json({ ok: true, registros });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al leer operadores." }, { status: 500 });
  }
}
