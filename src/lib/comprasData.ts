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
};

export type Viatico = { concepto: string; monto: number };

export type DatosOC = {
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

export const proveedorDe = (p: ProductoOC) => (p.proveedor ?? p.proveedores?.[0] ?? "").trim();

export function productosDe(o: OrdenCompra): ProductoOC[] {
  if (Array.isArray(o.productos)) return o.productos;
  try {
    return JSON.parse(o.productos || "[]");
  } catch {
    return [];
  }
}

export const moneda = (v: number | string | undefined | null) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(v) || 0);

// Autorizada o ya recibida (total o parcial) en almacén.
export const esAutorizada = (estado?: string) => ["autorizada", "recibida", "parcialmente recibida"].includes((estado || "").toLowerCase());
