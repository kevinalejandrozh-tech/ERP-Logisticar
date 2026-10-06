// Tipos compartidos del módulo de Compras.
export type ProductoOC = {
  cantidad: number;
  articulo: string;
  precioUnitario: number;
  totalProducto: number;
  referencia?: string;
  proveedor?: string;
  proveedores?: string[];
  compraUnica?: boolean;
  autorizado?: boolean;
  decision?: "rechazado" | "programado" | null;
  razon?: string | null;
  indicaciones?: string | null;
  fechaProgramada?: string | null;
  foto?: string; // foto de referencia (solo al capturar o al abrir el detalle)
  tieneFoto?: boolean;
};

export type Viatico = { concepto: string; monto: number };

export type DatosOC = {
  titulo?: string; // título de la compra
  enviosProveedores?: string[]; // proveedores que envían el pedido (no son parada de la ruta)
  medioPago?: string; // lo define quien autoriza
  dispersion?: string; // dispersión de recursos (lo define quien autoriza)
  dispersionDetalle?: string;
  rutaProveedores?: string[];
  vehiculo?: string;
  consumoPromedio?: string;
  combustible?: number;
  tiempoRegreso?: string;
  viaticos?: Viatico[];
  justificacion?: string;
};

export type OrdenCompra = {
  id?: number;
  folio: string;
  fecha: string;
  total_general?: number | string;
  productos: ProductoOC[] | string;
  estado?: string;
  datos?: DatosOC | null;
  solicitado_por?: string | null;
  autorizado_por?: string | null;
  autorizado_en?: string | null;
  created_at?: string;
};

export type Proveedor = {
  id: number;
  nombre: string;
  contacto: string | null;
  telefono: string | null;
  notas: string | null;
  maps_url: string | null;
  tiempo_traslado: string | null;
  a_domicilio: boolean;
  catalogo: string | null;
  costos: string | null;
  pagos_saldos: string | null;
  creditos: string | null;
  foto_mapa?: string | null;
};

// Opciones que elige quien autoriza la OC.
export const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Tarjeta corporativa", "Crédito con el proveedor", "Otro"];
export const DISPERSIONES = ["Caja chica (efectivo)", "Transferencia al solicitante", "Transferencia al proveedor", "Tarjeta de combustible / PASE", "Otra"];

export const proveedorDe = (p: ProductoOC) => (p.proveedor ?? p.proveedores?.[0] ?? "").trim();

export function productosDe(o: OrdenCompra): ProductoOC[] {
  if (Array.isArray(o.productos)) return o.productos;
  try {
    return JSON.parse(o.productos || "[]");
  } catch {
    return [];
  }
}

// Total de la OC = artículos (autorizados) + combustible + viáticos.
export const totalOC = (o: { total_general?: number | string; datos?: DatosOC | null }) =>
  (Number(o.total_general) || 0) + (Number(o.datos?.combustible) || 0) + (o.datos?.viaticos || []).reduce((a, v) => a + (Number(v.monto) || 0), 0);

export const moneda = (v: number | string | undefined | null) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v) || 0);

export const esRechazada = (estado?: string) => (estado || "").toLowerCase() === "rechazada";

// Autorizada o ya recibida (total o parcial) en almacén.
export const esAutorizada = (estado?: string) => ["autorizada", "recibida", "parcialmente recibida"].includes((estado || "").toLowerCase());
