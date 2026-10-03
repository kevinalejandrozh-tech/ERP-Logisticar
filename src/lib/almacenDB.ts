import { NextRequest } from "next/server";
import type { PoolClient } from "pg";
import { ensureSchema, getPool } from "./db";
import { ensureInventarioSchema } from "./inventarioDB";
import { COOKIE_SESION, verificarTokenSesion } from "./sesion";

// Almacén: existencias por artículo y ubicación, entradas (directas o por OC), requisiciones (salidas),
// cambios de ubicación y la bitácora de movimientos. Tablas con prefijo alm_.
let listo: Promise<void> | null = null;

async function crear() {
  await ensureSchema();
  await ensureInventarioSchema();
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS alm_ubicaciones (
      id SERIAL PRIMARY KEY,
      codigo TEXT UNIQUE NOT NULL,
      nombre TEXT,
      tipo TEXT,
      descripcion TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS alm_articulos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      nombre_norm TEXT UNIQUE NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Inventario',
      categoria TEXT,
      imagen TEXT,
      costo NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS alm_existencias (
      articulo_id INTEGER NOT NULL REFERENCES alm_articulos(id) ON DELETE CASCADE,
      ubicacion_id INTEGER NOT NULL REFERENCES alm_ubicaciones(id) ON DELETE RESTRICT,
      cantidad NUMERIC NOT NULL DEFAULT 0,
      PRIMARY KEY (articulo_id, ubicacion_id)
    );
    CREATE TABLE IF NOT EXISTS alm_movimientos (
      id SERIAL PRIMARY KEY,
      tipo TEXT NOT NULL,
      folio TEXT,
      articulo_id INTEGER REFERENCES alm_articulos(id) ON DELETE SET NULL,
      articulo TEXT,
      ubicacion_id INTEGER REFERENCES alm_ubicaciones(id) ON DELETE SET NULL,
      ubicacion TEXT,
      ubicacion_destino TEXT,
      cantidad NUMERIC NOT NULL DEFAULT 0,
      costo_unitario NUMERIC NOT NULL DEFAULT 0,
      proveedor TEXT,
      referencia TEXT,
      oc_folio TEXT,
      fecha_compra TEXT,
      usuario TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_alm_mov_fecha ON alm_movimientos (created_at DESC);
    CREATE TABLE IF NOT EXISTS alm_recibos (
      folio TEXT PRIMARY KEY,
      origen TEXT NOT NULL,
      oc_folios JSONB NOT NULL DEFAULT '[]'::jsonb,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      total NUMERIC NOT NULL DEFAULT 0,
      usuario TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS alm_requisiciones (
      folio TEXT PRIMARY KEY,
      referencia TEXT NOT NULL,
      items JSONB NOT NULL DEFAULT '[]'::jsonb,
      total NUMERIC NOT NULL DEFAULT 0,
      usuario TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS alm_folios (tipo TEXT PRIMARY KEY, consecutivo INTEGER NOT NULL DEFAULT 0);
  `);
}

export function ensureAlmacenSchema(): Promise<void> {
  if (!listo) listo = crear().catch((e) => { listo = null; throw e; });
  return listo;
}

export async function usuarioDe(req: NextRequest): Promise<string | null> {
  const t = req.cookies.get(COOKIE_SESION)?.value;
  const s = t ? await verificarTokenSesion(t) : null;
  return s?.nombre || null;
}

export const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Folio consecutivo: REC-000001 (recibos), REQ-000001 (requisiciones), TRS-000001 (traslados).
export async function siguienteFolio(c: PoolClient, tipo: "REC" | "REQ" | "TRS"): Promise<string> {
  const r = await c.query(
    `INSERT INTO alm_folios (tipo, consecutivo) VALUES ($1, 1) ON CONFLICT (tipo) DO UPDATE SET consecutivo = alm_folios.consecutivo + 1 RETURNING consecutivo`,
    [tipo]
  );
  return `${tipo}-${String(r.rows[0].consecutivo).padStart(6, "0")}`;
}

// Busca o crea el artículo por nombre (sin distinguir mayúsculas/acentos).
export async function articuloId(c: PoolClient, nombre: string, tipo: string, categoria: string | null, costo: number): Promise<number> {
  const r = await c.query(
    `INSERT INTO alm_articulos (nombre, nombre_norm, tipo, categoria, costo) VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (nombre_norm) DO UPDATE SET tipo = EXCLUDED.tipo, categoria = COALESCE(EXCLUDED.categoria, alm_articulos.categoria),
       costo = CASE WHEN EXCLUDED.costo > 0 THEN EXCLUDED.costo ELSE alm_articulos.costo END, updated_at = now()
     RETURNING id`,
    [nombre.trim(), normalizar(nombre), tipo === "Bienes" ? "Bienes" : "Inventario", categoria, costo]
  );
  return Number(r.rows[0].id);
}

export async function ubicacionPorCodigo(c: PoolClient, codigo: string): Promise<{ id: number; codigo: string }> {
  const r = await c.query(`SELECT id, codigo FROM alm_ubicaciones WHERE lower(codigo) = lower($1)`, [codigo.trim()]);
  if (!r.rowCount) throw new Error(`La ubicación "${codigo}" no existe. Créala en Ubicaciones.`);
  return { id: Number(r.rows[0].id), codigo: r.rows[0].codigo };
}

export async function sumarExistencia(c: PoolClient, articulo: number, ubicacion: number, cantidad: number) {
  const r = await c.query(
    `INSERT INTO alm_existencias (articulo_id, ubicacion_id, cantidad) VALUES ($1, $2, $3)
     ON CONFLICT (articulo_id, ubicacion_id) DO UPDATE SET cantidad = alm_existencias.cantidad + EXCLUDED.cantidad
     RETURNING cantidad`,
    [articulo, ubicacion, cantidad]
  );
  if (Number(r.rows[0].cantidad) < 0) throw new Error("No hay existencias suficientes.");
  return Number(r.rows[0].cantidad);
}
