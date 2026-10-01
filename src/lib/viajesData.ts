// Calendario de viajes por unidad: campos del registro de viaje.
export type TipoCampoViaje = "texto" | "fecha_hora" | "numero" | "estado" | "ruta" | "persona" | "eco" | "servicio" | "calculado" | "moneda";
export type CampoViaje = { clave: string; etiqueta: string; tipo: TipoCampoViaje; grupo: string };

export const CAMPOS_VIAJE: CampoViaje[] = [
  { clave: "No EMBARQUE", etiqueta: "No. embarque", tipo: "texto", grupo: "General" },
  { clave: "TIPO DE SERVICIO", etiqueta: "Tipo de servicio", tipo: "servicio", grupo: "General" },
  { clave: "CARGA PLANEADA X CLIENTE", etiqueta: "Carga planeada x cliente", tipo: "fecha_hora", grupo: "Planeación" },
  { clave: "CARGA PLANEADA X LOGISTICAR", etiqueta: "Carga planeada x Logisticar", tipo: "fecha_hora", grupo: "Planeación" },
  { clave: "INICIO DE RUTA PROGRAMADO", etiqueta: "Inicio de ruta programado", tipo: "fecha_hora", grupo: "Planeación" },
  { clave: "HORARIO DE CITA DE ENTREGA", etiqueta: "Horario de cita de entrega", tipo: "fecha_hora", grupo: "Planeación" },
  { clave: "NOMBRE CUENTA", etiqueta: "Nombre cuenta", tipo: "texto", grupo: "Servicio" },
  { clave: "PROYECTO DELL", etiqueta: "Proyecto DELL", tipo: "texto", grupo: "Servicio" },
  { clave: "CARTA PORTE", etiqueta: "Carta porte", tipo: "texto", grupo: "Servicio" },
  { clave: "ESTADO DESTINO", etiqueta: "Estado destino", tipo: "estado", grupo: "Servicio" },
  { clave: "RUTA O DESTINO", etiqueta: "Ruta o destino", tipo: "ruta", grupo: "Servicio" },
  { clave: "N° DE CAJAS", etiqueta: "N° de cajas", tipo: "numero", grupo: "Servicio" },
  { clave: "TIPO MERCANCIA", etiqueta: "Tipo mercancía", tipo: "texto", grupo: "Servicio" },
  { clave: "TIROS", etiqueta: "Tiros", tipo: "numero", grupo: "Servicio" },
  { clave: "TIPO", etiqueta: "Tipo", tipo: "texto", grupo: "Unidad y personal" },
  { clave: "ECO", etiqueta: "ECO", tipo: "eco", grupo: "Unidad y personal" },
  { clave: "OPERADOR", etiqueta: "Operador", tipo: "persona", grupo: "Unidad y personal" },
  { clave: "AYUDANTE", etiqueta: "Ayudante", tipo: "persona", grupo: "Unidad y personal" },
  { clave: "HORARIO ARRIBO PATIO", etiqueta: "Horario arribo patio", tipo: "fecha_hora", grupo: "Seguimiento" },
  { clave: "ESTATUS PATIO", etiqueta: "Estatus patio", tipo: "calculado", grupo: "Seguimiento" },
  { clave: "ARRIBO ALMACEN (CARGA)", etiqueta: "Arribo almacén (carga)", tipo: "fecha_hora", grupo: "Seguimiento" },
  { clave: "ESTATUS ALMACEN", etiqueta: "Estatus almacén", tipo: "calculado", grupo: "Seguimiento" },
  { clave: "INICIO DE RUTA", etiqueta: "Inicio de ruta", tipo: "fecha_hora", grupo: "Seguimiento" },
  { clave: "ARRIBO A PATIO AYUDANTE", etiqueta: "Arribo a patio ayudante", tipo: "fecha_hora", grupo: "Seguimiento" },
  { clave: "NOMBRE QUIEN CONFIRMA SERVICIO", etiqueta: "Nombre quien confirma servicio", tipo: "texto", grupo: "Cierre" },
  { clave: "TERMINO DE SERVICIO", etiqueta: "Término de servicio", tipo: "fecha_hora", grupo: "Cierre" },
  { clave: "ESTATUS", etiqueta: "Estatus", tipo: "texto", grupo: "Cierre" },
  { clave: "NUMERO DE EMBARQUE DE LA DEVOLUCION", etiqueta: "Número de embarque de la devolución", tipo: "texto", grupo: "Cierre" },
  { clave: "ARRIBO A PATIOO", etiqueta: "Arribo a patio (regreso)", tipo: "fecha_hora", grupo: "Cierre" },
  { clave: "ESTATUS USO DE CTRLTRACK", etiqueta: "Estatus uso de CtrlTrack", tipo: "texto", grupo: "Cierre" },
  { clave: "FECHA DE LIBERACION DEL SERVICIO", etiqueta: "Fecha de liberación del servicio", tipo: "fecha_hora", grupo: "Cierre" },
  { clave: "TERMINO ESTIMADO DE TERMINO DEL SERVICIO", etiqueta: "Término estimado del servicio", tipo: "fecha_hora", grupo: "Cierre" },
  // Gastos del viaje (se capturan con los botones de la parte superior del viaje).
  { clave: "GASTOS CASETAS", etiqueta: "Gastos de casetas", tipo: "moneda", grupo: "Gastos" },
  { clave: "GASTOS CASETAS DETALLE", etiqueta: "Detalle de casetas", tipo: "texto", grupo: "Gastos" },
  { clave: "VIATICOS EFECTIVO", etiqueta: "Viáticos en efectivo", tipo: "moneda", grupo: "Gastos" },
  { clave: "VIATICOS EFECTIVO DETALLE", etiqueta: "Detalle de viáticos en efectivo", tipo: "texto", grupo: "Gastos" },
  { clave: "VIATICOS TRANSFERENCIA", etiqueta: "Viáticos en transferencia", tipo: "moneda", grupo: "Gastos" },
  { clave: "VIATICOS TRANSFERENCIA DETALLE", etiqueta: "Detalle de viáticos en transferencia", tipo: "texto", grupo: "Gastos" },
];

// "General" va arriba en la ventana del viaje; "Gastos" se abre con sus botones.
export const GRUPOS_VIAJE = ["Planeación", "Servicio", "Unidad y personal", "Seguimiento", "Cierre"];

export const OPCIONES_TIPO_SERVICIO = [
  { valor: "FORANEO", etiqueta: "Foráneo" },
  { valor: "LOCAL", etiqueta: "Local" },
];

export const GASTOS_VIAJE = [
  { clave: "GASTOS CASETAS", boton: "Gastos de Casetas" },
  { clave: "VIATICOS EFECTIVO", boton: "Gastos Viáticos en efectivo" },
  { clave: "VIATICOS TRANSFERENCIA", boton: "Viáticos en transferencias" },
];

// Convierte "AAAA-MM-DDTHH:MM" (o un texto de fecha reconocible) a milisegundos; null si no es fecha.
function aMs(v?: string): number | null {
  const t = (v || "").trim();
  if (!t) return null;
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
  const d = Date.parse(t);
  return Number.isFinite(d) ? d : null;
}

// Estatus automáticos:
// - Estatus patio: Tarde si el arribo a patio es mayor a la carga planeada x Logisticar; si no, A Tiempo.
// - Estatus almacén: Tarde si el arribo al almacén (carga) es mayor a la carga planeada x cliente; si no, A Tiempo.
export function calcularEstatusViaje(d: Record<string, string>): { patio: string; almacen: string } {
  const comparar = (real?: string, plan?: string) => {
    const r = aMs(real);
    const p = aMs(plan);
    if (r === null || p === null) return "";
    return r > p ? "Tarde" : "A Tiempo";
  };
  return {
    patio: comparar(d["HORARIO ARRIBO PATIO"], d["CARGA PLANEADA X LOGISTICAR"]),
    almacen: comparar(d["ARRIBO ALMACEN (CARGA)"], d["CARGA PLANEADA X CLIENTE"]),
  };
}

export function esViajeLocal(d: Record<string, string>): boolean {
  return String(d["TIPO DE SERVICIO"] || "").trim().toUpperCase() === "LOCAL";
}

export type Viaje = {
  id: number;
  eco: string;
  fecha: string;
  datos: Record<string, string>;
  operador_id: number | null;
  ayudante_id: number | null;
};

// Etiqueta en el calendario: NOMBRE CUENTA + ESTADO DESTINO / RUTA O DESTINO + No EMBARQUE.
export function etiquetaViaje(d: Record<string, string>): { linea1: string; linea2: string } {
  const j = (a?: string, b?: string) => [a, b].map((x) => (x || "").trim()).filter(Boolean).join(" · ");
  return { linea1: j(d["NOMBRE CUENTA"], d["ESTADO DESTINO"]) || "Viaje", linea2: j(d["RUTA O DESTINO"], d["No EMBARQUE"] ? `Emb. ${d["No EMBARQUE"]}` : "") };
}
