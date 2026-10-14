import "server-only";
import { isIP } from "node:net";

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
  /** Ventana del limiter dueño del bucket: la poda de otro limiter no puede evictarlo antes de tiempo. */
  windowMs: number;
  windowStartedAt: number;
};

const buckets = new Map<string, Bucket>();

/** Techo de claves rastreadas antes de forzar una limpieza de ventanas vencidas. */
const MAX_TRACKED_KEYS = 5000;

/**
 * `true` si `key` superó `maxRequests` dentro de `windowMs` (ventana fija, se reinicia al
 * expirar). Cada llamada cuenta como un intento.
 */
export function isRateLimited(
  key: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();

  if (buckets.size > MAX_TRACKED_KEYS) {
    pruneExpiredBuckets(now);
  }

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStartedAt >= windowMs) {
    buckets.set(key, { count: 1, windowMs, windowStartedAt: now });
    return false;
  }

  bucket.count += 1;
  return bucket.count > maxRequests;
}

function pruneExpiredBuckets(now: number): void {
  for (const [key, bucket] of buckets) {
    if (now - bucket.windowStartedAt >= bucket.windowMs) {
      buckets.delete(key);
    }
  }
}

/**
 * IP del cliente, solo desde `x-vercel-forwarded-for`: lo fija la edge de Vercel y pisa lo que
 * mande el cliente. `x-real-ip` y `x-forwarded-for` los puede setear el cliente, así que no se
 * usan. Si falta o no tiene forma de IPv4/IPv6 (nunca se usa texto libre como key) devuelve
 * "unknown", que agrupa a esos clientes bajo una misma clave.
 */
export function getClientIp(request: Request): string {
  const candidate = request.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    .trim();
  return candidate && isIP(candidate) !== 0 ? candidate : "unknown";
}
