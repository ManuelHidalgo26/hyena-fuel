import "server-only";

const PRODUCTION_FALLBACK_URL = "https://www.hyenafuel.com";
const LOCAL_URL = "http://localhost:3000";

export type SiteUrls = {
  /** URL pública base de la tienda, sin barra final. */
  baseUrl: string;
  /**
   * Query extra (`&x-vercel-protection-bypass=...`) para la `notification_url` en Preview:
   * esos deployments tienen Deployment Protection y sin el bypass Mercado Pago recibiría 401.
   * Vacío en producción y local.
   */
  webhookBypassQuery: string;
};

type SiteEnv = Partial<Record<string, string | undefined>>;

/** URL base de la tienda según el entorno de Vercel (producción, preview por rama o local). */
export function getSiteUrls(env: SiteEnv = process.env): SiteUrls {
  if (env.VERCEL_ENV === "production") {
    return { baseUrl: stripTrailingSlash(env.NEXT_PUBLIC_SITE_URL || PRODUCTION_FALLBACK_URL), webhookBypassQuery: "" };
  }

  const previewHost = env.VERCEL_BRANCH_URL || env.VERCEL_URL;
  if (env.VERCEL_ENV === "preview" && previewHost) {
    const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
    return {
      baseUrl: `https://${previewHost}`,
      webhookBypassQuery: bypassSecret ? `&x-vercel-protection-bypass=${encodeURIComponent(bypassSecret)}` : "",
    };
  }

  return { baseUrl: LOCAL_URL, webhookBypassQuery: "" };
}

function stripTrailingSlash(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
