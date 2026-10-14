import "server-only";
import { MercadoPagoConfig } from "mercadopago";

/** Tope de cada llamada a la API de Mercado Pago: el checkout y el webhook tienen que responder rápido. */
const MERCADOPAGO_TIMEOUT_MS = 8000;

/**
 * Cliente del SDK oficial, o `null` si falta `MP_ACCESS_TOKEN` (el pago con tarjeta queda
 * deshabilitado: el checkout responde 503 sin crear pedido). Solo server-side.
 */
export function getMercadoPagoClient(): MercadoPagoConfig | null {
  const accessToken = process.env.MP_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;

  return new MercadoPagoConfig({
    accessToken,
    options: { timeout: MERCADOPAGO_TIMEOUT_MS },
  });
}

/** Prefijo de los access token de las credenciales de prueba de Mercado Pago. */
const TEST_ACCESS_TOKEN_PREFIX = "TEST-";

/**
 * `true` si este despliegue no procesa pagos reales: no es producción de Vercel o el access token
 * configurado es de prueba. Es estado del server; nunca depende de lo que diga un request.
 */
export function isMercadoPagoSandbox(): boolean {
  return (
    process.env.VERCEL_ENV !== "production" ||
    Boolean(
      process.env.MP_ACCESS_TOKEN?.trim().startsWith(TEST_ACCESS_TOKEN_PREFIX),
    )
  );
}

/** Clave secreta de Webhooks de la aplicación de Mercado Pago, o `null` si no está configurada. */
export function getWebhookSecret(): string | null {
  return process.env.MP_WEBHOOK_SECRET?.trim() || null;
}
