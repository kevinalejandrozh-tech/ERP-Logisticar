import type { Metadata } from "next";
import { getPool } from "@/lib/db";
import { ensureSitioSchema } from "@/lib/sitioDB";
import { normalizarContenido, SITIO_DEFAULT, SitioContenido } from "@/lib/sitioData";
import SitioWeb from "@/components/sitio/SitioWeb";
import { SITIO_DESCRIPCION, SITIO_PALABRAS_CLAVE, SITIO_TITULO, datosEstructuradosSitio } from "@/lib/sitioSeo";
import "./sitio.css";

// Sitio web público de la empresa. Siempre muestra el contenido más reciente guardado desde el modo edición.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: { absolute: SITIO_TITULO },
  description: SITIO_DESCRIPCION,
  keywords: SITIO_PALABRAS_CLAVE,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: "/sitio" },
  openGraph: {
    title: SITIO_TITULO,
    description: SITIO_DESCRIPCION,
    url: "/sitio",
    siteName: "Transportes Logisticar",
    locale: "es_MX",
    type: "website",
    images: [{ url: "/sitio/opengraph-image", width: 1200, height: 630, alt: "Transportes Logisticar — transporte de carga terrestre" }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITIO_TITULO,
    description: SITIO_DESCRIPCION,
    images: ["/sitio/opengraph-image"],
  },
};

async function leerContenido(): Promise<SitioContenido> {
  try {
    await ensureSitioSchema();
    const r = await getPool().query(`SELECT contenido FROM sitio_contenido WHERE id = 1`);
    return normalizarContenido(r.rows[0]?.contenido);
  } catch (err) {
    console.error("No se pudo leer el contenido del sitio; se muestran los textos iniciales.", err);
    return SITIO_DEFAULT;
  }
}

export default async function SitioPage() {
  const contenido = await leerContenido();
  // Datos estructurados (JSON-LD) para que Google entienda quién es la empresa y qué ofrece.
  const jsonLd = JSON.stringify(datosEstructuradosSitio(contenido)).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SitioWeb inicial={contenido} />
    </>
  );
}
