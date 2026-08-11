export const LISTA_DESTINOS: string[] = [
  "ACAPULCO", "AGUASCALIENTES", "ALTAMIRA", "APODACA", "ATITALAQUIA", "CAMPECHE", "CANCUN",
  "CELAYA", "CHALCO", "CHETUMAL", "CHIHUAHUA", "CHILPANCINGO", "CIUDAD DEL CARMEN",
  "CIUDAD JUAREZ", "CIUDAD MANTE", "CIUDAD MIER", "CIUDAD MIGUEL ALEMAN", "CIUDAD OBREGON",
  "CIUDAD VICTORIA", "COATZACOALCOS", "COLIMA", "CORDOBA", "CORTAZAR", "COZUMEL", "CUERNAVACA",
  "CULIACAN", "DURANGO", "ENSENADA", "GOMEZ PALACIO", "GUADALAJARA", "GUAYMAS", "HERMOSILLO",
  "HUATULCO", "HUIXQUILUCAN", "IGUALA", "IRAPUATO", "IXTAPALUCA", "IXTLAHUACA", "JILOTEPEC",
  "JIUTEPEC", "LA PAZ", "LAZARO CARDENAS", "LEON", "LOS MOCHIS", "MANZANILLO", "MATAMOROS",
  "MAZATLAN", "MERIDA", "METEPEC", "MEXICALI", "MINATITLAN", "MONCLOVA", "MONTERREY", "MORELIA",
  "NOGALES", "NUEVO LAREDO", "OAXACA", "ORIZABA", "PACHUCA", "PIEDRAS NEGRAS", "POZA RICA",
  "PUEBLA", "PUERTO ESCONDIDO", "PUERTO VALLARTA", "QUERETARO", "REYNOSA", "SALINA CRUZ",
  "SALTILLO", "SAN LUIS POTOSI", "SILAO", "TAMPICO",
];

export const OPCIONES_CUENTA = ["DELL", "DELL/TMS", "LEXMARK", "MERCURY", "S2GO"];
export const OPCIONES_MERCANCIA = ["CAJAS", "PALLETS"];
export const OPCIONES_SERVICIO = ["LOCAL", "FORANEO"];
export const OPCIONES_TIPO_UNIDAD = ["1.5", "3.5", "RABON", "TORTON"];
export const OPCIONES_ESTATUS_ENTREGA = ["Devolución parcial", "Devolución total", "Vacío", "Recolecciones"];

export type TipoCampo = "datetime" | "text" | "number" | "select" | "datalist";
export type CampoViaje = {
  key: string;
  label: string;
  tipo: TipoCampo;
  opciones?: string[];
};
export type GrupoCampos = { titulo: string; campos: CampoViaje[] };

export function construirGrupos(operadores: string[], ecosUnidad: string[]): GrupoCampos[] {
  return [
    {
      titulo: "Programación",
      campos: [
        { key: "cargaPlaneadaCliente", label: "Carga planeada con el cliente", tipo: "datetime" },
        { key: "citaCargaPatio", label: "Cita para carga en patio Logisticar", tipo: "datetime" },
        { key: "inicioRutaProgramado", label: "Inicio de ruta programado", tipo: "datetime" },
        { key: "horarioCitaEntrega", label: "Horario de cita de entrega", tipo: "datetime" },
      ],
    },
    {
      titulo: "Cliente y embarque",
      campos: [
        { key: "nombreCuenta", label: "Nombre de la cuenta", tipo: "datalist", opciones: OPCIONES_CUENTA },
        { key: "proyectoDell", label: "Proyecto DELL", tipo: "text" },
        { key: "noEmbarque", label: "No. de embarque", tipo: "text" },
        { key: "cartaPorte", label: "Carta porte", tipo: "text" },
        { key: "estadoDestino", label: "Estado destino", tipo: "select", opciones: LISTA_DESTINOS },
        { key: "rutaDestino", label: "Ruta o destino", tipo: "select", opciones: LISTA_DESTINOS },
        { key: "noCajas", label: "No. de cajas", tipo: "number" },
        { key: "tipoMercancia", label: "Tipo de mercancía", tipo: "datalist", opciones: OPCIONES_MERCANCIA },
        { key: "tiros", label: "Tiros", tipo: "number" },
        { key: "tipoServicio", label: "Tipo de servicio", tipo: "select", opciones: OPCIONES_SERVICIO },
      ],
    },
    {
      titulo: "Unidad y operador",
      campos: [
        { key: "tipoUnidad", label: "Tipo de unidad", tipo: "select", opciones: OPCIONES_TIPO_UNIDAD },
        { key: "ecoUnidad", label: "ECO. Unidad", tipo: "select", opciones: ecosUnidad },
        { key: "operador", label: "Operador", tipo: "select", opciones: operadores },
      ],
    },
    {
      titulo: "Ejecución",
      campos: [
        { key: "horaArriboPatio", label: "Hora de arribo a patio Logisticar", tipo: "datetime" },
        { key: "arriboAlmacenCarga", label: "Arribo a almacén para carga", tipo: "datetime" },
        { key: "inicioRuta", label: "Inicio de ruta", tipo: "datetime" },
        { key: "arriboPatioAyudante", label: "Arribo a patio del ayudante", tipo: "datetime" },
        { key: "ayudante", label: "Ayudante", tipo: "datalist", opciones: operadores },
        { key: "nombreConfirma", label: "Nombre de quien confirma el servicio", tipo: "text" },
        { key: "terminoServicio", label: "Termino de servicio", tipo: "datetime" },
      ],
    },
    {
      titulo: "Entrega y devoluciones",
      campos: [
        { key: "estatusEntrega", label: "Estatus de entrega", tipo: "select", opciones: OPCIONES_ESTATUS_ENTREGA },
        { key: "motivoDevolucion", label: "Motivo de la devolución", tipo: "text" },
        { key: "noEmbarqueDevolucion", label: "No. de embarque de la devolución", tipo: "text" },
        { key: "arriboPatioFinal", label: "Arribo a patio", tipo: "datetime" },
      ],
    },
    {
      titulo: "Cierre administrativo",
      campos: [
        { key: "estatusRControl", label: "Estatus R. Control", tipo: "text" },
        { key: "liberacionServicio", label: "Liberación del servicio", tipo: "datetime" },
        { key: "facturaEntregaFinalizada", label: "Factura y entrega finalizada", tipo: "datetime" },
      ],
    },
  ];
}

export const CAMPOS_TABLA_PRINCIPAL: { key: string; label: string }[] = [
  { key: "noEmbarque", label: "No. embarque" },
  { key: "nombreCuenta", label: "Cuenta" },
  { key: "operador", label: "Operador" },
  { key: "ecoUnidad", label: "ECO. Unidad" },
  { key: "estadoDestino", label: "Estado destino" },
  { key: "rutaDestino", label: "Ruta o destino" },
  { key: "cargaPlaneadaCliente", label: "Carga planeada c/ cliente" },
  { key: "citaCargaPatio", label: "Cita carga patio" },
  { key: "horaArriboPatio", label: "Arribo a patio" },
  { key: "arriboAlmacenCarga", label: "Arribo almacén carga" },
  { key: "inicioRuta", label: "Inicio de ruta" },
  { key: "terminoServicio", label: "Termino de servicio" },
  { key: "estatusEntrega", label: "Estatus de entrega" },
];
