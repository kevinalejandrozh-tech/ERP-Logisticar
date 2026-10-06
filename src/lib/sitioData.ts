// Contenido editable del sitio web público (/sitio).
// Todo el sitio se guarda como un solo documento JSON (tabla sitio_contenido).
// La forma de este objeto por defecto es la "plantilla": al guardar, el servidor solo acepta
// las llaves que existen aquí (ver normalizarContenido), así el documento nunca se corrompe.

// Cada imagen tiene un campo hermano "<campo>Ajuste" con el encuadre ("zoom,x,y"; vacío = centrada y sin zoom).
export type Diapositiva = { subtitulo: string; titulo: string; boton: string; imagen: string; imagenAjuste: string };
export type Tarjeta = { imagen: string; imagenAjuste: string; titulo: string; texto: string };
export type Servicio = { imagen: string; imagenAjuste: string; encabezado: string; parrafo1: string; parrafo2: string };
export type Testimonio = { texto: string; nombre: string; puesto: string; foto: string; fotoAjuste: string };
export type Razon = { imagen: string; imagenAjuste: string; texto: string };

export type SitioContenido = {
  contacto: {
    telefono: string;
    correo: string;
    direccion: string;
    etiquetaDireccion: string;
    etiquetaTelefono: string;
    etiquetaCorreo: string;
    // Teléfonos adicionales (el principal es "telefono"). Los vacíos se descartan al guardar.
    telefonosExtra: string[];
  };
  redes: { facebook: string; instagram: string; linkedin: string; whatsapp: string };
  // Accesos rápidos junto al teléfono (íconos de Facebook y Google Maps). Solo el sysadmin los edita.
  accesos: { facebook: string; maps: string };
  menu: { inicio: string; soluciones: string; servicios: string; testimonios: string; porque: string; contacto: string };
  // intervalo: segundos entre diapositivas de la portada.
  hero: { diapositivas: Diapositiva[]; intervalo: string };
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
    telefonosExtra: [],
  },
  redes: { facebook: "", instagram: "", linkedin: "", whatsapp: "" },
  accesos: {
    facebook: "https://www.facebook.com/share/1F1FGgEhmB/?mibextid=wwXIfr",
    maps: "https://maps.app.goo.gl/16yFA652d4wV7P6D7",
  },
  menu: {
    inicio: "Inicio",
    soluciones: "Soluciones",
    servicios: "Servicios",
    testimonios: "Testimonios",
    porque: "¿Por qué elegirnos?",
    contacto: "Contacto",
  },
  hero: {
    intervalo: "7",
    diapositivas: [
      {
        subtitulo: "Transporte de carga terrestre",
        titulo: "Tu mercancía llega a tiempo, en todo el país",
        boton: "Conoce nuestras soluciones",
        imagen: "/sitio-web/hero-1.jpg",
        imagenAjuste: "",
      },
      {
        subtitulo: "Rutas Guadalajara, Monterrey y Chihuahua",
        titulo: "Salidas programadas y seguimiento en cada kilómetro",
        boton: "Ver servicios",
        imagen: "/sitio-web/hero-2.jpg",
        imagenAjuste: "",
      },
      {
        subtitulo: "Monitoreo GPS",
        titulo: "Sabes dónde está tu carga en todo momento",
        boton: "Solicitar cotización",
        imagen: "/sitio-web/hero-3.jpg",
        imagenAjuste: "",
      },
    ],
  },
  soluciones: {
    titulo: "Nuestras soluciones",
    tarjetas: [
      {
        imagen: "/sitio-web/icono-carga.svg",
        imagenAjuste: "",
        titulo: "Carga completa",
        texto: "Una unidad dedicada a tu embarque, del andén de origen al de destino, sin transbordos.",
      },
      {
        imagen: "/sitio-web/icono-rutas.svg",
        imagenAjuste: "",
        titulo: "Rutas nacionales",
        texto: "Cobertura regular hacia Guadalajara, Monterrey y Chihuahua con salidas programadas.",
      },
      {
        imagen: "/sitio-web/icono-gps.svg",
        imagenAjuste: "",
        titulo: "Monitoreo GPS",
        texto: "Seguimiento satelital de cada unidad y reportes de posición durante todo el trayecto.",
      },
      {
        imagen: "/sitio-web/icono-taller.svg",
        imagenAjuste: "",
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
        imagenAjuste: "",
        encabezado: "Logística a la medida de tu operación",
        parrafo1: "Planeamos cada embarque según tus horarios de carga y descarga, el volumen y el destino.",
        parrafo2: "Asignamos unidad y operador con anticipación para que sepas quién mueve tu mercancía y cuándo llega.",
      },
      {
        imagen: "/sitio-web/servicio-2.jpg",
        imagenAjuste: "",
        encabezado: "Operadores capacitados y evaluados",
        parrafo1: "Nuestros operadores reciben capacitación continua en manejo defensivo y procedimientos de seguridad.",
        parrafo2: "Cada operador tiene un expediente con sus evaluaciones y su historial de desempeño.",
      },
      {
        imagen: "/sitio-web/servicio-3.jpg",
        imagenAjuste: "",
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
        fotoAjuste: "",
      },
      {
        texto: "Escribe aquí la opinión de un segundo cliente. Un comentario breve y concreto funciona mejor.",
        nombre: "Nombre del cliente",
        puesto: "Cargo, empresa",
        foto: "/sitio-web/avatar.svg",
        fotoAjuste: "",
      },
      {
        texto: "Escribe aquí la opinión de un tercer cliente.",
        nombre: "Nombre del cliente",
        puesto: "Cargo, empresa",
        foto: "/sitio-web/avatar.svg",
        fotoAjuste: "",
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
      { imagen: "/sitio-web/porque-1.jpg", imagenAjuste: "", texto: "Cumplimos horarios de entrega gracias a la planeación diaria de cargas y unidades." },
      { imagen: "/sitio-web/porque-2.jpg", imagenAjuste: "", texto: "Cada unidad pasa una revisión mecánica antes de salir a ruta." },
      { imagen: "/sitio-web/porque-3.jpg", imagenAjuste: "", texto: "Tu carga está monitoreada durante todo el viaje." },
    ],
    boton: "Solicitar cotización",
  },
  pie: {
    copyright: "© 2026 Transportes Logisticar. Todos los derechos reservados.",
    volverArriba: "Volver arriba",
  },
};

// Plantillas para lo que se agrega desde el modo edición.
export const NUEVA_DIAPOSITIVA: Diapositiva = {
  subtitulo: "Subtítulo de la diapositiva",
  titulo: "Título de la diapositiva",
  boton: "Solicitar cotización",
  imagen: "/sitio-web/hero-1.jpg",
  imagenAjuste: "",
};
export const NUEVO_SERVICIO: Servicio = {
  imagen: "/sitio-web/servicio-1.jpg",
  imagenAjuste: "",
  encabezado: "Nuevo servicio",
  parrafo1: "Describe aquí en qué consiste este servicio.",
  parrafo2: "Agrega aquí un segundo párrafo con más detalle.",
};
export const TELEFONO_NUEVO = "55 0000 0000";

export const LIMITES = {
  diapositivas: 10,
  servicios: 8,
  telefonosExtra: 5,
  intervaloMin: 2,
  intervaloMax: 60,
  intervaloInicial: 7,
};

// Listas cuyo largo puede variar (el resto de las listas tiene el largo fijo de la plantilla).
const LISTAS: Record<string, { min: number; max: number; modelo?: unknown }> = {
  "hero.diapositivas": { min: 1, max: LIMITES.diapositivas },
  "servicios.items": { min: 1, max: LIMITES.servicios },
  "contacto.telefonosExtra": { min: 0, max: LIMITES.telefonosExtra, modelo: "" },
};

// Campos que guardan una imagen (el resto son textos o enlaces).
const CAMPOS_IMAGEN = new Set(["imagen", "foto"]);
// Rutas de imagen permitidas: imágenes subidas al sistema o archivos propios del sitio.
const RE_IMAGEN = /^\/(api\/sitio\/imagen\?id=\d{1,10}|sitio-web\/[\w.-]{1,60}|fondo-logisticar\.jpg)$/;
const RE_URL_RED = /^https:\/\/[^\s"'<>]{3,300}$/;
// Encuadre de una imagen: "zoom,x,y" (zoom 1 a 4; x e y en porcentaje, 0 a 100).
const RE_AJUSTE = /^[1-4](\.\d{1,2})?,\d{1,3}(\.\d{1,2})?,\d{1,3}(\.\d{1,2})?$/;
const MAX_TEXTO = 800;
const MAX_TELEFONO = 40;

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// Recorre la plantilla y toma del objeto recibido solo los valores válidos.
// Lo que falte o no sea válido se queda con el valor por defecto.
function normalizar(plantilla: unknown, valor: unknown, llave: string, seccion: string, ruta = ""): unknown {
  if (Array.isArray(plantilla)) {
    const lista = LISTAS[ruta];
    if (lista) {
      if (!Array.isArray(valor)) return clonar(plantilla);
      const modelo = "modelo" in lista ? lista.modelo : plantilla[0];
      const items = valor.slice(0, lista.max).map((v) => normalizar(modelo, v, llave, seccion, ruta));
      return items.length >= lista.min ? items : clonar(plantilla);
    }
    const arr = Array.isArray(valor) ? valor : [];
    return plantilla.map((p, i) => normalizar(p, arr[i], llave, seccion, ruta));
  }
  if (plantilla && typeof plantilla === "object") {
    const obj = valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
    const salida: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(plantilla as Record<string, unknown>)) {
      salida[k] = normalizar(p, obj[k], k, seccion || k, ruta ? `${ruta}.${k}` : k);
    }
    return salida;
  }
  if (typeof valor !== "string") return plantilla;
  const texto = valor.trim();
  if (CAMPOS_IMAGEN.has(llave)) return RE_IMAGEN.test(texto) ? texto : plantilla;
  if (llave.endsWith("Ajuste")) return texto === "" || RE_AJUSTE.test(texto) ? texto : plantilla;
  if (llave === "intervalo") {
    const n = Number(texto);
    return /^\d{1,2}$/.test(texto) && n >= LIMITES.intervaloMin && n <= LIMITES.intervaloMax ? String(n) : plantilla;
  }
  if (seccion === "redes" || seccion === "accesos") return texto === "" || RE_URL_RED.test(texto) ? texto : plantilla;
  return texto.slice(0, MAX_TEXTO);
}

export function normalizarContenido(valor: unknown): SitioContenido {
  const c = normalizar(SITIO_DEFAULT, valor, "", "") as SitioContenido;
  // Los teléfonos adicionales vacíos se descartan (así se "borran" al dejarlos sin texto).
  c.contacto.telefonosExtra = c.contacto.telefonosExtra.map((t) => t.slice(0, MAX_TELEFONO)).filter((t) => t !== "");
  return c;
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

// ---------- Encuadre de imágenes (zoom y posición, sin modificar el archivo original) ----------
export type Ajuste = { zoom: number; x: number; y: number };
export const AJUSTE_INICIAL: Ajuste = { zoom: 1, x: 50, y: 50 };

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function leerAjuste(texto: string): Ajuste {
  if (!RE_AJUSTE.test(texto)) return { ...AJUSTE_INICIAL };
  const [z, x, y] = texto.split(",").map(Number);
  return { zoom: limitar(z, 1, 4), x: limitar(x, 0, 100), y: limitar(y, 0, 100) };
}

// Vacío cuando la imagen está centrada y sin zoom (el valor por defecto).
export function textoAjuste(a: Ajuste): string {
  const zoom = limitar(a.zoom, 1, 4);
  const x = limitar(a.x, 0, 100);
  const y = limitar(a.y, 0, 100);
  if (zoom <= 1.005 && Math.abs(x - 50) < 0.05 && Math.abs(y - 50) < 0.05) return "";
  return `${zoom.toFixed(2)},${x.toFixed(1)},${y.toFixed(1)}`;
}

// Estilo para un <img> con object-fit: cover que llena su contenedor (el contenedor debe tener overflow-hidden).
// La posición mueve la imagen dentro del marco y el zoom se aplica desde ese mismo punto, así la imagen siempre cubre el marco.
export function estiloDeAjuste(a: Ajuste): { objectPosition: string; transform?: string; transformOrigin?: string } {
  const posicion = `${a.x}% ${a.y}%`;
  if (a.zoom <= 1.005) return { objectPosition: posicion };
  return { objectPosition: posicion, transform: `scale(${a.zoom})`, transformOrigin: posicion };
}

export function estiloAjuste(texto: string) {
  return texto ? estiloDeAjuste(leerAjuste(texto)) : undefined;
}

// Ruta del encuadre que corresponde a una imagen: ["hero","diapositivas",0,"imagen"] -> [..., "imagenAjuste"].
export function rutaAjuste(ruta: RutaCampo): RutaCampo {
  return [...ruta.slice(0, -1), `${ruta[ruta.length - 1]}Ajuste`];
}

export function intervaloSegundos(texto: string): number {
  const n = Number(texto);
  return Number.isFinite(n) && n >= LIMITES.intervaloMin && n <= LIMITES.intervaloMax ? n : LIMITES.intervaloInicial;
}
