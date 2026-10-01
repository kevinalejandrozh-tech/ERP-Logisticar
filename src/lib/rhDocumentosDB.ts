import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, verificarTokenSesion, tienePermisosAdmin } from "./sesion";

// Recursos Humanos → Documentos: plantillas (PDF, imagen o Word) con campos editables y grupos para imprimir juntos.

let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  await ensureSchema();
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS rh_documentos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      archivo_nombre TEXT NOT NULL,
      mime TEXT NOT NULL,
      archivo TEXT NOT NULL,
      campos JSONB NOT NULL DEFAULT '[]'::jsonb,
      registrado_por TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`
    CREATE TABLE IF NOT EXISTS rh_documentos_grupos (
      id SERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      documento_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export function ensureRhDocumentosSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((err) => {
      esquemaListo = null;
      throw err;
    });
  }
  return esquemaListo;
}

export async function sesionRh(req: NextRequest): Promise<{ nombre: string } | NextResponse> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  const sesion = token ? await verificarTokenSesion(token) : null;
  if (!sesion || !tienePermisosAdmin(sesion.rol)) {
    return NextResponse.json({ error: "No tienes permisos para los documentos." }, { status: 403 });
  }
  return { nombre: sesion.nombre };
}

export type CampoDocumento = { clave: string; etiqueta: string; marcador: string; valor: string; tipo: "texto" | "fecha" | "fecha_auto" };

export function limpiarCampos(v: unknown): CampoDocumento[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 60).map((x, i) => {
    const o = (x || {}) as Record<string, unknown>;
    const tipo = o.tipo === "fecha" || o.tipo === "fecha_auto" ? o.tipo : "texto";
    return {
      clave: String(o.clave || `campo_${i + 1}`).slice(0, 80),
      etiqueta: String(o.etiqueta || "").slice(0, 120),
      marcador: String(o.marcador || "").slice(0, 200),
      valor: String(o.valor ?? "").slice(0, 2000),
      tipo,
    };
  });
}

export function errorJson(err: unknown, m: string) {
  return NextResponse.json({ error: err instanceof Error ? err.message : m }, { status: 500 });
}
