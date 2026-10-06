import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.transporteslogisticar.com.mx";

// Los buscadores solo pueden rastrear el sitio web público; el ERP queda fuera.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/$", "/sitio"], disallow: ["/"] },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
