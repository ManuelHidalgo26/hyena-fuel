import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { getMercadoPagoClient } from "../../../../../lib/mercadopago/client";
import { toPublicPaymentState } from "../../../../../lib/mercadopago/paymentState";
import { fetchPayment, syncPayment } from "../../../../../lib/mercadopago/sync";
import { shortOrderId, type PaymentStatus } from "../../../../../lib/orders";
import { getClientIp, isRateLimited } from "../../../../../lib/rateLimit";
import { revalidateStorefront } from "../../../../../lib/revalidate";
import { isUuid } from "../../../../../lib/uuid";

export const dynamic = "force-dynamic";

const RATE_LIMIT_MAX_REQUESTS = 30;
const RATE_LIMIT_WINDOW_MS = 60_000;
const PAYMENT_ID_PATTERN = /^\d{1,20}$/;
/** Estados que todavía pueden cambiar con un pago nuevo o uno que se acredita: vale la pena consultar a MP. */
const SYNCABLE_PAYMENT_STATUSES: readonly PaymentStatus[] = ["pending", "in_process", "rejected", "cancelled"];

type RouteContext = { params: Promise<{ id: string }> };
type AdminClient = ReturnType<typeof createAdminClient>;

type OrderPaymentRow = {
  id: string;
  payment_status: PaymentStatus | null;
  paid_at: string | null;
  total_final: number | string;
  delivery_method: "envio" | "retiro";
};

/** Pedido con pago online (`payment_status` no nulo): los de transferencia no tienen estado de pago. */
type OnlinePaymentOrder = OrderPaymentRow & { payment_status: PaymentStatus };

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const ORDER_PAYMENT_COLUMNS = "id, payment_status, paid_at, total_final, delivery_method";

/**
 * Estado del pago de un pedido con tarjeta para `/compra/resultado`. Público: el UUID del
 * pedido es la capacidad y la respuesta no trae datos personales. Si el pedido sigue sin
 * cobrarse y viene `payment_id`, verifica el pago contra la API de Mercado Pago y lo aplica
 * (por si el webhook todavía no llegó). Los query params de la `back_url` nunca deciden nada.
 */
export async function GET(request: NextRequest, { params }: RouteContext) {
  if (isRateLimited(`mp-status:${getClientIp(request)}`, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json({ error: "Demasiadas consultas, probá en un minuto" }, { status: 429 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de pedido inválido" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    let order = await fetchOnlinePaymentOrder(supabase, id);
    if (!order) {
      return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
    }

    const paymentId = request.nextUrl.searchParams.get("payment_id");
    if (paymentId && PAYMENT_ID_PATTERN.test(paymentId) && canSyncWithMercadoPago(order)) {
      const wasSynced = await syncFromMercadoPago(supabase, id, paymentId);
      if (wasSynced) order = (await fetchOnlinePaymentOrder(supabase, id)) ?? order;
    }

    return NextResponse.json(toResponseBody(order), { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[GET /api/orders/[id]/payment]", error);
    return NextResponse.json({ error: "No se pudo consultar el pago" }, { status: 500 });
  }
}

async function fetchOnlinePaymentOrder(supabase: AdminClient, orderId: string): Promise<OnlinePaymentOrder | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_PAYMENT_COLUMNS)
    .eq("id", orderId)
    .maybeSingle()
    .returns<OrderPaymentRow | null>();

  if (error) throw new Error(`Error al obtener el pedido: ${error.message}`);
  return data && data.payment_status !== null ? { ...data, payment_status: data.payment_status } : null;
}

function canSyncWithMercadoPago(order: OnlinePaymentOrder): boolean {
  return order.paid_at === null && SYNCABLE_PAYMENT_STATUSES.includes(order.payment_status);
}

/**
 * Consulta el pago y lo aplica si pertenece a este pedido. Un fallo de Mercado Pago no rompe
 * la respuesta: se devuelve lo que ya hay en la base (el webhook lo completará).
 */
async function syncFromMercadoPago(supabase: AdminClient, orderId: string, paymentId: string): Promise<boolean> {
  const client = getMercadoPagoClient();
  if (!client) return false;

  try {
    const payment = await fetchPayment(client, paymentId);
    if (!payment || payment.externalReference !== orderId) return false;

    const result = await syncPayment(supabase, payment);
    if (result.kind === "applied" && result.outcome === "approved") revalidateStorefront("mp-payment");
    return result.kind === "applied";
  } catch (error) {
    console.error("[GET /api/orders/[id]/payment] sincronización con Mercado Pago", error);
    return false;
  }
}

function toResponseBody(order: OnlinePaymentOrder) {
  return {
    orderId: order.id,
    shortId: shortOrderId(order.id),
    state: toPublicPaymentState(order.payment_status),
    totalFinal: Number(order.total_final),
    deliveryMethod: order.delivery_method,
  };
}
