// Calendario de viajes por unidad: campos del registro de viaje.
export type TipoCampoViaje = "texto" | "fecha_hora" | "numero" | "estado" | "ruta" | "persona" | "eco";
export type CampoViaje = { clave: string; etiqueta: string; tipo: TipoCampoViaje; grupo: string };

export const CAMPOS_VIAJE: CampoViaje[] = [
  { clave: "CARGA PLANEADA X CLIENTE", etiqueta: "Carga planeada x cliente", tipo: "texto", grupo: "Planeación" },
  { clave: "CARGA PLANEADA X LOGISTICAR", etiqueta: "Carga planeada x Logisticar", tipo: "texto", grupo: "Planeación" },
  { clave: "INICIO DE RUTA PROGRAMADO", etiqueta: "Inicio de ruta programado", tipo: "fecha_hora", grupo: "Planeación" },
  { clave: "HORARIO DE CITA DE ENTREGA", etiqueta: "Horario de cita de entrega", tipo: "fecha_hora", grupo: "Planeación" },
  { clave: "NOMBRE CUENTA", etiqueta: "Nombre cuenta", tipo: "texto", grupo: "Servicio" },
  { clave: "PROYECTO DELL", etiqueta: "Proyecto DELL", tipo: "texto", grupo: "Servicio" },
  { clave: "No EMBARQUE", etiqueta: "No. embarque", tipo: "texto", grupo: "Servicio" },
  { clave: "CARTA PORTE", etiqueta: "Carta porte", tipo: "texto", grupo: "Servicio" },
  { clave: "ESTADO DESTINO", etiqueta: "Estado destino", tipo: "estado", grupo: "Servicio" },
  { clave: "RUTA O DESTINO", etiqueta: "Ruta o destino", tipo: "ruta", grupo: "Servicio" },
  { clave: "N° DE CAJAS", etiqueta: "N° de cajas", tipo: "numero", grupo: "Servicio" },
  { clave: "TIPO MERCANCIA", etiqueta: "Tipo mercancía", tipo: "texto", grupo: "Servicio" },
  { clave: "TIROS", etiqueta: "Tiros", tipo: "numero", grupo: "Servicio" },
  { clave: "TIPO DE SERVICIO", etiqueta: "Tipo de servicio", tipo: "texto", grupo: "Servicio" },
  { clave: "TIPO", etiqueta: "Tipo", tipo: "texto", grupo: "Unidad y personal" },
  { clave: "ECO", etiqueta: "ECO", tipo: "eco", grupo: "Unidad y personal" },
  { clave: "OPERADOR", etiqueta: "Operador", tipo: "persona", grupo: "Unidad y personal" },
  { clave: "AYUDANTE", etiqueta: "Ayudante", tipo: "persona", grupo: "Unidad y personal" },
  { clave: "HORARIO ARRIBO PATIO", etiqueta: "Horario arribo patio", tipo: "fecha_hora", grupo: "Seguimiento" },
  { clave: "ESTATUS PATIO", etiqueta: "Estatus patio", tipo: "texto", grupo: "Seguimiento" },
  { clave: "ARRIBO ALMACEN (CARGA)", etiqueta: "Arribo almacén (carga)", tipo: "fecha_hora", grupo: "Seguimiento" },
  { clave: "ESTATUS ALMACEN", etiqueta: "Estatus almacén", tipo: "texto", grupo: "Seguimiento" },
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
];

export const GRUPOS_VIAJE = ["Planeación", "Servicio", "Unidad y personal", "Seguimiento", "Cierre"];

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
