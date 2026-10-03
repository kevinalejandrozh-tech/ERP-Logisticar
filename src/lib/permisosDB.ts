import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getPool } from "./db";
import { COOKIE_SESION, SesionPayload, verificarTokenSesion } from "./sesion";
import { ROLES_SISTEMA, normalizarSecciones, seccionesPorDefecto } from "./permisos";

// Esquema de permisos por rol y foto de perfil. Separado de db.ts para no tocar el esquema de otros módulos.
let esquemaListo: Promise<void> | null = null;

async function crearEsquema() {
  await ensureSchema();
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS roles_permisos (
      rol TEXT PRIMARY KEY,
      secciones JSONB,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await p.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto TEXT;`);
  // Roles creados por el sysadmin.
  await p.query(`
    CREATE TABLE IF NOT EXISTS roles_personalizados (
      rol TEXT PRIMARY KEY,
      etiqueta TEXT NOT NULL,
      descripcion TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export function ensurePermisosSchema(): Promise<void> {
  if (!esquemaListo) {
    esquemaListo = crearEsquema().catch((e) => {
      esquemaListo = null;
      throw e;
    });
  }
  return esquemaListo;
}

// Secciones configuradas del rol (null = sin restricción). Si no se ha configurado, usa el valor por defecto.
export async function seccionesDeRol(rol: string): Promise<string[] | null> {
  if (rol === "sysadmin") return null;
  await ensurePermisosSchema();
  const r = await getPool().query(`SELECT secciones FROM roles_permisos WHERE rol = $1`, [rol]);
  if (!r.rows[0]) return seccionesPorDefecto(rol);
  return normalizarSecciones(r.rows[0].secciones);
}

export async function todosLosRoles() {
  await ensurePermisosSchema();
  const p = getPool();
  const conf = await p.query(`SELECT rol, secciones FROM roles_permisos`);
  const cuentas = await p.query(`SELECT rol, COUNT(*)::int AS n FROM usuarios GROUP BY rol`);
  const propios = await p.query(`SELECT rol, etiqueta, COALESCE(descripcion, 'Rol creado por el sysadmin.') AS descripcion FROM roles_personalizados ORDER BY created_at`);
  return [...ROLES_SISTEMA, ...propios.rows].map((r) => {
    const fila = conf.rows.find((c) => c.rol === r.rol);
    return {
      ...r,
      usuarios: cuentas.rows.find((c) => c.rol === r.rol)?.n || 0,
      secciones: r.rol === "sysadmin" ? null : fila ? normalizarSecciones(fila.secciones) : seccionesPorDefecto(r.rol),
      editable: r.rol !== "sysadmin",
    };
  });
}

export async function guardarSeccionesRol(rol: string, secciones: string[] | null) {
  await ensurePermisosSchema();
  await getPool().query(
    `INSERT INTO roles_permisos (rol, secciones) VALUES ($1, $2::jsonb)
     ON CONFLICT (rol) DO UPDATE SET secciones = $2::jsonb, updated_at = now()`,
    [rol, secciones === null ? null : JSON.stringify(secciones)]
  );
}

export async function sesionDe(req: NextRequest): Promise<SesionPayload | null> {
  const token = req.cookies.get(COOKIE_SESION)?.value;
  return token ? await verificarTokenSesion(token) : null;
}

// Gestión de usuarios: exclusivo del sysadmin (también lo bloquea el middleware).
export async function sesionSoloSysadmin(req: NextRequest): Promise<SesionPayload | NextResponse> {
  const s = await sesionDe(req);
  if (!s || s.rol !== "sysadmin") return NextResponse.json({ error: "Solo el administrador puede gestionar usuarios." }, { status: 403 });
  return s;
}

// ¿Existe el rol? (base o creado por el sysadmin)
export async function rolExiste(rol: string): Promise<boolean> {
  if (ROLES_SISTEMA.some((r) => r.rol === rol)) return true;
  await ensurePermisosSchema();
  const r = await getPool().query(`SELECT 1 FROM roles_personalizados WHERE rol = $1`, [rol]);
  return (r.rowCount || 0) > 0;
}

export async function crearRol(etiqueta: string, descripcion: string | null, secciones: string[]): Promise<string> {
  await ensurePermisosSchema();
  const base = etiqueta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "rol";
  let rol = `r_${base}`;
  for (let i = 2; await rolExiste(rol); i++) rol = `r_${base}_${i}`;
  await getPool().query(`INSERT INTO roles_personalizados (rol, etiqueta, descripcion) VALUES ($1, $2, $3)`, [rol, etiqueta, descripcion]);
  await guardarSeccionesRol(rol, secciones);
  return rol;
}
