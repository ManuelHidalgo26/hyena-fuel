import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createClient } from "../../../../lib/supabase/server";
import { ADMIN_PRODUCT_COLUMNS, mapAdminProduct, type AdminProductRow } from "../../../../lib/products";
import ProductosClient from "./ProductosClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Productos | Panel HYENA FUEL",
};

/**
 * Server Component: lista todos los productos (incluidos inactivos, con
 * `cost`) leyendo directo de Supabase con el cliente SSR (RLS `is_admin()`
 * habilita ver todo, spec Admin UI §3.2). Las mutaciones (crear, editar,
 * stock rápido, activar/desactivar) van por `ProductosClient`.
 */
export default async function ProductosPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<AdminProductRow[]>();

  if (error) {
    throw new Error("No se pudieron cargar los productos");
  }

  const products = (data ?? []).map(mapAdminProduct);

  return <ProductosClient initialProducts={products} />;
}
