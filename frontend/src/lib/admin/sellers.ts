import "server-only";
import type { createAdminClient } from "../supabase/admin";
import {
  SELLER_COLUMNS,
  mapSeller,
  summarizeSellerOrders,
  type Seller,
  type SellerOrderRow,
  type SellerRow,
  type SellerSalesSummary,
} from "../sellers";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Vendedor + email de su cuenta de auth (no vive en `sellers`, se resuelve aparte). */
export type SellerWithEmail = Seller & { email: string | null };

/** Fila del listado admin de vendedores: ficha + email + resumen de ventas. */
export type AdminSeller = SellerWithEmail & { sales: SellerSalesSummary };

type SellerOrderWithSellerRow = SellerOrderRow & { seller_id: string };

/** Agrega el email de `auth.users` a cada vendedor (Admin API, una llamada por vendedor). */
export async function attachEmails(supabase: AdminClient, sellers: Seller[]): Promise<SellerWithEmail[]> {
  return Promise.all(
    sellers.map(async (seller) => {
      const { data } = await supabase.auth.admin.getUserById(seller.id);
      return { ...seller, email: data.user?.email ?? null };
    })
  );
}

/**
 * Listado completo para `/panel/vendedores`: todos los vendedores (activos e inactivos), su
 * email y ventas/comisión con la misma regla que ve el propio vendedor en su portal. Requiere
 * el cliente service role: el llamador tiene que haber pasado el guard de admin antes.
 */
export async function listSellersForAdmin(supabase: AdminClient): Promise<AdminSeller[]> {
  const [sellersResult, ordersResult] = await Promise.all([
    supabase
      .from("sellers")
      .select(SELLER_COLUMNS)
      .order("created_at", { ascending: false })
      .returns<SellerRow[]>(),
    supabase
      .from("orders")
      .select("seller_id, status, total_final, commission_total")
      .not("seller_id", "is", null)
      .returns<SellerOrderWithSellerRow[]>(),
  ]);

  if (sellersResult.error) {
    throw new Error(`Error al obtener vendedores: ${sellersResult.error.message}`);
  }
  if (ordersResult.error) {
    throw new Error(`Error al obtener ventas de vendedores: ${ordersResult.error.message}`);
  }

  const ordersBySeller = new Map<string, SellerOrderRow[]>();
  for (const order of ordersResult.data ?? []) {
    const orders = ordersBySeller.get(order.seller_id) ?? [];
    orders.push(order);
    ordersBySeller.set(order.seller_id, orders);
  }

  const sellers = await attachEmails(supabase, (sellersResult.data ?? []).map(mapSeller));
  return sellers.map((seller) => ({
    ...seller,
    sales: summarizeSellerOrders(ordersBySeller.get(seller.id) ?? []),
  }));
}
