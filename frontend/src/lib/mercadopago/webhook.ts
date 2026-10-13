import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "../supabase/admin";
import { revalidateStorefront } from "../revalidate";
import { getMercadoPagoClient, getWebhookSecret } from "./client";
import { verifyWebhookSignature } from "./signature";
import { fetchPayment, syncPayment } from "./sync";

/** Los ids de pago de Mercado Pago son numéricos; cualquier otra cosa no se consulta. */
const PAYMENT_ID_PATTERN = /^\d{1,20}$/;
const PAYMENT_NOTIFICATION_TYPE = "payment";

type WebhookBody = {
  type?: unknown;
  topic?: unknown;
  live_mode?: unknown;
  data?: { id?: unknown };
};

async function readJsonBody(request: NextRequest): Promise<WebhookBody> {
  try {
    const json: unknown = await request.json();
    return typeof json === "object" && json !== null ? (json as WebhookBody) : {};
  } catch {
    return {};
  }
}

function asText(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number") return String(value);
  return null;
}

function respond(body: Record<string, unknown>, status = 200): NextResponse {
  return NextResponse.json(body, { status });
}

/**
 * Webhook de Mercado Pago (ADR 0012 D5). Valida la firma, consulta el pago a la API con
 * nuestro token (no confía en el body) y lo aplica con la RPC idempotente. Responde 200 salvo
 * firma inválida (401) o error transitorio (500: Mercado Pago reintenta).
 */
export async function handleMercadoPagoWebhook(request: NextRequest): Promise<NextResponse> {
  const secret = getWebhookSecret();
  const client = getMercadoPagoClient();
  if (!secret || !client) {
    console.error("[webhook mercadopago] falta MP_WEBHOOK_SECRET o MP_ACCESS_TOKEN");
    return respond({ error: "Webhook no configurado" }, 500);
  }

  // Con `data.id` en la query la firma se valida antes de leer el body; si no viene, el id sale del body.
  const queryDataId = request.nextUrl.searchParams.get("data.id");
  const body = queryDataId ? null : await readJsonBody(request);
  const dataId = queryDataId ?? asText(body?.data?.id);

  const isValidSignature = verifyWebhookSignature({
    signatureHeader: request.headers.get("x-signature"),
    requestId: request.headers.get("x-request-id"),
    dataId,
    secret,
  });
  if (!isValidSignature) return respond({ error: "Firma inválida" }, 401);

  const verifiedBody = body ?? (await readJsonBody(request));

  const notificationType = request.nextUrl.searchParams.get("type") ?? asText(verifiedBody.type) ?? asText(verifiedBody.topic);
  if (notificationType !== PAYMENT_NOTIFICATION_TYPE) return respond({ ignored: true });
  if (!dataId || !PAYMENT_ID_PATTERN.test(dataId)) return respond({ ignored: true });

  try {
    const payment = await fetchPayment(client, dataId);
    if (!payment) return handleMissingPayment(dataId, verifiedBody);

    const result = await syncPayment(createAdminClient(), payment);
    if (result.kind === "ignored") {
      console.warn("[webhook mercadopago] pago ignorado", { paymentId: payment.id, reason: result.reason });
      return respond({ ignored: true });
    }

    console.info("[webhook mercadopago]", {
      orderId: result.orderId,
      paymentId: payment.id,
      status: payment.status,
      outcome: result.outcome,
    });
    if (result.outcome === "approved") revalidateStorefront("mp-payment");

    return respond({ ok: true });
  } catch (error) {
    console.error("[webhook mercadopago]", { paymentId: dataId, error });
    return respond({ error: "No se pudo procesar el pago" }, 500);
  }
}

/**
 * MP no encontró el pago. En una notificación real puede ser una demora de replicación de MP:
 * se responde 500 para que reintente. La simulación del panel (`live_mode: false`, id de
 * prueba) se responde 200 porque nunca va a existir.
 */
function handleMissingPayment(paymentId: string, body: WebhookBody): NextResponse {
  if (body.live_mode === false) {
    console.warn("[webhook mercadopago] simulación sin pago real", { paymentId });
    return respond({ ignored: true });
  }

  console.error("[webhook mercadopago] pago inexistente en una notificación real", { paymentId });
  return respond({ error: "Pago no encontrado" }, 500);
}
