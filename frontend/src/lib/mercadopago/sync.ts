import "server-only";
import { MPBadRequestError, MPNotFoundError, Payment, type MercadoPagoConfig } from "mercadopago";
import type { createAdminClient } from "../supabase/admin";
import { isUuid } from "../uuid";

type AdminClient = ReturnType<typeof createAdminClient>;

/** SQLSTATE con el que `apply_mercadopago_payment` rechaza un estado de pago que no conoce. */
const UNKNOWN_PAYMENT_STATUS_ERROR_CODE = "22023";

/** Pago de Mercado Pago ya consultado a su API, normalizado a lo que usamos. */
export type PaymentSnapshot = {
  id: string;
  status: string;
  statusDetail: string | null;
  externalReference: string | null;
  amount: number | null;
  currency: string | null;
  dateApproved: string | null;
  dateLastUpdated: string | null;
};

export type SyncResult =
  | { kind: "ignored"; reason: "invalid_external_reference" | "unknown_status" }
  | { kind: "applied"; orderId: string; outcome: string };

type ApplyPaymentRow = {
  outcome: string;
};

/**
 * Consulta el pago a la API de Mercado Pago con nuestro token (única fuente de verdad).
 * Devuelve `null` si el pago no existe (404/400: por ejemplo la notificación de prueba del
 * panel de MP con un id inventado). Cualquier otro error (timeout, 5xx, red) se propaga.
 */
export async function fetchPayment(client: MercadoPagoConfig, paymentId: string): Promise<PaymentSnapshot | null> {
  try {
    const response = await new Payment(client).get({ id: paymentId });
    return {
      id: String(response.id ?? paymentId),
      status: response.status ?? "",
      statusDetail: response.status_detail ?? null,
      externalReference: response.external_reference ?? null,
      amount: response.transaction_amount ?? null,
      currency: response.currency_id ?? null,
      dateApproved: response.date_approved ?? null,
      dateLastUpdated: response.date_last_updated ?? null,
    };
  } catch (error) {
    if (error instanceof MPNotFoundError || error instanceof MPBadRequestError) return null;
    throw error;
  }
}

/**
 * Aplica el pago al pedido con la RPC atómica e idempotente `apply_mercadopago_payment`.
 * Lo usan el webhook y la consulta de estado del comprador. Los montos y el estado salen del
 * pago consultado a la API, nunca del request.
 */
export async function syncPayment(supabase: AdminClient, payment: PaymentSnapshot): Promise<SyncResult> {
  const orderId = payment.externalReference;
  if (!orderId || !isUuid(orderId)) return { kind: "ignored", reason: "invalid_external_reference" };

  const { data, error } = await supabase
    .rpc("apply_mercadopago_payment", {
      p_order_id: orderId,
      p_payment_id: payment.id,
      p_status: payment.status,
      p_status_detail: payment.statusDetail,
      p_amount: payment.amount,
      p_currency: payment.currency ?? "",
      p_date_approved: payment.dateApproved,
      p_date_last_updated: payment.dateLastUpdated ?? new Date().toISOString(),
    })
    .single()
    .returns<ApplyPaymentRow>();

  if (error) {
    if (error.code === UNKNOWN_PAYMENT_STATUS_ERROR_CODE) return { kind: "ignored", reason: "unknown_status" };
    throw new Error(`apply_mercadopago_payment falló: ${error.message}`);
  }

  if (!data) throw new Error("apply_mercadopago_payment no devolvió resultado");

  return { kind: "applied", orderId, outcome: data.outcome };
}
