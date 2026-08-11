export const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const ESTADOS_MEXICO = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Chiapas", "Chihuahua",
  "Ciudad de México", "Coahuila", "Colima", "Durango", "Estado de México", "Guanajuato", "Guerrero",
  "Hidalgo", "Jalisco", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca", "Puebla",
  "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco", "Tamaulipas",
  "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
];

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

// Coordenadas aproximadas (lat, lon) usadas solo para el mapa esquemático del dashboard.
export const COORDENADAS_DESTINO: Record<string, [number, number]> = {
  ACAPULCO: [16.86, -99.89], AGUASCALIENTES: [21.88, -102.29], ALTAMIRA: [22.4, -97.93],
  APODACA: [25.78, -100.19], ATITALAQUIA: [20.05, -99.22], CAMPECHE: [19.85, -90.53],
  CANCUN: [21.16, -86.85], CELAYA: [20.52, -100.82], CHALCO: [19.26, -98.9], CHETUMAL: [18.5, -88.3],
  CHIHUAHUA: [28.63, -106.07], CHILPANCINGO: [17.55, -99.5], "CIUDAD DEL CARMEN": [18.65, -91.8],
  "CIUDAD JUAREZ": [31.69, -106.42], "CIUDAD MANTE": [22.73, -98.95], "CIUDAD MIER": [26.43, -99.15],
  "CIUDAD MIGUEL ALEMAN": [26.4, -99.03], "CIUDAD OBREGON": [27.49, -109.94], "CIUDAD VICTORIA": [23.74, -99.14],
  COATZACOALCOS: [18.14, -94.42], COLIMA: [19.24, -103.72], CORDOBA: [18.89, -96.93], CORTAZAR: [20.48, -100.96],
  COZUMEL: [20.51, -86.95], CUERNAVACA: [18.92, -99.23], CULIACAN: [24.81, -107.39], DURANGO: [24.02, -104.67],
  ENSENADA: [31.87, -116.6], "GOMEZ PALACIO": [25.57, -103.5], GUADALAJARA: [20.68, -103.35],
  GUAYMAS: [27.92, -110.9], HERMOSILLO: [29.07, -110.96], HUATULCO: [15.77, -96.13],
  HUIXQUILUCAN: [19.36, -99.35], IGUALA: [18.34, -99.54], IRAPUATO: [20.68, -101.35],
  IXTAPALUCA: [19.32, -98.88], IXTLAHUACA: [19.57, -99.77], JILOTEPEC: [19.95, -99.53],
  JIUTEPEC: [18.88, -99.17], "LA PAZ": [24.14, -110.31], "LAZARO CARDENAS": [17.96, -102.2],
  LEON: [21.12, -101.68], "LOS MOCHIS": [25.79, -108.99], MANZANILLO: [19.05, -104.32],
  MATAMOROS: [25.87, -97.5], MAZATLAN: [23.25, -106.41], MERIDA: [20.97, -89.62], METEPEC: [19.26, -99.61],
  MEXICALI: [32.62, -115.45], MINATITLAN: [17.99, -94.53], MONCLOVA: [26.91, -101.42],
  MONTERREY: [25.68, -100.32], MORELIA: [19.7, -101.19], NOGALES: [31.32, -110.94],
  "NUEVO LAREDO": [27.48, -99.51], OAXACA: [17.06, -96.73], ORIZABA: [18.85, -97.1], PACHUCA: [20.12, -98.74],
  "PIEDRAS NEGRAS": [28.7, -100.52], "POZA RICA": [20.53, -97.46], PUEBLA: [19.04, -98.2],
  "PUERTO ESCONDIDO": [15.87, -97.07], "PUERTO VALLARTA": [20.65, -105.23], QUERETARO: [20.59, -100.39],
  REYNOSA: [26.05, -98.29], "SALINA CRUZ": [16.17, -95.2], SALTILLO: [25.42, -101.0],
  "SAN LUIS POTOSI": [22.15, -100.98], SILAO: [20.94, -101.43], TAMPICO: [22.24, -97.86],
};

export const OPCIONES_CUENTA = [
  "N/A", "BOSE", "TRAFFIC TECH", "DELL", "DELL/TMS", "DOREL", "GEODIS", "GILDAN", "KARCHER", "KIDS",
  "GREEN FACE", "BAUSCH & LOMB", "LEGO", "LEXMARK", "LOCCITANE", "MARVEL", "PUMA", "MINDRAY", "MIRKA",
  "CAMBRIDGE", "CENTER POINT", "NESTLE", "NEXUS", "PANASONIC", "PARAMOUNT", "PHILIPS ALTILON",
  "PHILIPS CONSUME", "DUPONT", "S2GO", "SCHNEIDER", "SOLVAY", "SPLENDA", "MERCURY", "UNDER ARMOUR",
  "UNIVERSAL", "CTM", "XEROX", "H&M", "ACE HARDWARE", "TCL", "PEARSON", "PMM", "53 CARGO",
  "STEVE MADDEN", "OFFICE DEPOT", "BREMBO", "KEENFINITY", "RAVENSBURGER", "INFINITY",
];

export const OPCIONES_MERCANCIA = ["CAJAS", "PALLETS"];
export const OPCIONES_SERVICIO = ["LOCAL", "FORANEO"];
export const OPCIONES_TIPO_UNIDAD = ["1.5", "3.5", "RABON", "TORTON"];
export const OPCIONES_ESTATUS_ENTREGA = ["Devolución parcial", "Devolución total", "Vacío", "Recolecciones"];

export type TipoCampo = "dia" | "datetime" | "text" | "number" | "select" | "datalist";
export type CampoViaje = { key: string; label: string; tipo: TipoCampo; opciones?: string[] };

export function construirCampos(operadores: string[], ecosUnidad: string[]): CampoViaje[] {
  return [
    { key: "dia", label: "Día", tipo: "dia" },
    { key: "cargaPlaneadaCliente", label: "Carga planeada c/cliente", tipo: "datetime" },
    { key: "citaCargaPatio", label: "Cita carga patio Logisticar", tipo: "datetime" },
    { key: "inicioRutaProgramado", label: "Inicio de ruta programado", tipo: "datetime" },
    { key: "horarioCitaEntrega", label: "Horario cita de entrega", tipo: "datetime" },
    { key: "nombreCuenta", label: "Nombre de la cuenta", tipo: "datalist", opciones: OPCIONES_CUENTA },
    { key: "proyectoDell", label: "Proyecto DELL", tipo: "text" },
    { key: "noEmbarque", label: "No. de embarque", tipo: "text" },
    { key: "cartaPorte", label: "Carta porte", tipo: "text" },
    { key: "estadoDestino", label: "Estado destino", tipo: "select", opciones: ESTADOS_MEXICO },
    { key: "rutaDestino", label: "Ruta o destino", tipo: "datalist", opciones: LISTA_DESTINOS },
    { key: "noCajas", label: "No. de cajas", tipo: "number" },
    { key: "tipoMercancia", label: "Tipo de mercancía", tipo: "datalist", opciones: OPCIONES_MERCANCIA },
    { key: "tiros", label: "Tiros", tipo: "number" },
    { key: "tipoServicio", label: "Tipo de servicio", tipo: "select", opciones: OPCIONES_SERVICIO },
    { key: "tipoUnidad", label: "Tipo de unidad", tipo: "select", opciones: OPCIONES_TIPO_UNIDAD },
    { key: "ecoUnidad", label: "ECO. Unidad", tipo: "datalist", opciones: ecosUnidad },
    { key: "operador", label: "Operador", tipo: "datalist", opciones: operadores },
    { key: "horaArriboPatio", label: "Hora arribo a patio Logisticar", tipo: "datetime" },
    { key: "arriboAlmacenCarga", label: "Arribo a almacén (carga)", tipo: "datetime" },
    { key: "inicioRuta", label: "Inicio de ruta", tipo: "datetime" },
    { key: "arriboPatioAyudante", label: "Arribo a patio del ayudante", tipo: "datetime" },
    { key: "ayudante", label: "Ayudante", tipo: "datalist", opciones: operadores },
    { key: "nombreConfirma", label: "Quién confirma el servicio", tipo: "text" },
    { key: "terminoServicio", label: "Termino de servicio", tipo: "datetime" },
    { key: "estatusEntrega", label: "Estatus de entrega", tipo: "select", opciones: OPCIONES_ESTATUS_ENTREGA },
    { key: "motivoDevolucion", label: "Motivo de la devolución", tipo: "text" },
    { key: "noEmbarqueDevolucion", label: "No. embarque devolución", tipo: "text" },
    { key: "arriboPatioFinal", label: "Arribo a patio", tipo: "datetime" },
    { key: "estatusZebra", label: "Estatus uso de Zebra", tipo: "text" },
    { key: "estatusRControl", label: "Estatus R. Control", tipo: "text" },
    { key: "liberacionServicio", label: "Liberación del servicio", tipo: "datetime" },
    { key: "facturaEntregaFinalizada", label: "Factura y entrega finalizada", tipo: "datetime" },
  ];
}
