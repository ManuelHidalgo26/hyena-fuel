import { Preference, type MercadoPagoConfig } from "mercadopago";
import { shortOrderId, type FrozenOrderItem } from "../orders";

type PreferenceBody = Parameters<Preference["create"]>[0]["body"];
type PreferenceItem = NonNullable<PreferenceBody["items"]>[number];

const CURRENCY = "ARS";
/** Aparece en el resumen de la tarjeta del comprador. */
const STATEMENT_DESCRIPTOR = "HYENAFUEL";
/** El checkout vence a las 2 h: pasado ese plazo Mercado Pago no deja pagar. */
const EXPIRATION_MS = 2 * 60 * 60 * 1000;
const EXPIRATION_START_SKEW_MS = 60 * 1000;
/** Argentina no tiene horario de verano: el offset es fijo. */
const ARGENTINA_OFFSET_MS = -3 * 60 * 60 * 1000;
const MAX_DESCRIPTION_LENGTH = 250;

export type PreferenceInput = {
  orderId: string;
  customerName: string;
  customerEmail?: string;
  items: FrozenOrderItem[];
  shippingCost: number;
  couponDiscount: number;
  totalFinal: number;
  /** URL pública base y query extra del webhook (ver `getSiteUrls`). */
  urls: { baseUrl: string; webhookBypassQuery: string };
  now?: Date;
};

export type CreatedPreference = {
  id: string;
  initPoint: string;
};

const toCents = (amount: number): number => Math.round(amount * 100);

/** ISO-8601 con offset `-03:00` (`yyyy-MM-ddTHH:mm:ss.SSS-03:00`), el formato que pide Mercado Pago. */
export function toArgentinaIso(date: Date): string {
  const shifted = new Date(date.getTime() + ARGENTINA_OFFSET_MS);
  return `${shifted.toISOString().slice(0, 23)}-03:00`;
}

function describeLine(item: FrozenOrderItem): string {
  return item.flavor ? `${item.name} — ${item.flavor}` : item.name;
}

function buildDetailedItems(input: PreferenceInput): PreferenceItem[] {
  const lines: PreferenceItem[] = input.items.map((item) => ({
    id: item.productId,
    title: describeLine(item),
    quantity: item.quantity,
    unit_price: item.unitPrice,
    currency_id: CURRENCY,
  }));

  if (input.shippingCost > 0) {
    lines.push({
      id: "envio",
      title: "Envío a domicilio",
      quantity: 1,
      unit_price: input.shippingCost,
      currency_id: CURRENCY,
    });
  }

  return lines;
}

function buildSingleItem(input: PreferenceInput): PreferenceItem[] {
  const units = input.items.reduce((sum, item) => sum + item.quantity, 0);
  const description = `${units} ${units === 1 ? "producto" : "productos"}`;

  return [
    {
      id: input.orderId,
      title: `Pedido Hyena Fuel #${shortOrderId(input.orderId)}`,
      description: description.slice(0, MAX_DESCRIPTION_LENGTH),
      quantity: 1,
      unit_price: input.totalFinal,
      currency_id: CURRENCY,
    },
  ];
}

function sumInCents(items: PreferenceItem[]): number {
  return items.reduce((sum, item) => sum + toCents(item.unit_price) * item.quantity, 0);
}

/**
 * Ítems de la preferencia. Sin cupón, un ítem por línea (+ envío); con cupón, o si la suma
 * detallada no da exactamente el total, un único ítem por el total (evita prorratear
 * centavos). Invariante: Σ(unit_price · quantity) === totalFinal.
 */
function buildItems(input: PreferenceInput): PreferenceItem[] {
  const totalCents = toCents(input.totalFinal);
  if (!Number.isFinite(input.totalFinal) || totalCents <= 0) {
    throw new Error("El total de la preferencia debe ser mayor a 0");
  }

  if (input.couponDiscount === 0) {
    const detailed = buildDetailedItems(input);
    if (sumInCents(detailed) === totalCents) return detailed;
  }

  return buildSingleItem(input);
}

/** Cuerpo de la preferencia de Checkout Pro. Puro: no toca la red ni el entorno. */
export function buildPreferenceBody(input: PreferenceInput): PreferenceBody {
  const { baseUrl, webhookBypassQuery } = input.urls;
  const now = input.now ?? new Date();
  const resultUrl = `${baseUrl}/compra/resultado`;
  // Mercado Pago rechaza `auto_return` con back_urls que no sean https (entorno local).
  const canAutoReturn = baseUrl.startsWith("https://");

  return {
    items: buildItems(input),
    payer: {
      name: input.customerName,
      ...(input.customerEmail ? { email: input.customerEmail } : {}),
    },
    external_reference: input.orderId,
    metadata: { order_id: input.orderId },
    back_urls: {
      success: `${resultUrl}?r=ok`,
      pending: `${resultUrl}?r=pendiente`,
      failure: `${resultUrl}?r=error`,
    },
    ...(canAutoReturn ? { auto_return: "approved" } : {}),
    notification_url: `${baseUrl}/api/webhooks/mercadopago?source_news=webhooks${webhookBypassQuery}`,
    statement_descriptor: STATEMENT_DESCRIPTOR,
    binary_mode: false,
    // Sin `installments`: las cuotas son las que ofrezca Mercado Pago. Efectivo excluido:
    // el efectivo se cobra por "Transferencia / Efectivo" con 10% OFF.
    payment_methods: { excluded_payment_types: [{ id: "ticket" }, { id: "atm" }] },
    expires: true,
    expiration_date_from: toArgentinaIso(new Date(now.getTime() - EXPIRATION_START_SKEW_MS)),
    expiration_date_to: toArgentinaIso(new Date(now.getTime() + EXPIRATION_MS)),
  };
}

/** Crea la preferencia en Mercado Pago. Idempotente por pedido (`pref-<orderId>`). */
export async function createPreference(
  client: MercadoPagoConfig,
  input: PreferenceInput
): Promise<CreatedPreference> {
  const response = await new Preference(client).create({
    body: buildPreferenceBody(input),
    requestOptions: { idempotencyKey: `pref-${input.orderId}` },
  });

  if (!response.id || !response.init_point) {
    throw new Error("Mercado Pago no devolvió el link de pago");
  }

  return { id: response.id, initPoint: response.init_point };
}
