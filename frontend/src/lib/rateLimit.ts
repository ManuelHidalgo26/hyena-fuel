import "server-only";

/**
 * Rate-limit MÍNIMO en memoria por clave (piso, spec códigos de descuento §9 / QA-4).
 *
 * Deuda conocida y documentada a propósito: vive en la memoria del proceso, así que no
 * comparte estado entre instancias serverless ni sobrevive a un reinicio/cold start. Es un
 * piso defensivo contra enumeración casual, no una solución robusta — si el tráfico lo
 * justifica, migrar a un backend compartido (Upstash/Vercel Firewall).
 */
type Bucket = {
  count: number;
  windowStartedAt: number;
};

const buckets = new Map<string, Bucket>();

/** Techo de claves rastreadas antes de forzar una limpieza de ventanas vencidas. */
const MAX_TRACKED_KEYS = 5000;

/**
 * `true` si `key` superó `maxRequests` dentro de `windowMs` (ventana fija, se reinicia al
 * expirar). Cada llamada cuenta como un intento.
 */
export function isRateLimited(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    pruneExpiredBuckets(now, windowMs);
  }

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > maxRequests;
}

function pruneExpiredBuckets(now: number, windowMs: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * IP del cliente. `x-forwarded-for` lo arma el cliente si el proxy solo agrega hops, así que su
 * primer valor es spoofeable. Orden de confianza: `x-vercel-forwarded-for` (lo fija la edge de
 * Vercel y pisa lo que mande el cliente), `x-real-ip` y, en último término, el ÚLTIMO hop de
 * `x-forwarded-for` (el que agregó el proxy más cercano). Sin ningún header: "unknown".
 */
export function getClientIp(request: Request): string {
  const vercelForwardedFor = request.headers.get("x-vercel-forwarded-for")?.split(",")[0].trim();
  if (vercelForwardedFor) return vercelForwardedFor;

  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const lastHop = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return lastHop || "unknown";
}
