// SEO del sitio web público (/sitio): textos para buscadores y datos estructurados (JSON-LD).
// Las palabras clave salen del propio contenido del sitio (soluciones, rutas, servicios).
import type { SitioContenido } from "./sitioData";
import { SITIO_DEFAULT } from "./sitioData";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.transporteslogisticar.com.mx";

export const SITIO_TITULO = "Transportes Logisticar | Transporte de carga terrestre en México";

// Máx. ~160 caracteres para que Google no la corte.
export const SITIO_DESCRIPCION =
  "Transporte de carga terrestre en México: carga completa y rutas a Guadalajara, Monterrey y Chihuahua con monitoreo GPS y flota con mantenimiento propio.";

export const SITIO_PALABRAS_CLAVE = [
  "transportes logisticar",
  "transporte de carga terrestre",
  "transporte de carga en México",
  "fletes en México",
  "carga completa",
  "transporte de carga completa",
  "rutas nacionales de carga",
  "transporte de carga a Guadalajara",
  "transporte de carga a Monterrey",
  "transporte de carga a Chihuahua",
  "fletes Guadalajara Monterrey Chihuahua",
  "monitoreo GPS de unidades",
  "monitoreo satelital de carga",
  "empresa de transporte de carga",
  "logística y distribución",
  "cotización de fletes",
  "flota con mantenimiento preventivo",
  "operadores capacitados",
];

// Un dato se publica solo si ya lo capturaron en el modo edición (no el texto de ejemplo).
const esReal = (valor: string, ejemplo: string) => valor.trim() !== "" && valor.trim() !== ejemplo;

export function datosEstructuradosSitio(c: SitioContenido) {
  const d = SITIO_DEFAULT.contacto;
  const sameAs = [...new Set([c.redes.facebook, c.redes.instagram, c.redes.linkedin, c.accesos.facebook].filter(Boolean))];

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${BASE}/sitio#empresa`,
    name: "Transportes Logisticar",
    url: `${BASE}/sitio`,
    logo: `${BASE}/logo-completo.png`,
    image: `${BASE}/sitio/opengraph-image`,
    description: SITIO_DESCRIPCION,
    knowsAbout: ["Transporte de carga terrestre", "Carga completa", "Monitoreo GPS", "Mantenimiento de flota"],
    areaServed: [
      { "@type": "Country", name: "México" },
      { "@type": "City", name: "Guadalajara" },
      { "@type": "City", name: "Monterrey" },
      { "@type": "City", name: "Chihuahua" },
    ],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: c.soluciones.titulo,
      itemListElement: c.soluciones.tarjetas.map((t) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: t.titulo, description: t.texto, provider: { "@id": `${BASE}/sitio#empresa` } },
      })),
    },
  };

  const telefonos = [c.contacto.telefono, ...c.contacto.telefonosExtra].filter((t) => esReal(t, d.telefono));
  if (telefonos.length) ld.telephone = telefonos.length === 1 ? telefonos[0] : telefonos;
  if (esReal(c.contacto.correo, d.correo)) ld.email = c.contacto.correo;
  if (esReal(c.contacto.direccion, d.direccion)) {
    ld.address = { "@type": "PostalAddress", streetAddress: c.contacto.direccion, addressCountry: "MX" };
  }
  if (c.accesos.maps) ld.hasMap = c.accesos.maps;
  if (sameAs.length) ld.sameAs = sameAs;
  return ld;
}
