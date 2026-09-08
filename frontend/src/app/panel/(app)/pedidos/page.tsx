import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createClient } from "../../../../lib/supabase/server";
import { ADMIN_ORDER_COLUMNS, mapAdminOrder, type AdminOrderRow } from "../../../../lib/admin/orders";
import PedidosClient from "./PedidosClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pedidos | Panel HYENA FUEL",
};

/**
 * Server Component: lista todos los pedidos leyendo directo de Supabase con
 * el cliente SSR (sesión admin en cookie → RLS `is_admin()` habilita ver
 * todo, spec Admin UI §3.2). Las mutaciones (cambiar estado, limpiar
 * finalizados) van por `PedidosClient` contra los Route Handlers existentes.
 */
export default async function PedidosPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = await createClient();
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
