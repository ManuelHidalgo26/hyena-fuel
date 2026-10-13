import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../lib/supabase/admin";
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

/** Cambia el estado de una orden (admin). */
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
  const requiresApprovedPayment = STATUSES_REQUIRING_APPROVED_PAYMENT.includes(parsed.data.status);

  // Cualquier cambio manual de estado limpia la marca "Para revisar" (ADR 0012 D14). Para
  // confirmar/despachar, el filtro hace atómico el chequeo del pago: un pedido con tarjeta sin
  // pago aprobado no matchea (y se distingue de "no existe" más abajo).
  let update = supabase.from("orders").update({ status: parsed.data.status, needs_review: false }).eq("id", id);
  if (requiresApprovedPayment) update = update.or("payment_status.is.null,paid_at.not.is.null");

  const { data, error } = await update.select("id, status").maybeSingle().returns<OrderStatusRow | null>();

  if (error) {
    console.error("[PATCH /api/orders/[id]/status]", error);
    return NextResponse.json({ error: "No se pudo actualizar el pedido" }, { status: 500 });
  }

  if (!data) {
    return requiresApprovedPayment && (await orderExists(supabase, id))
      ? NextResponse.json({ error: "El pago con tarjeta de este pedido todavía no está aprobado" }, { status: 409 })
      : NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ _id: data.id, status: data.status });
}

async function orderExists(supabase: ReturnType<typeof createAdminClient>, id: string): Promise<boolean> {
  const { data } = await supabase.from("orders").select("id").eq("id", id).maybeSingle();
  return data !== null;
}
