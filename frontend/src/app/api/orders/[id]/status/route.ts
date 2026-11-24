import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { CANCELLED_ORDER_STATUS, PAYMENT_REVERSAL_REVIEW_REASONS } from "../../../../../lib/orders";
import { revalidateStorefront } from "../../../../../lib/revalidate";
import { isUuid } from "../../../../../lib/uuid";

/** Estados que exigen que un pedido con pago online ya esté cobrado (ADR 0012). */
const STATUSES_REQUIRING_APPROVED_PAYMENT: readonly string[] = ["confirmed", "dispatched", "paid"];

/** Enum de `orders.status` (ADR 0002). */
const ORDER_STATUSES = ["pending", "confirmed", "dispatched", "paid", "cancelled"] as const;

const updateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
});

type RouteContext = { params: Promise<{ id: string }> };

type OrderStatusRow = {
  id: string;
  status: string;
};

type CancelOrderRow = {
  outcome: "not_found" | "already_cancelled" | "cancelled";
  restocked_items: number;
  skipped_items: number;
};

/** Cambia el estado de una orden (admin). Cancelar además repone su stock. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de pedido inválido" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateStatusSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Estado inválido", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  if (parsed.data.status === CANCELLED_ORDER_STATUS) return cancelOrder(supabase, id);

  const requiresApprovedPayment = STATUSES_REQUIRING_APPROVED_PAYMENT.includes(parsed.data.status);

  // Para confirmar/despachar, el filtro hace atómico el chequeo del pago: solo matchea un pedido
  // sin pago online o con el pago vigente aprobado (un pago revertido conserva `paid_at`, por
  // eso se gatea por `payment_status`). Un pedido que no matchea se distingue de "no existe" más abajo.
  // Un cancelado no se reabre: su stock ya se repuso y volvería a venderse sin descontar.
  let update = supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .neq("status", CANCELLED_ORDER_STATUS);
  if (requiresApprovedPayment) update = update.or("payment_status.is.null,payment_status.eq.approved");

  const { data, error } = await update.select("id, status").maybeSingle().returns<OrderStatusRow | null>();

  if (error) {
    console.error("[PATCH /api/orders/[id]/status]", error);
    return NextResponse.json({ error: "No se pudo actualizar el pedido" }, { status: 500 });
  }

  if (!data) {
    return explainUnmatchedOrder(supabase, id);
  }

  const clearError = await clearReviewMark(supabase, id);
  if (clearError) console.error("[PATCH /api/orders/[id]/status] limpiar revisión", clearError);

  return NextResponse.json({ _id: data.id, status: data.status });
}

/**
 * Un cambio manual de estado limpia la marca "Para revisar" (ADR 0012 D14), salvo la de un pago
 * revertido o en disputa: esa exige una acción explícita sobre el pago, no un cambio de estado.
 * Si falla, el estado ya cambió y la marca queda (falla hacia más revisión), por eso solo se loguea.
 */
async function clearReviewMark(supabase: ReturnType<typeof createAdminClient>, id: string): Promise<unknown> {
  const { error } = await supabase
    .from("orders")
    .update({ needs_review: false })
    .eq("id", id)
    .not("review_reason", "in", `(${PAYMENT_REVERSAL_REVIEW_REASONS.join(",")})`);
  return error;
}

/** El UPDATE no matcheó: pedido inexistente (404), ya cancelado o con el pago sin aprobar (409). */
async function explainUnmatchedOrder(
  supabase: ReturnType<typeof createAdminClient>,
  id: string
): Promise<NextResponse> {
  const { data } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle()
    .returns<OrderStatusRow | null>();

  if (!data) return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });

  const error =
    data.status === CANCELLED_ORDER_STATUS
      ? "Este pedido está cancelado y no se puede reabrir"
      : "El pago con tarjeta de este pedido todavía no está aprobado";
  return NextResponse.json({ error }, { status: 409 });
}

/** Cancela y repone el stock en una sola transacción (RPC `cancel_order`, migración 0015). */
async function cancelOrder(supabase: ReturnType<typeof createAdminClient>, id: string): Promise<NextResponse> {
  const { data, error } = await supabase
    .rpc("cancel_order", { p_order_id: id })
    .single()
    .returns<CancelOrderRow>();

  if (error || !data) {
    console.error("[PATCH /api/orders/[id]/status] cancel_order", error);
    return NextResponse.json({ error: "No se pudo cancelar el pedido" }, { status: 500 });
  }
  if (data.outcome === "not_found") {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  const clearError = await clearReviewMark(supabase, id);
  if (clearError) console.error("[PATCH /api/orders/[id]/status] limpiar revisión", clearError);

  revalidateStorefront("order-cancel");
  return NextResponse.json({ _id: id, status: CANCELLED_ORDER_STATUS, skippedItems: data.skipped_items });
}
