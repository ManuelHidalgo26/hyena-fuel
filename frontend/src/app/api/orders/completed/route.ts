import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";

/** Estados considerados "finalizados": ya no requieren seguimiento en el panel (ADR 0002 `orders.status`). */
const COMPLETED_STATUSES = ["dispatched", "paid", "cancelled"] as const;

/** Borra en bloque las órdenes finalizadas. `order_items` cae en cascada (FK `on delete cascade`). */
export async function DELETE() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .delete()
    .in("status", COMPLETED_STATUSES)
    .select("id")
    .returns<{ id: string }[]>();

  if (error) {
    console.error("[DELETE /api/orders/completed]", error);
    return NextResponse.json({ error: "No se pudieron eliminar los pedidos" }, { status: 500 });
  }

  return NextResponse.json({ deleted: data?.length ?? 0 });
}
