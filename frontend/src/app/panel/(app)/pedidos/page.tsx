import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { ADMIN_ORDER_COLUMNS, mapAdminOrder, type AdminOrderRow } from "../../../../lib/admin/orders";
import PedidosClient from "./PedidosClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pedidos | Panel HYENA FUEL",
};

/**
 * Server Component: lista todos los pedidos con service role detrás del
 * guard admin (SEC-COST-AUTH); la RLS no aplica. Las mutaciones (cambiar
 * estado, limpiar finalizados) van por `PedidosClient` contra los Route
 * Handlers existentes.
 */
export default async function PedidosPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ADMIN_ORDER_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<AdminOrderRow[]>();

  if (error) {
    throw new Error("No se pudieron cargar los pedidos");
  }

  const orders = (data ?? []).map(mapAdminOrder);

  return <PedidosClient initialOrders={orders} />;
}
