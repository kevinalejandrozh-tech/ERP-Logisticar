// Tipos, catálogo inicial y validaciones del módulo "Control de inventario".
// Las categorías viven en la base de datos (tabla inventario_categorias).
// CATEGORIAS_INVENTARIO solo es la carga inicial: después se administran desde el sistema.

export type TipoCampo = "texto" | "numero" | "select" | "fecha";

export const TIPOS_CAMPO: { valor: TipoCampo; etiqueta: string }[] = [
  { valor: "texto", etiqueta: "Texto" },
  { valor: "numero", etiqueta: "Número" },
  { valor: "fecha", etiqueta: "Fecha" },
  { valor: "select", etiqueta: "Lista de opciones" },
];

export interface CampoInventario {
  clave: string; // identificador fijo: no cambia aunque se renombre la etiqueta
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  requerido?: boolean;
  placeholder?: string;
  activo?: boolean; // false = ya no se pide en registros nuevos, pero se conserva lo capturado
}

export interface CategoriaInventario {
  clave: string;
  nombre: string;
  prefijo: string; // se usa para el folio: LAP-0001, ESC-0001...
  campos: CampoInventario[];
}

// Categoría tal como viene de la base de datos.
export interface CategoriaInventarioBD extends CategoriaInventario {
  id: number;
  activa: boolean;
  total_equipos?: number;
}

export const ESTADOS_INVENTARIO = ["Activo", "En reparación", "En almacén", "Baja"] as const;
export type EstadoInventario = (typeof ESTADOS_INVENTARIO)[number];

export function esEstadoValido(valor: unknown): valor is EstadoInventario {
  return typeof valor === "string" && (ESTADOS_INVENTARIO as readonly string[]).includes(valor);
}

// Campos que TODOS los equipos comparten (fijos, no se editan desde el sistema).
export const CAMPOS_GENERALES: CampoInventario[] = [
  { clave: "nombre", etiqueta: "Nombre / descripción", tipo: "texto", requerido: true, placeholder: "Ej. Laptop de Tráfico" },
  { clave: "marca", etiqueta: "Marca", tipo: "texto" },
  { clave: "modelo", etiqueta: "Modelo", tipo: "texto" },
  { clave: "numero_serie", etiqueta: "No. de serie", tipo: "texto" },
  { clave: "area", etiqueta: "Área", tipo: "texto", placeholder: "Ej. Operaciones" },
  { clave: "ubicacion", etiqueta: "Ubicación", tipo: "texto", placeholder: "Ej. Oficina planta alta" },
  { clave: "responsable", etiqueta: "Responsable / resguardo", tipo: "texto" },
  { clave: "fecha_adquisicion", etiqueta: "Fecha de adquisición", tipo: "fecha" },
];

// Claves reservadas: una categoría no puede definir un campo con estos nombres.
export const CLAVES_RESERVADAS = new Set([...CAMPOS_GENERALES.map((c) => c.clave), "notas"]);

const CAMPOS_COMPUTO: CampoInventario[] = [
  { clave: "procesador", etiqueta: "Procesador", tipo: "texto", placeholder: "Ej. Intel Core i7-1255U" },
  { clave: "ram_gb", etiqueta: "Memoria RAM (GB)", tipo: "numero" },
  { clave: "almacenamiento_gb", etiqueta: "Almacenamiento (GB)", tipo: "numero" },
  { clave: "tipo_almacenamiento", etiqueta: "Tipo de disco", tipo: "select", opciones: ["SSD", "HDD", "NVMe"] },
  { clave: "sistema_operativo", etiqueta: "Sistema operativo", tipo: "texto", placeholder: "Ej. Windows 11 Pro" },
];

// Carga inicial (se inserta una sola vez en la base de datos).
export const CATEGORIAS_INVENTARIO: CategoriaInventario[] = [
  {
    clave: "laptop",
    nombre: "Laptop",
    prefijo: "LAP",
    campos: [...CAMPOS_COMPUTO, { clave: "pantalla_pulgadas", etiqueta: "Pantalla (pulgadas)", tipo: "numero" }],
  },
  { clave: "computadora", nombre: "Computadora / CPU", prefijo: "CPU", campos: [...CAMPOS_COMPUTO] },
  {
    clave: "monitor",
    nombre: "Monitor",
    prefijo: "MON",
    campos: [
      { clave: "pantalla_pulgadas", etiqueta: "Tamaño (pulgadas)", tipo: "numero" },
      { clave: "resolucion", etiqueta: "Resolución", tipo: "texto", placeholder: "Ej. 1920x1080" },
      { clave: "entradas", etiqueta: "Entradas", tipo: "texto", placeholder: "Ej. HDMI, VGA" },
    ],
  },
  {
    clave: "impresora",
    nombre: "Impresora",
    prefijo: "IMP",
    campos: [
      { clave: "tipo_impresion", etiqueta: "Tipo", tipo: "select", opciones: ["Láser", "Inyección de tinta", "Térmica", "Multifuncional"] },
      { clave: "a_color", etiqueta: "¿Imprime a color?", tipo: "select", opciones: ["Sí", "No"] },
      { clave: "conexion", etiqueta: "Conexión", tipo: "select", opciones: ["USB", "Red / Ethernet", "Wi-Fi"] },
    ],
  },
  {
    clave: "celular",
    nombre: "Celular / Teléfono",
    prefijo: "CEL",
    campos: [
      { clave: "imei", etiqueta: "IMEI", tipo: "texto" },
      { clave: "numero_linea", etiqueta: "Número de línea", tipo: "texto" },
      { clave: "compania", etiqueta: "Compañía", tipo: "texto", placeholder: "Ej. Telcel" },
      { clave: "almacenamiento_gb", etiqueta: "Almacenamiento (GB)", tipo: "numero" },
    ],
  },
  {
    clave: "escritorio",
    nombre: "Escritorio",
    prefijo: "ESC",
    campos: [
      { clave: "material", etiqueta: "Material", tipo: "select", opciones: ["Madera", "Melamina", "Metal", "Vidrio", "Mixto"] },
      { clave: "medidas", etiqueta: "Medidas (cm)", tipo: "texto", placeholder: "Ej. 120 x 60 x 75" },
      { clave: "color", etiqueta: "Color", tipo: "texto" },
      { clave: "cajones", etiqueta: "No. de cajones", tipo: "numero" },
    ],
  },
  {
    clave: "silla",
    nombre: "Silla",
    prefijo: "SIL",
    campos: [
      { clave: "tipo_silla", etiqueta: "Tipo", tipo: "select", opciones: ["Ejecutiva", "Operativa", "Visita", "Otra"] },
      { clave: "color", etiqueta: "Color", tipo: "texto" },
    ],
  },
  { clave: "otro", nombre: "Otro", prefijo: "OTR", campos: [] },
];

// Busca una categoría dentro de una lista (por defecto, el catálogo inicial).
export function obtenerCategoria<T extends CategoriaInventario = CategoriaInventario>(
  clave: string,
  lista: T[] = CATEGORIAS_INVENTARIO as T[]
): T | undefined {
  return lista.find((c) => c.clave === clave);
}

// Campos que se piden al registrar un equipo nuevo.
export function camposActivos(categoria: CategoriaInventario): CampoInventario[] {
  return categoria.campos.filter((c) => c.activo !== false);
}

// Convierte un texto libre en una clave segura: "Tipo de prenda" -> "tipo_de_prenda".
export function generarClave(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

// Valida y limpia una categoría antes de guardarla (se usa en el servidor y en el formulario).
export function validarCategoria(entrada: unknown): { ok: true; categoria: CategoriaInventario } | { ok: false; error: string } {
  if (!entrada || typeof entrada !== "object") return { ok: false, error: "Datos de categoría inválidos." };
  const e = entrada as Record<string, unknown>;

  const nombre = typeof e.nombre === "string" ? e.nombre.trim() : "";
  if (!nombre) return { ok: false, error: "El nombre de la categoría es obligatorio." };

  const prefijo = typeof e.prefijo === "string" ? e.prefijo.trim().toUpperCase() : "";
  if (!/^[A-Z]{2,5}$/.test(prefijo)) return { ok: false, error: "El prefijo debe tener de 2 a 5 letras (ej. ROP)." };

  const clave = typeof e.clave === "string" && e.clave.trim() ? generarClave(e.clave) : generarClave(nombre);
  if (!clave) return { ok: false, error: "No se pudo generar la clave de la categoría." };

  if (!Array.isArray(e.campos)) return { ok: false, error: "La lista de campos es inválida." };

  const tiposValidos = new Set(TIPOS_CAMPO.map((t) => t.valor));
  const clavesUsadas = new Set<string>();
  const campos: CampoInventario[] = [];

  for (const bruto of e.campos) {
    if (!bruto || typeof bruto !== "object") return { ok: false, error: "Hay un campo inválido." };
    const c = bruto as Record<string, unknown>;

    const etiqueta = typeof c.etiqueta === "string" ? c.etiqueta.trim() : "";
    if (!etiqueta) return { ok: false, error: "Todos los campos deben tener nombre." };

    const claveCampo = typeof c.clave === "string" && c.clave.trim() ? generarClave(c.clave) : generarClave(etiqueta);
    if (!claveCampo) return { ok: false, error: `El campo "${etiqueta}" tiene un nombre inválido.` };
    if (CLAVES_RESERVADAS.has(claveCampo)) return { ok: false, error: `"${etiqueta}" ya existe como dato general de todos los equipos.` };
    if (clavesUsadas.has(claveCampo)) return { ok: false, error: `El campo "${etiqueta}" está repetido.` };
    clavesUsadas.add(claveCampo);

    const tipo = c.tipo as TipoCampo;
    if (!tiposValidos.has(tipo)) return { ok: false, error: `El campo "${etiqueta}" tiene un tipo inválido.` };

    const campo: CampoInventario = { clave: claveCampo, etiqueta, tipo };

    if (tipo === "select") {
      const opciones = Array.isArray(c.opciones)
        ? Array.from(new Set(c.opciones.filter((o): o is string => typeof o === "string").map((o) => o.trim()).filter(Boolean)))
        : [];
      if (opciones.length < 2) return { ok: false, error: `La lista "${etiqueta}" necesita al menos 2 opciones.` };
      campo.opciones = opciones;
    }
    if (c.requerido === true) campo.requerido = true;
    if (typeof c.placeholder === "string" && c.placeholder.trim()) campo.placeholder = c.placeholder.trim();
    if (c.activo === false) campo.activo = false;

    campos.push(campo);
  }

  return { ok: true, categoria: { clave, nombre, prefijo, campos } };
}

export interface EquipoInventario {
  id: number;
  folio: string;
  categoria: string; // clave de la categoría
  estado: EstadoInventario;
  datos: Record<string, string>; // campos generales + campos de la categoría + notas
  created_at: string;
  updated_at?: string;
}

// Lo único que ve una persona que escanea el QR sin iniciar sesión.
export interface EquipoPublico {
  folio: string;
  estado: EstadoInventario;
  categoria: string; // nombre visible de la categoría
  campos: { etiqueta: string; valor: string }[];
  nombre: string;
}