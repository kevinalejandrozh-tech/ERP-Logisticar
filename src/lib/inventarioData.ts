// Catálogo de categorías del módulo "Control de inventario".
// Cada categoría define SOLO los campos que le corresponden, para mantener congruencia
// (ej. un escritorio nunca pedirá procesador; una laptop sí).
// Para agregar una categoría nueva basta con añadir un objeto a CATEGORIAS_INVENTARIO.

export type TipoCampo = "texto" | "numero" | "select" | "fecha";

export interface CampoInventario {
  clave: string;
  etiqueta: string;
  tipo: TipoCampo;
  opciones?: string[];
  requerido?: boolean;
  placeholder?: string;
}

export interface CategoriaInventario {
  clave: string;
  nombre: string;
  prefijo: string; // se usa para el folio: LAP-0001, ESC-0001...
  campos: CampoInventario[];
}

export const ESTADOS_INVENTARIO = ["Activo", "En reparación", "En almacén", "Baja"] as const;
export type EstadoInventario = (typeof ESTADOS_INVENTARIO)[number];

// Campos que TODOS los equipos comparten.
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

const CAMPOS_COMPUTO: CampoInventario[] = [
  { clave: "procesador", etiqueta: "Procesador", tipo: "texto", placeholder: "Ej. Intel Core i7-1255U" },
  { clave: "ram_gb", etiqueta: "Memoria RAM (GB)", tipo: "numero" },
  { clave: "almacenamiento_gb", etiqueta: "Almacenamiento (GB)", tipo: "numero" },
  { clave: "tipo_almacenamiento", etiqueta: "Tipo de disco", tipo: "select", opciones: ["SSD", "HDD", "NVMe"] },
  { clave: "sistema_operativo", etiqueta: "Sistema operativo", tipo: "texto", placeholder: "Ej. Windows 11 Pro" },
];

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

export function obtenerCategoria(clave: string): CategoriaInventario | undefined {
  return CATEGORIAS_INVENTARIO.find((c) => c.clave === clave);
}

export interface EquipoInventario {
  id: number;
  folio: string;
  categoria: string;
  estado: EstadoInventario;
  datos: Record<string, string>; // campos generales + campos de la categoría
  created_at: string;
}