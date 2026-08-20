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
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS ancho TEXT NOT NULL DEFAULT 'full';`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS archivada BOOLEAN NOT NULL DEFAULT false;`);

await p.query(`
CREATE TABLE IF NOT EXISTS gantt_actividades (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
fecha_inicio TEXT,
fecha_fin TEXT,
responsable TEXT,
color TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE gantt_actividades ADD COLUMN IF NOT EXISTS avance NUMERIC NOT NULL DEFAULT 0;`);

await p.query(`
CREATE TABLE IF NOT EXISTS gantt_costos (
id SERIAL PRIMARY KEY,
actividad_id INTEGER NOT NULL REFERENCES gantt_actividades(id) ON DELETE CASCADE,
cantidad NUMERIC,
unidad TEXT,
descripcion TEXT,
sub_total NUMERIC,
proveedor TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS etiquetas_contador (
id SERIAL PRIMARY KEY,
siguiente INTEGER NOT NULL DEFAULT 1
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS empleados_datos_generales (
id SERIAL PRIMARY KEY,
no_empleado TEXT,
nombre_empleado TEXT,
rfc TEXT,
curp TEXT,
nss TEXT,
puesto TEXT,
departamento TEXT,
salario_diario NUMERIC,
fecha_ingreso TEXT,
estatus TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS empleados_pagos (
id SERIAL PRIMARY KEY,
dias_pagados NUMERIC,
total_percepciones NUMERIC,
total_deducciones NUMERIC,
total_entregado NUMERIC,
metodo_pago TEXT,
banco TEXT,
ultimos_4_cuenta TEXT,
observaciones TEXT,
estatus TEXT,
fecha_elaboracion TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS empleados_previsualizacion_pago (
id SERIAL PRIMARY KEY,
folio TEXT,
no_empleado TEXT,
tipo TEXT,
concepto TEXT,
importe NUMERIC,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

// ---- Plan de trabajo: fotos, documentos, sublista, gastos ----
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS fotos JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE tareas_kanban ADD COLUMN IF NOT EXISTS documentos JSONB NOT NULL DEFAULT '[]'::jsonb;`);

await p.query(`
CREATE TABLE IF NOT EXISTS tareas_sublista (
id SERIAL PRIMARY KEY,
tarea_id INTEGER NOT NULL REFERENCES tareas_kanban(id) ON DELETE CASCADE,
texto TEXT NOT NULL,
marcado BOOLEAN NOT NULL DEFAULT false,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS tareas_gastos (
id SERIAL PRIMARY KEY,
tarea_id INTEGER REFERENCES tareas_kanban(id) ON DELETE CASCADE,
tarea_nombre TEXT,
cantidad NUMERIC,
descripcion TEXT,
monto NUMERIC,
tipo_transaccion TEXT,
referencia TEXT,
fondo TEXT,
fecha TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE tareas_gastos ALTER COLUMN tarea_id DROP NOT NULL;`);

// ---- Historial de mantenimientos: columnas nuevas ----
await p.query(`ALTER TABLE historial_mantenimientos ADD COLUMN IF NOT EXISTS detalle_servicio TEXT;`);
await p.query(`ALTER TABLE historial_mantenimientos ADD COLUMN IF NOT EXISTS evidencia_reparacion JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE historial_mantenimientos ADD COLUMN IF NOT EXISTS termino_servicio TEXT;`);
await p.query(`ALTER TABLE historial_mantenimientos ADD COLUMN IF NOT EXISTS factura_url TEXT;`);

// ---- Solicitudes de material (Historial de mantenimientos -> Inventario) ----
await p.query(`
CREATE TABLE IF NOT EXISTS solicitudes_material (
id SERIAL PRIMARY KEY,
historial_id INTEGER REFERENCES historial_mantenimientos(id) ON DELETE CASCADE,
folio_servicio TEXT,
eco_unidad TEXT,
items JSONB NOT NULL DEFAULT '[]'::jsonb,
estado TEXT NOT NULL DEFAULT 'pendiente',
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

// ---- Compras pendientes (faltantes detectados al registrar salida) ----
await p.query(`
CREATE TABLE IF NOT EXISTS compras_pendientes (
id SERIAL PRIMARY KEY,
descripcion TEXT,
cantidad NUMERIC,
origen TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

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
await p.query(`ALTER TABLE cambios_aceite ADD COLUMN IF NOT EXISTS servicio_realizado BOOLEAN NOT NULL DEFAULT false;`);

await p.query(`
CREATE TABLE IF NOT EXISTS viajes (
id SERIAL PRIMARY KEY,
datos JSONB NOT NULL DEFAULT '{}'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS inventario_items (
id SERIAL PRIMARY KEY,
codigo TEXT UNIQUE NOT NULL,
descripcion TEXT,
categoria TEXT,
referencia TEXT,
costo_unitario NUMERIC,
cantidad NUMERIC NOT NULL DEFAULT 0,
proveedor TEXT,
ubicacion TEXT,
fecha_ingreso TEXT,
unidad TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE inventario_items ADD COLUMN IF NOT EXISTS numero_etiqueta TEXT;`);
await p.query(`ALTER TABLE inventario_items ADD COLUMN IF NOT EXISTS ref_compra TEXT;`);
await p.query(`ALTER TABLE inventario_items ADD COLUMN IF NOT EXISTS numero_recepcion TEXT;`);

await p.query(`
CREATE TABLE IF NOT EXISTS recepciones_contador (
id SERIAL PRIMARY KEY,
siguiente INTEGER NOT NULL DEFAULT 1
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS recepciones_evidencia (
id SERIAL PRIMARY KEY,
numero_recepcion TEXT UNIQUE NOT NULL,
evidencias JSONB NOT NULL DEFAULT '[]'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS comparativos (
id SERIAL PRIMARY KEY,
titulo TEXT,
descripcion TEXT,
foto_antes TEXT,
foto_despues TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE comparativos ADD COLUMN IF NOT EXISTS columnas JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE comparativos ADD COLUMN IF NOT EXISTS modo TEXT NOT NULL DEFAULT 'reporte';`);


await p.query(`
CREATE TABLE IF NOT EXISTS proveedores (
id SERIAL PRIMARY KEY,
nombre TEXT,
contacto TEXT,
telefono TEXT,
email TEXT,
notas TEXT,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS ordenes_compra (
id SERIAL PRIMARY KEY,
folio TEXT,
proveedor TEXT,
fecha TEXT,
items JSONB NOT NULL DEFAULT '[]'::jsonb,
estado TEXT NOT NULL DEFAULT 'pendiente',
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS conteos_ciclicos (
id SERIAL PRIMARY KEY,
codigo TEXT,
descripcion TEXT,
cantidad_sistema NUMERIC,
cantidad_contada NUMERIC,
diferencia NUMERIC,
contado_por TEXT,
fecha TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS inventario_movimientos (
id SERIAL PRIMARY KEY,
tipo TEXT NOT NULL,
codigo TEXT,
descripcion TEXT,
cantidad NUMERIC,
datos JSONB DEFAULT '{}'::jsonb,
fecha TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS reporte_columnas (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
orden DOUBLE PRECISION NOT NULL DEFAULT 0
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS reporte_filas (
id SERIAL PRIMARY KEY,
datos JSONB NOT NULL DEFAULT '{}'::jsonb,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS organigrama (
id SERIAL PRIMARY KEY,
datos JSONB NOT NULL DEFAULT '{}'::jsonb,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

await p.query(`
CREATE TABLE IF NOT EXISTS historial_mantenimientos (
id SERIAL PRIMARY KEY,
estado TEXT,
folio TEXT,
eco_unidad TEXT,
unidad TEXT,
tipo_mantenimiento TEXT,
reporte_falla TEXT,
fecha_ingreso_taller TEXT,
costo NUMERIC,
orden DOUBLE PRECISION NOT NULL DEFAULT 0,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE historial_mantenimientos ADD COLUMN IF NOT EXISTS evidencias JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE historial_mantenimientos ADD COLUMN IF NOT EXISTS reportado_por TEXT;`);

await p.query(`
CREATE TABLE IF NOT EXISTS revision_semanal_comentarios (
id SERIAL PRIMARY KEY,
eco TEXT UNIQUE NOT NULL,
comentario TEXT,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
}
