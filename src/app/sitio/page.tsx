import type { Metadata } from "next";
import { getPool } from "@/lib/db";
import { ensureSitioSchema } from "@/lib/sitioDB";
import { normalizarContenido, SITIO_DEFAULT, SitioContenido } from "@/lib/sitioData";
import SitioWeb from "@/components/sitio/SitioWeb";
import "./sitio.css";

// Sitio web público de la empresa. Siempre muestra el contenido más reciente guardado desde el modo edición.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Transportes Logisticar | Transporte de carga terrestre",
  description: "Transporte de carga terrestre con rutas nacionales, monitoreo GPS y flota con mantenimiento propio.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/sitio" },
  openGraph: {
    title: "Transportes Logisticar | Transporte de carga terrestre",
    description: "Transporte de carga terrestre con rutas nacionales, monitoreo GPS y flota con mantenimiento propio.",
    url: "/sitio",
    siteName: "Transportes Logisticar",
    locale: "es_MX",
    type: "website",
    images: ["/logo-completo.png"],
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
  return <SitioWeb inicial={await leerContenido()} />;
}
