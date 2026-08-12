import { Pool } from "pg";
let pool: Pool | null = null;
export function getPool() {
if (!process.env.DATABASE_URL) {
throw new Error("DATABASE_URL no está configurada todavía.");
}
if (!pool) {
pool = new Pool({
connectionString: process.env.DATABASE_URL,
ssl: { rejectUnauthorized: false },
});
}
return pool;
}
export async function ensureSchema() {
const p = getPool();
await p.query(`
CREATE TABLE IF NOT EXISTS checklist_unidades (
id SERIAL PRIMARY KEY,
folio TEXT UNIQUE NOT NULL,
eco_unidad TEXT NOT NULL,
descripcion_unidad TEXT,
placas TEXT,
fecha_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
kilometraje_actual NUMERIC,
fotos_evidencia JSONB,
estado_llantas JSONB,
niveles JSONB,
checklist JSONB,
porcentaje_llenado NUMERIC,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE checklist_unidades ADD COLUMN IF NOT EXISTS descripcion_unidad TEXT;`);
await p.query(`ALTER TABLE checklist_unidades ADD COLUMN IF NOT EXISTS placas TEXT;`);
await p.query(`ALTER TABLE checklist_unidades ADD COLUMN IF NOT EXISTS fotos_evidencia JSONB;`);
await p.query(`ALTER TABLE checklist_unidades ADD COLUMN IF NOT EXISTS estado_llantas JSONB;`);
await p.query(`ALTER TABLE checklist_unidades ADD COLUMN IF NOT EXISTS fotos_libres JSONB;`);
await p.query(`
CREATE TABLE IF NOT EXISTS unidades (
id SERIAL PRIMARY KEY,
eco TEXT UNIQUE NOT NULL,
datos JSONB NOT NULL,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS mochilas (
id SERIAL PRIMARY KEY,
folio TEXT UNIQUE NOT NULL,
operador TEXT,
contenido JSONB,
foto TEXT,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE mochilas ADD COLUMN IF NOT EXISTS unidad TEXT;`);
await p.query(`ALTER TABLE mochilas ADD COLUMN IF NOT EXISTS responsable TEXT;`);
await p.query(`
CREATE TABLE IF NOT EXISTS ordenes_servicio (
id SERIAL PRIMARY KEY,
folio TEXT UNIQUE NOT NULL,
fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
eco_unidad TEXT NOT NULL,
falla_detectada TEXT,
estado TEXT NOT NULL,
diagnostico TEXT,
responsable TEXT,
requisicion JSONB,
fecha_diagnostico TIMESTAMPTZ,
fecha_ingreso TIMESTAMPTZ,
fecha_cierre TIMESTAMPTZ,
quedo_bien TEXT,
foto_reparacion TEXT,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS operadores (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
fecha_ingreso TEXT,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS scanner_pdfs (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
contenido TEXT NOT NULL,
creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS tareas_kanban (
id SERIAL PRIMARY KEY,
tarea TEXT NOT NULL,
responsable TEXT,
fecha_entrega TEXT,
estado TEXT NOT NULL DEFAULT 'lista',
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS avances JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS color TEXT;`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS categoria TEXT;`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS urgente BOOLEAN NOT NULL DEFAULT false;`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS orden DOUBLE PRECISION NOT NULL DEFAULT 0;`);

await p.query(`
CREATE TABLE IF NOT EXISTS cambios_aceite (
id SERIAL PRIMARY KEY,
eco TEXT,
unidad TEXT,
fecha_ultimo_cambio TEXT,
km_ultimo_cambio NUMERIC,
km_actual NUMERIC,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS viajes (
id SERIAL PRIMARY KEY,
datos JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
}
