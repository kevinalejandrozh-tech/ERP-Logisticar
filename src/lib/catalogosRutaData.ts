// Catálogos de ruta: definición de campos (la usan la API y las páginas).
import { ESTADOS_MX } from "./asistenciaData";

export type TipoCampo = "texto" | "area" | "numero" | "si_no" | "seleccion" | "estado" | "costos_unidad";
export type CampoCat = { clave: string; etiqueta: string; tipo: TipoCampo; opciones?: string[]; requerido?: boolean; ayuda?: string; ancho?: "completo" };
export type DefCatalogo = {
  titulo: string;
  singular: string;
  descripcion: string;
  campoNombre: string; // etiqueta del campo "nombre" (principal)
  campos: CampoCat[]; // además del nombre
  columnas: string[]; // claves que se muestran en la lista (además del nombre)
  adjunto?: { tipo: "imagen" | "documento"; etiqueta: string };
  soloMonitoreo?: boolean; // solo lo ve Monitoreo de Rutas (y sysadmin)
};

// Tipos de unidad para el costo de casetas (se usan en las rutas para totalizar).
export const TIPOS_UNIDAD_CASETA = ["1.5", "3.5", "Rabón", "Torton"] as const;
export const METODOS_CASETA = ["Efectivo", "PASE"] as const;

const estado: CampoCat = { clave: "estado", etiqueta: "Estado", tipo: "estado" };
const notas: CampoCat = { clave: "notas", etiqueta: "Notas", tipo: "area", ancho: "completo" };

export const CATALOGOS: Record<string, DefCatalogo> = {
  resguardos: {
    titulo: "Resguardos",
    singular: "resguardo",
    descripcion: "Hoteles y resguardos sobre ruta con su costo y ubicación.",
    campoNombre: "Nombre del hotel",
    campos: [
      estado,
      { clave: "ciudad", etiqueta: "Ciudad", tipo: "texto" },
      { clave: "telefonos", etiqueta: "Teléfonos", tipo: "texto" },
      { clave: "direccion", etiqueta: "Dirección", tipo: "texto", ancho: "completo" },
      { clave: "coordenadas", etiqueta: "Coordenadas", tipo: "texto", ayuda: "Ej. 19.4326, -99.1332" },
      { clave: "costo", etiqueta: "Costo de la estancia ($)", tipo: "numero" },
      { clave: "incluido_tarifa", etiqueta: "¿Costo incluido en la tarifa?", tipo: "si_no" },
      notas,
    ],
    columnas: ["estado", "ciudad", "telefonos", "costo", "incluido_tarifa"],
    adjunto: { tipo: "imagen", etiqueta: "Imagen del mapa" },
  },
  casetas: {
    titulo: "Casetas",
    singular: "caseta",
    descripcion: "Casetas con su forma de pago y costo por tipo de unidad.",
    campoNombre: "Nombre de la caseta",
    campos: [
      estado,
      { clave: "carretera", etiqueta: "Carretera / tramo", tipo: "texto" },
      { clave: "metodo_pago", etiqueta: "Forma de pago", tipo: "seleccion", opciones: [...METODOS_CASETA], requerido: true },
      { clave: "costos", etiqueta: "Costo por tipo de unidad ($)", tipo: "costos_unidad", ancho: "completo" },
      notas,
    ],
    columnas: ["estado", "carretera", "metodo_pago", "costos"],
  },
  alimentos: {
    titulo: "Proveedores de alimentos",
    singular: "proveedor de alimentos",
    descripcion: "Lugares autorizados para comer sobre ruta.",
    campoNombre: "Nombre del lugar",
    campos: [
      estado,
      { clave: "ciudad", etiqueta: "Ciudad", tipo: "texto" },
      { clave: "direccion", etiqueta: "Dirección", tipo: "texto", ancho: "completo" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
      { clave: "costo_promedio", etiqueta: "Costo promedio por comida ($)", tipo: "numero" },
      { clave: "horario", etiqueta: "Horario", tipo: "texto" },
      notas,
    ],
    columnas: ["estado", "ciudad", "telefono", "costo_promedio"],
  },
  comidas_reservaciones: {
    titulo: "Comidas y reservaciones",
    singular: "comida o reservación",
    descripcion: "Comidas y reservaciones acordadas para los viajes.",
    campoNombre: "Nombre",
    campos: [
      { clave: "tipo", etiqueta: "Tipo", tipo: "seleccion", opciones: ["Comida", "Reservación"], requerido: true },
      estado,
      { clave: "ciudad", etiqueta: "Ciudad", tipo: "texto" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
      { clave: "costo", etiqueta: "Costo ($)", tipo: "numero" },
      notas,
    ],
    columnas: ["tipo", "estado", "ciudad", "costo"],
  },
  gasolineras: {
    titulo: "Gasolineras",
    singular: "gasolinera",
    descripcion: "Gasolineras permitidas para cargar combustible.",
    campoNombre: "Nombre de la gasolinera",
    campos: [
      estado,
      { clave: "carretera", etiqueta: "Carretera / km", tipo: "texto" },
      { clave: "direccion", etiqueta: "Dirección", tipo: "texto", ancho: "completo" },
      { clave: "coordenadas", etiqueta: "Coordenadas", tipo: "texto" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
      { clave: "acepta_vale", etiqueta: "¿Acepta vale de combustible?", tipo: "si_no" },
      notas,
    ],
    columnas: ["estado", "carretera", "telefono", "acepta_vale"],
  },
  mecanicos: {
    titulo: "Mecánicos sobre ruta",
    singular: "mecánico",
    descripcion: "Talleres y mecánicos de apoyo sobre las rutas.",
    campoNombre: "Nombre del taller o mecánico",
    campos: [
      estado,
      { clave: "ciudad", etiqueta: "Ciudad / carretera", tipo: "texto" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
      { clave: "especialidad", etiqueta: "Especialidad", tipo: "texto" },
      { clave: "horario", etiqueta: "Horario", tipo: "texto" },
      { clave: "atiende_24h", etiqueta: "¿Atiende 24 horas?", tipo: "si_no" },
      notas,
    ],
    columnas: ["estado", "ciudad", "telefono", "especialidad", "atiende_24h"],
  },
  contactos_clave: {
    titulo: "Contactos clave",
    singular: "contacto clave",
    descripcion: "Contacto por estado, pagos pactados, instrucciones y restricciones para circular.",
    campoNombre: "Nombre del contacto",
    campos: [
      { ...estado, requerido: true },
      { clave: "cargo", etiqueta: "Cargo / institución", tipo: "texto" },
      { clave: "telefono", etiqueta: "Teléfono", tipo: "texto" },
      { clave: "fechas_pago", etiqueta: "Fechas de pagos pactadas", tipo: "texto", ancho: "completo" },
      { clave: "instrucciones", etiqueta: "Instrucciones para el operador", tipo: "area", ancho: "completo" },
      { clave: "reglamento", etiqueta: "Reglamento y restricciones para circular", tipo: "area", ancho: "completo" },
    ],
    columnas: ["estado", "cargo", "telefono", "fechas_pago"],
  },
  reglamentos: {
    titulo: "Reglamentos y documentos oficiales",
    singular: "documento",
    descripcion: "Reglamentos, permisos y normas con su archivo.",
    campoNombre: "Título del documento",
    campos: [
      { clave: "tipo", etiqueta: "Tipo", tipo: "seleccion", opciones: ["Reglamento", "Permiso", "Norma", "Otro"] },
      estado,
      { clave: "vigencia", etiqueta: "Vigencia", tipo: "texto" },
      { clave: "descripcion", etiqueta: "Descripción", tipo: "area", ancho: "completo" },
    ],
    columnas: ["tipo", "estado", "vigencia"],
    adjunto: { tipo: "documento", etiqueta: "Archivo (PDF, Word, Excel o imagen)" },
  },
  zonas_sin_cobertura: {
    titulo: "Zonas sin cobertura",
    singular: "zona sin cobertura",
    descripcion: "Tramos sin señal. Solo lo ve Monitoreo.",
    campoNombre: "Zona o tramo",
    campos: [estado, { clave: "carretera", etiqueta: "Carretera / km", tipo: "texto" }, notas],
    columnas: ["estado", "carretera"],
    soloMonitoreo: true,
  },
  procedimientos: {
    titulo: "Procedimientos cortos",
    singular: "procedimiento",
    descripcion: "Título y pasos de procedimientos de consulta rápida.",
    campoNombre: "Título",
    campos: [{ clave: "pasos", etiqueta: "Pasos", tipo: "area", ancho: "completo", ayuda: "Un paso por línea" }],
    columnas: [],
  },
};

export const ORDEN_CATALOGOS = ["resguardos", "casetas", "alimentos", "comidas_reservaciones", "gasolineras", "mecanicos", "contactos_clave", "reglamentos", "zonas_sin_cobertura", "procedimientos"];
export { ESTADOS_MX };

export const MIMES_DOC = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
