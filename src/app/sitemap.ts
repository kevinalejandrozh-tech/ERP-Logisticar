import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_SITE_URL || "https://erp.transporteslogisticar.com.mx";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${BASE}/sitio`, changeFrequency: "weekly", priority: 1 }];
}
