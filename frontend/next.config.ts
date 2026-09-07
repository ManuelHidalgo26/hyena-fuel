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

const nextConfig: NextConfig = {
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
