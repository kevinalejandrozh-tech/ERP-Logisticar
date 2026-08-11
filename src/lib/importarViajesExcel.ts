import { ESTADOS_MEXICO } from "./monitoreoData";

function normalizarTexto(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

const MAPEO_COLUMNAS: Record<string, string> = {
  DIA: "dia",
  "CARGA PLANEADA X CLIENTE": "cargaPlaneadaCliente",
  "CARGA PLANEADA X LOGISTICAR": "citaCargaPatio",
  "INICIO DE RUTA PROGRAMADO": "inicioRutaProgramado",
  "HORARIO DE CITA DE ENTREGA": "horarioCitaEntrega",
  "NOMBRE CUENTA": "nombreCuenta",
  "PROYECTO DELL": "proyectoDell",
  "NO EMBARQUE": "noEmbarque",
  "CARTA PORTE": "cartaPorte",
  "ESTADO DESTINO": "estadoDestino",
  "RUTA O DESTINO": "rutaDestino",
  "N DE CAJAS": "noCajas",
  "TIPO MERCANCIA": "tipoMercancia",
  TIROS: "tiros",
  "TIPO DE SERVICIO": "tipoServicio",
  TIPO: "tipoUnidad",
  ECO: "ecoUnidad",
  OPERADOR: "operador",
  "HORARIO ARRIBO PATIO": "horaArriboPatio",
  "ARRIBO ALMACEN CARGA": "arriboAlmacenCarga",
  "INICIO DE RUTA": "inicioRuta",
  "ARRIBO A PATIO AYUDANTE": "arriboPatioAyudante",
  AYUDANTE: "ayudante",
  "NOMBRE QUIEN CONFIRMA SERVICIO": "nombreConfirma",
  "TERMINO DE SERVICIO": "terminoServicio",
  ESTATUS: "estatusEntrega",
  "NUMERO DE EMBARQUE DE LA DEVOLUCION": "noEmbarqueDevolucion",
  "ARRIBO A PATIOO": "arriboPatioFinal",
  "ARRIBO A PATIO": "arriboPatioFinal",
  "ESTATUS USO DE ZEBRAXX": "estatusZebra",
  "FECHA DE LIBERACION DEL SERVICIO": "liberacionServicio",
};

const CAMPOS_FECHA = new Set([
  "cargaPlaneadaCliente", "citaCargaPatio", "inicioRutaProgramado", "horarioCitaEntrega",
  "horaArriboPatio", "arriboAlmacenCarga", "inicioRuta", "arriboPatioAyudante", "terminoServicio",
  "arriboPatioFinal", "liberacionServicio", "facturaEntregaFinalizada",
]);

const MAPA_DIAS: Record<string, string> = {
  LUNES: "Lunes", MARTES: "Martes", MIERCOLES: "Miércoles", JUEVES: "Jueves",
  VIERNES: "Viernes", SABADO: "Sábado", DOMINGO: "Domingo",
};

const ALIAS_ESTADO: Record<string, string> = {
  "CIUDAD DE MEXICO CDMX": "Ciudad de México",
  CDMX: "Ciudad de México",
  "ESTADO DE MEXICO": "Estado de México",
};

const ALIAS_ESTATUS: Record<string, string> = {
  VACIO: "Vacío",
  "DEVOLUCION PARCIAL": "Devolución parcial",
  "DEVOLUCION TOTAL": "Devolución total",
  RECOLECCIONES: "Recolecciones",
};

function mapearEstado(valor: unknown): string {
  const norm = normalizarTexto(valor);
  const directo = ESTADOS_MEXICO.find((e) => normalizarTexto(e) === norm);
  if (directo) return directo;
  if (ALIAS_ESTADO[norm]) return ALIAS_ESTADO[norm];
  return String(valor).trim();
}

function mapearEstatus(valor: unknown): string {
  const norm = normalizarTexto(valor);
  return ALIAS_ESTATUS[norm] || String(valor).trim();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function formatearFechaLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function convertirFecha(valor: unknown): string {
  if (valor instanceof Date && !isNaN(valor.getTime())) return formatearFechaLocal(valor);
  if (typeof valor === "string" && valor.trim()) {
    const d = new Date(valor);
    if (!isNaN(d.getTime())) return formatearFechaLocal(d);
  }
  if (typeof valor === "number") {
    // fecha serial de Excel (por si llega sin cellDates)
    const d = new Date(Math.round((valor - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return formatearFechaLocal(d);
  }
  return "";
}

export type ResultadoImportacion = { viajes: Record<string, string>[]; celdasNoInterpretadas: number };

export function mapearFilasExcel(filas: unknown[][]): ResultadoImportacion {
  let indiceHeader = -1;
  for (let i = 0; i < filas.length; i++) {
    const normalizados = (filas[i] || []).map((c) => normalizarTexto(c));
    if (normalizados.includes("DIA") && normalizados.includes("OPERADOR")) {
      indiceHeader = i;
      break;
    }
  }
  if (indiceHeader === -1) {
    throw new Error("No se encontró la fila de encabezados (se esperaba una columna 'DIA' y 'OPERADOR').");
  }

  const encabezados = (filas[indiceHeader] || []).map((c) => normalizarTexto(c));
  const columnaAClave: (string | null)[] = encabezados.map((h) => MAPEO_COLUMNAS[h] || null);

  const viajes: Record<string, string>[] = [];
  let celdasNoInterpretadas = 0;

  for (let f = indiceHeader + 1; f < filas.length; f++) {
    const fila = filas[f] || [];
    if (fila.every((c) => c === null || c === undefined || c === "")) continue;
    const viaje: Record<string, string> = {};
    let tieneAlgo = false;
    columnaAClave.forEach((clave, idx) => {
      if (!clave) return;
      const valorCrudo = fila[idx];
      if (valorCrudo === null || valorCrudo === undefined || valorCrudo === "") return;
      tieneAlgo = true;
      if (clave === "dia") {
        viaje.dia = MAPA_DIAS[normalizarTexto(valorCrudo)] || String(valorCrudo).trim();
      } else if (clave === "estadoDestino") {
        viaje.estadoDestino = mapearEstado(valorCrudo);
      } else if (clave === "estatusEntrega") {
        viaje.estatusEntrega = mapearEstatus(valorCrudo);
      } else if (CAMPOS_FECHA.has(clave)) {
        const f2 = convertirFecha(valorCrudo);
        if (f2) viaje[clave] = f2;
        else celdasNoInterpretadas++;
      } else {
        viaje[clave] = String(valorCrudo).trim();
      }
    });
    if (tieneAlgo) viajes.push(viaje);
  }

  return { viajes, celdasNoInterpretadas };
}
