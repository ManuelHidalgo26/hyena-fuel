import { redirect } from "next/navigation";
import { getSessionUser } from "../../../../lib/auth/guards";
import { createClient } from "../../../../lib/supabase/server";
import {
  DISCOUNT_CODE_COLUMNS,
  deriveDiscountCodeStatus,
  mapDiscountCode,
  remainingDiscountCodeUses,
  type DiscountCodeRow,
} from "../../../../lib/discountCodes";
import CodigosClient from "./CodigosClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Códigos | Panel HYENA FUEL",
};

/**
 * Server Component: lista todos los códigos de descuento (spec Códigos de
 * descuento §6.2) leyendo directo de Supabase con el cliente SSR (RLS
 * `discount_codes_admin_all` habilita ver todo para un admin). Las
 * mutaciones (crear, desactivar) van por `CodigosClient` contra
 * `/api/admin/discount-codes`.
 */
export default async function CodigosPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/panel/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select(DISCOUNT_CODE_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<DiscountCodeRow[]>();

  if (error) {
    throw new Error("No se pudieron cargar los códigos");
  }

  const codes = (data ?? []).map(mapDiscountCode).map((code) => ({
    ...code,
    status: deriveDiscountCodeStatus(code),
    remainingUses: remainingDiscountCodeUses(code),
  }));

  return <CodigosClient initialCodes={codes} />;
}
