import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { ADMIN_PRODUCT_COLUMNS, mapAdminProduct, type AdminProductRow } from "../../../../lib/products";
import ProductosClient from "./ProductosClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos | Panel HYENA FUEL",
};

/**
 * Server Component: lista todos los productos (incluidos inactivos, con
 * `cost`) con service role detrás del guard admin (SEC-COST-AUTH); la RLS
 * no aplica. Las mutaciones (crear, editar, stock rápido, activar/desactivar)
 * van por `ProductosClient`.
 */
export default async function ProductosPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .order("created_at", { ascending: false })
    .order("position", { foreignTable: "product_variants", ascending: true })
    .returns<AdminProductRow[]>();

  if (error) {
    throw new Error("No se pudieron cargar los productos");
  }

  const products = (data ?? []).map(mapAdminProduct);

  return <ProductosClient initialProducts={products} />;
}
