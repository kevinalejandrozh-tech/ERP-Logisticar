import { Pool } from "pg";
import { PREGUNTAS_MANEJO_DEFENSIVO } from "./manejoDefensivoData";
import { PREGUNTAS_PROCEDIMIENTOS_ATC } from "./procedimientosAtcData";
import { PLANEACION_CARGAS_COLUMNAS_SEED, PLANEACION_CARGAS_FILAS_SEED } from "./planeacionCargasSeed";
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
CREATE TABLE IF NOT EXISTS uniformes (
id SERIAL PRIMARY KEY,
operador TEXT NOT NULL,
talla_chamarra TEXT,
talla_playera TEXT,
talla_pantalon TEXT,
talla_zapatos TEXT,
fecha_entrega TIMESTAMPTZ NOT NULL DEFAULT now(),
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS menu_dia_opciones (
id SERIAL PRIMARY KEY,
opciones JSONB NOT NULL DEFAULT '[]'::jsonb,
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS menu_dia_pedidos (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
pedido TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS buzon_sugerencias (
id SERIAL PRIMARY KEY,
nombre TEXT,
comentario TEXT NOT NULL,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS expedientes (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
rfc TEXT,
rfc_pdf TEXT,
curp TEXT,
curp_pdf TEXT,
nss TEXT,
nss_pdf TEXT,
categoria TEXT,
puesto TEXT,
unidad_maneja TEXT,
tipo_viajes TEXT,
tipo_licencia TEXT,
tipo_licencia_pdf TEXT,
fecha_ingreso DATE,
cuenta TEXT,
sueldo_ofertado TEXT,
radio_asignado TEXT,
resultados_evaluacion TEXT,
fotografia TEXT,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS documentos JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS notas JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS cursos JSONB NOT NULL DEFAULT '[]'::jsonb;`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS indicador_asistencia TEXT;`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS indicador_puntualidad TEXT;`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS indicador_combustible TEXT;`);
await p.query(`ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS indicador_incidencias TEXT;`);
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

// ---- Capacitaciones: evaluaciones (Manejo defensivo y futuras capacitaciones) ----
await p.query(`
CREATE TABLE IF NOT EXISTS capacitaciones_evaluaciones (
id SERIAL PRIMARY KEY,
capacitacion TEXT NOT NULL,
nombre TEXT NOT NULL,
total_preguntas INTEGER NOT NULL DEFAULT 0,
correctas INTEGER NOT NULL DEFAULT 0,
aciertos NUMERIC NOT NULL DEFAULT 0,
tiempo_evaluacion INTEGER,
respuestas JSONB NOT NULL DEFAULT '[]'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);

// ---- Capacitaciones: catalogo dinamico (titulo, descripcion y preguntas editables) ----
await p.query(`
CREATE TABLE IF NOT EXISTS capacitaciones_catalogo (
id SERIAL PRIMARY KEY,
titulo TEXT NOT NULL,
descripcion TEXT,
preguntas JSONB NOT NULL DEFAULT '[]'::jsonb,
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`);
const catalogoExistente = await p.query(`SELECT COUNT(*)::int AS n FROM capacitaciones_catalogo`);
if (catalogoExistente.rows[0].n === 0) {
const simplificar = (preguntas: { pregunta: string; opciones: Record<string, string>; correcta: string }[]) =>
JSON.stringify(preguntas.map((q) => ({ pregunta: q.pregunta, opciones: q.opciones, correcta: q.correcta })));
await p.query(
`INSERT INTO capacitaciones_catalogo (titulo, descripcion, preguntas) VALUES
($1,$2,$3::jsonb), ($4,$5,$6::jsonb)`,
[
"Manejo defensivo",
"Evaluación sobre conductor profesional, señalización y manejo defensivo.",
simplificar(PREGUNTAS_MANEJO_DEFENSIVO),
"Procedimientos ATC",
"Evaluación sobre el procedimiento de Atención a Clientes: clientes, evidencias y empates.",
simplificar(PREGUNTAS_PROCEDIMIENTOS_ATC),
]
);
}

// ---- Control de Viajes: tabla libre editable (columnas y filas) ----
await p.query(`
CREATE TABLE IF NOT EXISTS control_viajes_columnas (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
orden INTEGER NOT NULL DEFAULT 0
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS control_viajes_filas (
id SERIAL PRIMARY KEY,
datos JSONB NOT NULL DEFAULT '{}'::jsonb,
orden INTEGER NOT NULL DEFAULT 0
);
`);

// ---- Planeacion y Programa de Cargas: tablero principal con columnas predefinidas ----
await p.query(`
CREATE TABLE IF NOT EXISTS planeacion_cargas_columnas (
id SERIAL PRIMARY KEY,
nombre TEXT NOT NULL,
orden INTEGER NOT NULL DEFAULT 0
);
`);
await p.query(`
CREATE TABLE IF NOT EXISTS planeacion_cargas_filas (
id SERIAL PRIMARY KEY,
datos JSONB NOT NULL DEFAULT '{}'::jsonb,
orden INTEGER NOT NULL DEFAULT 0
);
`);
const planeacionFilasExistente = await p.query(`SELECT COUNT(*)::int AS n FROM planeacion_cargas_filas`);
const totalEsperado = PLANEACION_CARGAS_FILAS_SEED.length;
console.log("[planeacion-cargas] filas existentes:", planeacionFilasExistente.rows[0].n, "esperadas:", totalEsperado);
// Si hay algo pero menos de lo esperado, es un intento anterior que se interrumpio a medias: se limpia y se vuelve a cargar.
const estaIncompleto = planeacionFilasExistente.rows[0].n > 0 && planeacionFilasExistente.rows[0].n < totalEsperado;
if (planeacionFilasExistente.rows[0].n === 0 || estaIncompleto) {
try {
if (estaIncompleto) {
console.log("[planeacion-cargas] estado incompleto detectado, limpiando antes de recargar");
await p.query(`DELETE FROM planeacion_cargas_filas`);
await p.query(`DELETE FROM planeacion_cargas_columnas`);
}
const existentesCols = await p.query(`SELECT id, nombre FROM planeacion_cargas_columnas`);
const porNombre = new Map<string, number>();
for (const row of existentesCols.rows) porNombre.set(String(row.nombre).trim().toLowerCase(), row.id);
const idsPorIndice: number[] = [];

// Resolver/crear todas las columnas primero, reutilizando o creando segun corresponda.
const porCrear: { nombre: string; indice: number }[] = [];
for (let i = 0; i < PLANEACION_CARGAS_COLUMNAS_SEED.length; i++) {
const nombre = PLANEACION_CARGAS_COLUMNAS_SEED[i];
const clave = nombre.trim().toLowerCase();
let id = porNombre.get(clave);
if (!id && clave.startsWith("no") && clave.includes("embarque")) {
const fusionada = existentesCols.rows.find(
(r: any) => String(r.nombre).toLowerCase().includes("embarque") && String(r.nombre).toLowerCase().includes("carta porte")
);
if (fusionada) {
await p.query(`UPDATE planeacion_cargas_columnas SET nombre = $2 WHERE id = $1`, [fusionada.id, nombre]);
id = fusionada.id;
}
}
if (id) {
await p.query(`UPDATE planeacion_cargas_columnas SET nombre = $2, orden = $3 WHERE id = $1`, [id, nombre, i]);
idsPorIndice[i] = id;
} else {
porCrear.push({ nombre, indice: i });
}
}
if (porCrear.length > 0) {
const valores = porCrear.map((_, k) => `($${k * 2 + 1}, $${k * 2 + 2})`).join(", ");
const params = porCrear.flatMap((c) => [c.nombre, c.indice]);
const creadas = await p.query(`INSERT INTO planeacion_cargas_columnas (nombre, orden) VALUES ${valores} RETURNING id, orden`, params);
for (const row of creadas.rows) idsPorIndice[row.orden] = row.id;
}
console.log("[planeacion-cargas] columnas resueltas:", idsPorIndice.filter(Boolean).length);

// Insertar todas las filas en una sola consulta por lote (evita 61 idas y vueltas a la base de datos).
if (PLANEACION_CARGAS_FILAS_SEED.length > 0) {
const marcadores: string[] = [];
const params: any[] = [];
PLANEACION_CARGAS_FILAS_SEED.forEach((fila, ordenFila) => {
const datos: Record<string, string> = {};
for (let i = 0; i < idsPorIndice.length; i++) {
if (fila[i]) datos[String(idsPorIndice[i])] = fila[i];
}
const base = params.length;
marcadores.push(`($${base + 1}::jsonb, $${base + 2})`);
params.push(JSON.stringify(datos), ordenFila);
});
await p.query(`INSERT INTO planeacion_cargas_filas (datos, orden) VALUES ${marcadores.join(", ")}`, params);
}
console.log("[planeacion-cargas] filas insertadas:", PLANEACION_CARGAS_FILAS_SEED.length);
} catch (errSiembra: any) {
console.error("[planeacion-cargas] ERROR EN SIEMBRA:", errSiembra && errSiembra.message, errSiembra && errSiembra.stack);
}
}
}
