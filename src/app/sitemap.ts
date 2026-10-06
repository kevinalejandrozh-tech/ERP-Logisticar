import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.transporteslogisticar.com.mx";

// Solo el sitio público va en el sitemap. Si se agregan páginas públicas nuevas (p. ej. /sitio/servicios), se añaden aquí.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/sitio`,
      changeFrequency: "weekly",
      priority: 1,
      images: [`${BASE}/logo-completo.png`],
    },
  ];
}
