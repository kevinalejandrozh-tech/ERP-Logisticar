import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.transporteslogisticar.com.mx";

// Los buscadores solo pueden rastrear el sitio web público; el ERP queda fuera.
// Se permiten también los recursos que la página necesita para dibujarse (JS/CSS de Next e imágenes),
// porque Google renderiza la página y, si los recursos están bloqueados, la evalúa mal.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: [
        "/$",
        "/sitio",
        "/sitio-web/",
        "/api/sitio/imagen",
        "/_next/static/",
        "/_next/image",
        "/logo-completo.png",
        "/fondo-logisticar.jpg",
        "/favicon.ico",
        "/icon",
        "/apple-icon",
      ],
      disallow: ["/"],
    },
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
