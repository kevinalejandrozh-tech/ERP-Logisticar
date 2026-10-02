// Contenido editable del sitio web público (/sitio).
// Todo el sitio se guarda como un solo documento JSON (tabla sitio_contenido).
// La forma de este objeto por defecto es la "plantilla": al guardar, el servidor solo acepta
// las llaves que existen aquí (ver normalizarContenido), así el documento nunca se corrompe.

export type Diapositiva = { subtitulo: string; titulo: string; boton: string; imagen: string };
export type Tarjeta = { imagen: string; titulo: string; texto: string };
export type Servicio = { imagen: string; encabezado: string; parrafo1: string; parrafo2: string };
export type Testimonio = { texto: string; nombre: string; puesto: string; foto: string };
export type Razon = { imagen: string; texto: string };

export type SitioContenido = {
  contacto: {
    telefono: string;
    correo: string;
    direccion: string;
    etiquetaDireccion: string;
    etiquetaTelefono: string;
    etiquetaCorreo: string;
  };
  redes: { facebook: string; instagram: string; linkedin: string; whatsapp: string };
  menu: { inicio: string; soluciones: string; servicios: string; testimonios: string; porque: string; contacto: string };
  hero: { diapositivas: Diapositiva[] };
  soluciones: { titulo: string; tarjetas: Tarjeta[]; boton: string };
  servicios: { titulo: string; subtitulo: string; items: Servicio[]; boton: string };
  testimonios: { titulo: string; items: Testimonio[] };
  boletin: { titulo: string; texto: string; placeholder: string; boton: string; exito: string };
  porque: { titulo: string; items: Razon[]; boton: string };
  pie: { copyright: string; volverArriba: string };
};

export const SITIO_DEFAULT: SitioContenido = {
  contacto: {
    telefono: "55 0000 0000",
    correo: "contacto@transporteslogisticar.com",
    direccion: "Escribe aquí la dirección de la empresa",
    etiquetaDireccion: "Oficinas",
    etiquetaTelefono: "Atención a clientes",
    etiquetaCorreo: "Correo",
  },
  redes: { facebook: "", instagram: "", linkedin: "", whatsapp: "" },
  menu: {
    inicio: "Inicio",
    soluciones: "Soluciones",
    servicios: "Servicios",
    testimonios: "Testimonios",
    porque: "¿Por qué elegirnos?",
    contacto: "Contacto",
  },
  hero: {
    diapositivas: [
      {
        subtitulo: "Transporte de carga terrestre",
        titulo: "Tu mercancía llega a tiempo, en todo el país",
        boton: "Conoce nuestras soluciones",
        imagen: "/sitio-web/hero-1.jpg",
      },
      {
        subtitulo: "Rutas Guadalajara, Monterrey y Chihuahua",
        titulo: "Salidas programadas y seguimiento en cada kilómetro",
        boton: "Ver servicios",
        imagen: "/sitio-web/hero-2.jpg",
      },
      {
        subtitulo: "Monitoreo GPS",
        titulo: "Sabes dónde está tu carga en todo momento",
        boton: "Solicitar cotización",
        imagen: "/sitio-web/hero-3.jpg",
      },
    ],
  },
  soluciones: {
    titulo: "Nuestras soluciones",
    tarjetas: [
      {
        imagen: "/sitio-web/icono-carga.svg",
        titulo: "Carga completa",
        texto: "Una unidad dedicada a tu embarque, del andén de origen al de destino, sin transbordos.",
      },
      {
        imagen: "/sitio-web/icono-rutas.svg",
        titulo: "Rutas nacionales",
        texto: "Cobertura regular hacia Guadalajara, Monterrey y Chihuahua con salidas programadas.",
      },
      {
        imagen: "/sitio-web/icono-gps.svg",
        titulo: "Monitoreo GPS",
        texto: "Seguimiento satelital de cada unidad y reportes de posición durante todo el trayecto.",
      },
      {
        imagen: "/sitio-web/icono-taller.svg",
        titulo: "Mantenimiento propio",
        texto: "Taller y programa de mantenimiento preventivo para mantener la flota en ruta.",
      },
    ],
    boton: "Solicitar cotización",
  },
  servicios: {
    titulo: "Nuestros servicios",
    subtitulo: "¿En qué más podemos ayudarte?",
    items: [
      {
        imagen: "/sitio-web/servicio-1.jpg",
        encabezado: "Logística a la medida de tu operación",
        parrafo1: "Planeamos cada embarque según tus horarios de carga y descarga, el volumen y el destino.",
        parrafo2: "Asignamos unidad y operador con anticipación para que sepas quién mueve tu mercancía y cuándo llega.",
      },
      {
        imagen: "/sitio-web/servicio-2.jpg",
        encabezado: "Operadores capacitados y evaluados",
        parrafo1: "Nuestros operadores reciben capacitación continua en manejo defensivo y procedimientos de seguridad.",
        parrafo2: "Cada operador tiene un expediente con sus evaluaciones y su historial de desempeño.",
      },
      {
        imagen: "/sitio-web/servicio-3.jpg",
        encabezado: "Flota revisada antes de cada viaje",
        parrafo1: "Cada unidad pasa una revisión física y mecánica diaria antes de salir a ruta.",
        parrafo2: "Llevamos el control de mantenimientos, cambios de aceite y llantas de toda la flota.",
      },
    ],
    boton: "Contáctanos",
  },
  testimonios: {
    titulo: "Testimonios",
    items: [
      {
        texto: "Escribe aquí la opinión de un cliente sobre el servicio. Puedes cambiar este texto, el nombre y la foto desde el modo edición.",
        nombre: "Nombre del cliente",
        puesto: "Cargo, empresa",
        foto: "/sitio-web/avatar.svg",
      },
      {
        texto: "Escribe aquí la opinión de un segundo cliente. Un comentario breve y concreto funciona mejor.",
        nombre: "Nombre del cliente",
        puesto: "Cargo, empresa",
        foto: "/sitio-web/avatar.svg",
      },
      {
        texto: "Escribe aquí la opinión de un tercer cliente.",
        nombre: "Nombre del cliente",
        puesto: "Cargo, empresa",
        foto: "/sitio-web/avatar.svg",
      },
    ],
  },
  boletin: {
    titulo: "Boletín",
    texto: "Recibe avisos de nuevas rutas, horarios de salida y noticias de Transportes Logisticar.",
    placeholder: "Tu correo electrónico",
    boton: "Suscribirme",
    exito: "Listo, quedaste suscrito.",
  },
  porque: {
    titulo: "¿Por qué elegirnos?",
    items: [
      { imagen: "/sitio-web/porque-1.jpg", texto: "Cumplimos horarios de entrega gracias a la planeación diaria de cargas y unidades." },
      { imagen: "/sitio-web/porque-2.jpg", texto: "Cada unidad pasa una revisión mecánica antes de salir a ruta." },
      { imagen: "/sitio-web/porque-3.jpg", texto: "Tu carga está monitoreada durante todo el viaje." },
    ],
    boton: "Solicitar cotización",
  },
  pie: {
    copyright: "© 2026 Transportes Logisticar. Todos los derechos reservados.",
    volverArriba: "Volver arriba",
  },
};

// Campos que guardan una imagen (el resto son textos o enlaces).
const CAMPOS_IMAGEN = new Set(["imagen", "foto"]);
// Rutas de imagen permitidas: imágenes subidas al sistema o archivos propios del sitio.
const RE_IMAGEN = /^\/(api\/sitio\/imagen\?id=\d{1,10}|sitio-web\/[\w.-]{1,60}|fondo-logisticar\.jpg)$/;
const RE_URL_RED = /^https:\/\/[^\s"'<>]{3,300}$/;
const MAX_TEXTO = 800;

// Recorre la plantilla y toma del objeto recibido solo los valores válidos.
// Lo que falte o no sea válido se queda con el valor por defecto.
function normalizar(plantilla: unknown, valor: unknown, llave: string, seccion: string): unknown {
  if (Array.isArray(plantilla)) {
    const arr = Array.isArray(valor) ? valor : [];
    return plantilla.map((p, i) => normalizar(p, arr[i], llave, seccion));
  }
  if (plantilla && typeof plantilla === "object") {
    const obj = valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
    const salida: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(plantilla as Record<string, unknown>)) {
      salida[k] = normalizar(p, obj[k], k, seccion || k);
    }
    return salida;
  }
  if (typeof valor !== "string") return plantilla;
  const texto = valor.trim();
  if (CAMPOS_IMAGEN.has(llave)) return RE_IMAGEN.test(texto) ? texto : plantilla;
  if (seccion === "redes") return texto === "" || RE_URL_RED.test(texto) ? texto : plantilla;
  return texto.slice(0, MAX_TEXTO);
}

export function normalizarContenido(valor: unknown): SitioContenido {
  return normalizar(SITIO_DEFAULT, valor, "", "") as SitioContenido;
}

// Ids de imágenes subidas que el contenido sigue usando (para limpiar las que ya no se usan).
export function idsImagenesUsadas(contenido: SitioContenido): number[] {
  const ids = new Set<number>();
  const json = JSON.stringify(contenido);
  for (const m of json.matchAll(/\/api\/sitio\/imagen\?id=(\d+)/g)) ids.add(Number(m[1]));
  return [...ids];
}

// Lectura/escritura por ruta, p. ej. ["hero", "diapositivas", 0, "titulo"].
export type RutaCampo = (string | number)[];

export function leerCampo(obj: unknown, ruta: RutaCampo): string {
  let actual: unknown = obj;
  for (const parte of ruta) {
    if (actual == null || typeof actual !== "object") return "";
    actual = (actual as Record<string | number, unknown>)[parte];
  }
  return typeof actual === "string" ? actual : "";
}

export function escribirCampo<T>(obj: T, ruta: RutaCampo, valor: string): T {
  if (ruta.length === 0) return obj;
  const [cabeza, ...resto] = ruta;
  const copia = (Array.isArray(obj) ? [...obj] : { ...(obj as object) }) as Record<string | number, unknown>;
  copia[cabeza] = resto.length === 0 ? valor : escribirCampo(copia[cabeza], resto, valor);
  return copia as T;
}
