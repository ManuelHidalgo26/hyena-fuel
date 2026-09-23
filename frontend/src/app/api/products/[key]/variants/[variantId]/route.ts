import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../../lib/uuid";
import type { AdminProductVariant } from "../../../../../../lib/productVariants";
import { revalidateStorefront } from "../../../../../../lib/revalidate";

/**
 * Segmento dinámico nombrado `key` (no `id`) a propósito: Next.js exige que
 * todas las rutas bajo `api/products/**` usen el mismo nombre de parámetro
 * dinámico que la ruta hermana `api/products/[key]/route.ts`. Acá siempre es
 * un uuid de producto (no un slug), validado abajo con `isUuid`.
 */
type RouteContext = { params: Promise<{ key: string; variantId: string }> };

const updateVariantStockSchema = z.object({
  stock: z.number().int().nonnegative("El stock no puede ser negativo"),
});

/**
 * Ajusta SOLO el stock de un sabor (ADR 0008, Decisión 6): dato "caliente",
 * aislado a propósito del guardado del form completo de producto
 * (`PATCH /api/products/[key]`) para evitar el lost-update entre el catálogo
 * frío de sabores (nombre/imagen/activo/orden) y el contador caliente de stock.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { key: productId, variantId } = await params;
  if (!isUuid(productId) || !isUuid(variantId)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateVariantStockSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de stock inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("product_variants")
    .update({ stock: parsed.data.stock })
    .eq("id", variantId)
    .eq("product_id", productId)
    .select("id, name, image, stock, position, active")
    .maybeSingle()
    .returns<AdminProductVariant | null>();

  if (error) {
    console.error("[PATCH /api/products/[key]/variants/[variantId]]", error);
    return NextResponse.json({ error: "No se pudo actualizar el stock del sabor" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Sabor no encontrado" }, { status: 404 });
  }

  revalidateStorefront("variant-stock-update");
  return NextResponse.json(data);
}
