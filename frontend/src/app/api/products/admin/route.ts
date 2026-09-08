import { NextResponse } from "next/server";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { ADMIN_PRODUCT_COLUMNS, mapAdminProduct, type AdminProductRow } from "../../../../lib/products";

/** Listado completo de productos para el panel admin: incluye inactivos y columnas de negocio. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<AdminProductRow[]>();

  if (error) {
    console.error("[GET /api/products/admin]", error);
    return NextResponse.json({ error: "No se pudieron obtener los productos" }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapAdminProduct));
}
