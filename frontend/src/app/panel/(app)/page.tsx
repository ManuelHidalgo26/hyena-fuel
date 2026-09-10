import { redirect } from "next/navigation";
import { getSessionUser } from "../../../lib/auth/guards";
import { createClient } from "../../../lib/supabase/server";
import { ADMIN_ORDER_COLUMNS, mapAdminOrder, type AdminOrderRow } from "../../../lib/admin/orders";
import { ADMIN_PRODUCT_COLUMNS, mapAdminProduct, type AdminProductRow } from "../../../lib/products";
import { computeDashboardData } from "../../../lib/admin/dashboard";
import { AdminPageHeader, DashboardView } from "../../../components/admin";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resumen | Panel HYENA FUEL",
};

/**
 * Server Component: dashboard de `/panel` (spec-panel-admin-mejoras.md §3.3).
 * Lee `orders` + `products` directo de Supabase con el cliente SSR (RLS
 * `is_admin()` habilita ver todo, mismo patrón que `/panel/pedidos` y
 * `/panel/productos`) y computa `DashboardData` client-side de dev
 * (`lib/admin/dashboard.ts`); la vista es 100% de ux (`DashboardView`).
 */
export default async function PanelHomePage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = await createClient();

  const [ordersResult, productsResult] = await Promise.all([
    supabase.from("orders").select(ADMIN_ORDER_COLUMNS).order("created_at", { ascending: false }).returns<AdminOrderRow[]>(),
    supabase.from("products").select(ADMIN_PRODUCT_COLUMNS).order("created_at", { ascending: false }).returns<AdminProductRow[]>(),
  ]);

  if (ordersResult.error || productsResult.error) {
    throw new Error("No se pudo cargar el resumen");
  }

  const orders = (ordersResult.data ?? []).map(mapAdminOrder);
  const products = (productsResult.data ?? []).map(mapAdminProduct);
  const data = computeDashboardData(orders, products);

  return (
    <>
      <AdminPageHeader title="Resumen" description="Ventas, ganancia estimada y stock de un vistazo." />
      <DashboardView data={data} />
    </>
  );
}
