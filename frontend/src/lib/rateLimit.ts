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
 * IP del cliente a partir de los headers que reenvía el proxy de Vercel. `NextRequest` ya
 * no expone `.ip` (removido en Next 15+); en su defecto, "unknown" agrupa a todos los
 * clientes sin header reenviado bajo la misma clave (peor que nada, pero no rompe).
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  return request.headers.get("x-real-ip") ?? "unknown";
}
