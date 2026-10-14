import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Ventana en la que aceptamos el `ts` de la firma. Mercado Pago reintenta a los 15 min, 30 min,
 * 6 h, 48 h y 96 h, posiblemente con el `ts` original, así que la ventana cubre ese plazo. Un
 * replay es inofensivo: el handler re-consulta el pago a la API y la RPC es idempotente.
 */
export const SIGNATURE_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000;

/** Una firma más vieja que esto es un reintento tardío: se acepta, pero se deja un log. */
const STALE_SIGNATURE_LOG_MS = 15 * 60 * 1000;

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
  const ageMs = Math.abs(nowMs - tsMs);
  if (ageMs > SIGNATURE_TOLERANCE_MS) return false;

  if (ageMs > STALE_SIGNATURE_LOG_MS) {
    console.warn("[webhook mercadopago] firma con ts viejo (reintento tardío)", { ageMinutes: Math.round(ageMs / 60000) });
  }
  return true;
}

export type SignatureFailureReason = "header_ausente_o_mal_formado" | "ts_fuera_de_ventana" | "hmac_no_coincide";

/** Resultado de validar la firma. En fallo trae lo necesario para diagnosticar sin exponer el secreto. */
export type SignatureCheck =
  | { isValid: true }
  | { isValid: false; reason: SignatureFailureReason; manifest: string | null; receivedV1Prefix: string | null };

const V1_PREFIX_LENGTH = 6;

/**
 * Valida el `x-signature` de un webhook de Mercado Pago: HMAC-SHA256 del manifest con la
 * clave secreta, comparado en tiempo constante, y `ts` dentro de la tolerancia. Cualquier
 * header mal formado devuelve un fallo (nunca lanza).
 */
export function checkWebhookSignature(input: WebhookSignatureInput): SignatureCheck {
  const parsed = parseSignatureHeader(input.signatureHeader);
  if (!parsed || !SHA256_HEX_PATTERN.test(parsed.v1)) {
    return { isValid: false, reason: "header_ausente_o_mal_formado", manifest: null, receivedV1Prefix: null };
  }

  const manifest = buildManifest(input.dataId, input.requestId, parsed.ts);
  const receivedV1Prefix = parsed.v1.slice(0, V1_PREFIX_LENGTH);
  if (!isWithinTolerance(parsed.ts, input.nowMs ?? Date.now())) {
    return { isValid: false, reason: "ts_fuera_de_ventana", manifest, receivedV1Prefix };
  }

  const expected = createHmac("sha256", input.secret).update(manifest).digest();
  if (!timingSafeEqual(expected, Buffer.from(parsed.v1, "hex"))) {
    return { isValid: false, reason: "hmac_no_coincide", manifest, receivedV1Prefix };
  }
  return { isValid: true };
}

export function verifyWebhookSignature(input: WebhookSignatureInput): boolean {
  return checkWebhookSignature(input).isValid;
}

/** `ts` del header `x-signature` tal cual viene (solo para diagnóstico), o null si no se puede leer. */
export function readSignatureTimestamp(header: string | null): string | null {
  return parseSignatureHeader(header)?.ts ?? null;
}
