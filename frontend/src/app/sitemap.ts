import { MetadataRoute } from "next";
import { getProductSitemapEntries } from "../lib/api/products.api";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hyenafuel.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: { slug: string; updatedAt: string }[] = [];

  try {
    products = await getProductSitemapEntries();
  } catch {
    // no-op — el sitemap sigue incluyendo solo las páginas estáticas
  }

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
