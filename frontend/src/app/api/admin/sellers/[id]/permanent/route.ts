import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "../../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../../lib/uuid";

/** Código Postgres de violación de FK (`orders`/`commission_payments` → `sellers`, ON DELETE RESTRICT). */
const FOREIGN_KEY_VIOLATION_CODE = "23503";

const HAS_HISTORY_MESSAGE =
  "No se puede eliminar: tiene ventas o pagos de comisión registrados. Queda dado de baja para conservar ese historial.";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Eliminación definitiva de un vendedor ya dado de baja (admin). Solo procede si no tiene
 * órdenes ni pagos de comisión: el historial nunca se borra (las FKs son RESTRICT igual).
 * Borra la ficha y la cuenta de auth, así el email y el código quedan libres para reusar.
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de vendedor inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: seller, error: fetchError } = await supabase
    .from("sellers")
    .select("id, active")
    .eq("id", id)
    .maybeSingle();

  if (fetchError) {
    console.error("[DELETE /api/admin/sellers/[id]/permanent] fetch", fetchError);
    return NextResponse.json({ error: "No se pudo eliminar al vendedor" }, { status: 500 });
  }
  if (!seller) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
  }
  if (seller.active) {
    return NextResponse.json({ error: "Primero tenés que dar de baja al vendedor" }, { status: 409 });
  }

  const [orders, payments] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", id),
    supabase.from("commission_payments").select("id", { count: "exact", head: true }).eq("seller_id", id),
  ]);

  if (orders.error || payments.error) {
    console.error("[DELETE /api/admin/sellers/[id]/permanent] count", orders.error ?? payments.error);
    return NextResponse.json({ error: "No se pudo eliminar al vendedor" }, { status: 500 });
  }
  if ((orders.count ?? 0) > 0 || (payments.count ?? 0) > 0) {
    return NextResponse.json({ error: HAS_HISTORY_MESSAGE }, { status: 409 });
  }

  const { error: deleteError } = await supabase.from("sellers").delete().eq("id", id);

  if (deleteError) {
    if (deleteError.code === FOREIGN_KEY_VIOLATION_CODE) {
      return NextResponse.json({ error: HAS_HISTORY_MESSAGE }, { status: 409 });
    }
    console.error("[DELETE /api/admin/sellers/[id]/permanent] delete", deleteError);
    return NextResponse.json({ error: "No se pudo eliminar al vendedor" }, { status: 500 });
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(id);

  if (authError) {
    // La ficha ya no existe y la cuenta sigue baneada desde la baja: no puede entrar. Solo queda
    // el email ocupado en auth, así que se registra pero no se le reporta como fallo al admin.
    console.error("[DELETE /api/admin/sellers/[id]/permanent] auth", authError);
  }

  return NextResponse.json({ ok: true });
}
