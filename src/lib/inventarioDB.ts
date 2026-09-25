import { getPool } from "./db";
import { CATEGORIAS_INVENTARIO } from "./inventarioData";

// Esquema propio del módulo "Control de inventario".
// Se mantiene separado de db.ts para no tocar las tablas de los demás módulos.

let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  const p = getPool();

  await p.query(`
    CREATE TABLE IF NOT EXISTS inventario_categorias (
      id SERIAL PRIMARY KEY,
      clave TEXT UNIQUE NOT NULL,
      nombre TEXT NOT NULL,
      prefijo TEXT UNIQUE NOT NULL,
      campos JSONB NOT NULL DEFAULT '[]'::jsonb,
      consecutivo INTEGER NOT NULL DEFAULT 0,
      activa BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await p.query(`
    CREATE TABLE IF NOT EXISTS inventario_equipos (
      id SERIAL PRIMARY KEY,
      folio TEXT UNIQUE NOT NULL,
      categoria_clave TEXT NOT NULL REFERENCES inventario_categorias(clave) ON UPDATE CASCADE,
      estado TEXT NOT NULL DEFAULT 'Activo',
      datos JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await p.query(`CREATE INDEX IF NOT EXISTS idx_inventario_equipos_categoria ON inventario_equipos (categoria_clave);`);
  await p.query(`CREATE INDEX IF NOT EXISTS idx_inventario_equipos_estado ON inventario_equipos (estado);`);

  // Carga inicial de categorías. Solo inserta las que no existen:
  // si ya se editaron desde el sistema, no se sobrescriben.
  for (const c of CATEGORIAS_INVENTARIO) {
    await p.query(
      `INSERT INTO inventario_categorias (clave, nombre, prefijo, campos)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (clave) DO NOTHING`,
      [c.clave, c.nombre, c.prefijo, JSON.stringify(c.campos)]
    );
  }
}

// Se ejecuta una sola vez por instancia del servidor.
export function ensureInventarioSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((err) => {
      esquemaListo = null; // permite reintentar en la siguiente petición
      throw err;
    });
  }
  return esquemaListo;
}