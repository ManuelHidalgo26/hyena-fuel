import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  ABANDONABLE_PAYMENT_STATUSES,
  ABANDONED_ORDER_HOURS,
  COMPLETED_ORDER_STATUSES,
} from "../../../../lib/orders";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Filtro PostgREST equivalente a `isClearableOrder` (lib/orders.ts): pedidos finalizados
 * (ADR 0002 `orders.status`) o con tarjeta abandonados (sin pago aprobado y con más de 24 h).
 */
function buildClearableFilter(now: Date): string {
  const abandonedBefore = new Date(now.getTime() - ABANDONED_ORDER_HOURS * HOUR_MS).toISOString();
  const abandoned = [
    "payment_method.eq.mercadopago",
    `payment_status.in.(${ABANDONABLE_PAYMENT_STATUSES.join(",")})`,
    "paid_at.is.null",
    "status.eq.pending",
    `created_at.lt.${abandonedBefore}`,
  ].join(",");

  return `status.in.(${COMPLETED_ORDER_STATUSES.join(",")}),and(${abandoned})`;
}

/**
 * Borra en bloque las órdenes finalizadas y las de tarjeta abandonadas. Nunca borra un pedido
 * que requiere revisión (`needs_review`). `order_items` cae en cascada (FK `on delete cascade`).
 */
export async function DELETE() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .delete()
    .eq("needs_review", false)
    .or(buildClearableFilter(new Date()))
    .select("id")
    .returns<{ id: string }[]>();

  if (error) {
    console.error("[DELETE /api/orders/completed]", error);
    return NextResponse.json({ error: "No se pudieron eliminar los pedidos" }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
