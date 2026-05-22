import { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://hyenafuel.com";
const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: { slug: string; updatedAt?: string }[] = [];

  try {
    const res = await fetch(`${API_URL}/api/products`, { cache: "no-store" });
    if (res.ok) products = await res.json();
  } catch {
    // no-op — sitemap will only include static pages
  }

  const productUrls = products.map((p) => ({
    url: `${SITE_URL}/producto/${p.slug}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
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
