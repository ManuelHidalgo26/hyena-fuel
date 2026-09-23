import { MetadataRoute } from "next";
import { getProductSitemapEntries } from "../lib/api/products.api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.hyenafuel.com";

// ISR (ADR 0009 D2): sin `try/catch` alrededor de la lectura — si Supabase
// falla, que falle la regeneración: ISR sigue sirviendo la última versión
// buena. Tragarse el error cachearía 5 min un sitemap sin productos.
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getProductSitemapEntries();

  const productUrls = products.map((p) => ({
    url: `${SITE_URL}/producto/${p.slug}`,
    lastModified: new Date(p.updatedAt),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/como-comprar`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    ...productUrls,
  ];
}
