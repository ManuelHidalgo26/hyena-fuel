import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { listSellersForAdmin } from "../../../../lib/admin/sellers";
import VendedoresClient from "./VendedoresClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vendedores | Panel HYENA FUEL",
};

/**
 * Server Component: lista todos los vendedores (activos e inactivos) con su email y
 * ventas, leyendo con service role detrás del guard admin (el email vive en
 * `auth.users`, solo accesible por la Admin API). Las mutaciones van por
 * `VendedoresClient` contra `/api/admin/sellers`.
 */
export default async function VendedoresPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const sellers = await listSellersForAdmin(createAdminClient());

  return <VendedoresClient initialSellers={sellers} />;
}
