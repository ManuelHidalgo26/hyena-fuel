import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../lib/uuid";

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
  const { data, error } = await supabase
    .from("orders")
    .update({ status: parsed.data.status })
    .eq("id", id)
    .select("id, status")
    .maybeSingle()
    .returns<OrderStatusRow | null>();

  if (error) {
    console.error("[PATCH /api/orders/[id]/status]", error);
    return NextResponse.json({ error: "No se pudo actualizar el pedido" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ _id: data.id, status: data.status });
}
