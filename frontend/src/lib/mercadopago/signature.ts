import { createHmac, timingSafeEqual } from "node:crypto";

/** Ventana en la que aceptamos el `ts` de la firma (defensa en profundidad contra replays). */
export const SIGNATURE_TOLERANCE_MS = 15 * 60 * 1000;

/** Un `ts` mayor a esto está en milisegundos; si no, en segundos. */
const MILLISECONDS_TIMESTAMP_THRESHOLD = 1e12;

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const TIMESTAMP_PATTERN = /^\d{1,16}$/;

export type WebhookSignatureInput = {
  /** Header `x-signature` crudo: `ts=<ts>,v1=<hex>`. */
  signatureHeader: string | null;
  /** Header `x-request-id`. */
  requestId: string | null;
  /** `data.id` de la notificación (query `data.id`). */
  dataId: string | null;
  /** Clave secreta de Webhooks (`MP_WEBHOOK_SECRET`). */
  secret: string;
  /** Instante de referencia en ms (inyectable para tests). */
  nowMs?: number;
};

type ParsedSignature = { ts: string; v1: string };

function parseSignatureHeader(header: string | null): ParsedSignature | null {
  if (!header) return null;

  const parts = new Map<string, string>();
  for (const part of header.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;
    parts.set(part.slice(0, separatorIndex).trim(), part.slice(separatorIndex + 1).trim());
  }

  const ts = parts.get("ts");
  const v1 = parts.get("v1");
  if (!ts || !v1) return null;

  return { ts, v1 };
}

/** Manifest firmado por Mercado Pago. Las partes cuyo valor falta se omiten, como indica su doc. */
function buildManifest(dataId: string | null, requestId: string | null, ts: string): string {
  const idPart = dataId ? `id:${dataId.toLowerCase()};` : "";
  const requestIdPart = requestId ? `request-id:${requestId};` : "";
  return `${idPart}${requestIdPart}ts:${ts};`;
}

function isWithinTolerance(ts: string, nowMs: number): boolean {
  if (!TIMESTAMP_PATTERN.test(ts)) return false;

  const value = Number(ts);
  const tsMs = value > MILLISECONDS_TIMESTAMP_THRESHOLD ? value : value * 1000;
  return Math.abs(nowMs - tsMs) <= SIGNATURE_TOLERANCE_MS;
}

/**
 * Valida el `x-signature` de un webhook de Mercado Pago: HMAC-SHA256 del manifest con la
 * clave secreta, comparado en tiempo constante, y `ts` dentro de la tolerancia. Cualquier
 * header mal formado devuelve `false` (nunca lanza).
 */
export function verifyWebhookSignature(input: WebhookSignatureInput): boolean {
  const parsed = parseSignatureHeader(input.signatureHeader);
  if (!parsed || !SHA256_HEX_PATTERN.test(parsed.v1)) return false;
  if (!isWithinTolerance(parsed.ts, input.nowMs ?? Date.now())) return false;

  const expected = createHmac("sha256", input.secret)
    .update(buildManifest(input.dataId, input.requestId, parsed.ts))
    .digest();

  return timingSafeEqual(expected, Buffer.from(parsed.v1, "hex"));
}
