import type { NextConfig } from "next";

/**
 * Security headers básicos (QA-5, severidad MEDIA), aplicados a todo el sitio.
 *
 * CSP queda fuera a propósito: el sitio ya integra scripts/estilos de terceros
 * (GA4, Meta Pixel, MercadoPago, fuentes) y una política mal calibrada rompe
 * el sitio en vez de protegerlo. Definir una CSP correcta es tarea futura
 * (ver docs/TASKS.md).
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * Slugs viejos con guiones dobles o al final (generados por el slugify anterior
 * del panel) → slug normalizado. 301 para no perder links compartidos ni SEO.
 */
const legacyProductSlugs: Record<string, string> = {
  "combo-dupla-clasica-": "combo-dupla-clasica",
  "combo-hipertrofia-": "combo-hipertrofia",
  "proteina-classic-whey-protein-2-lbs-doypack---one-fit-nutrition":
    "proteina-classic-whey-protein-2-lbs-doypack-one-fit-nutrition",
  "pancake-proteicos-salado-sabor-queso-300-gr--granger": "pancake-proteicos-salado-sabor-queso-300-gr-granger",
  "citrato-de-magnesio-150-gr---one-fit-nutrition": "citrato-de-magnesio-150-gr-one-fit-nutrition",
  "creatina-pura-micronizada-doypack-300-gr---xbody-evolution":
    "creatina-pura-micronizada-doypack-300-gr-xbody-evolution",
  "creatina-saborizada-doypack-300-gr---star-nutrition": "creatina-saborizada-doypack-300-gr-star-nutrition",
};

const nextConfig: NextConfig = {
  images: {
    // avif primero: suele pesar 20-30% menos que webp en fotos (perf-audit
    // §3 fix #7). Next intenta avif y cae a webp si el navegador no lo
    // soporta (Accept header), sin romper nada.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vjjxrrsnbmmkijobrzgi.supabase.co",
        pathname: "/storage/v1/object/public/product-images/**",
      },
    ],
  },
  async redirects() {
    return Object.entries(legacyProductSlugs).map(([from, to]) => ({
      source: `/producto/${from}`,
      destination: `/producto/${to}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
