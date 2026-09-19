import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Máximo razonable de sabores por producto (defensivo; el ADR 0008 no fija un número). */
export const MAX_VARIANTS_PER_PRODUCT = 30;

/** Código Postgres de violación de constraint único (`product_variants(product_id, lower(name))`). */
const UNIQUE_VIOLATION_CODE = "23505";

/** Fila de `product_variants` tal como la ve el admin (sin `cost`: esa columna no existe acá). */
export type AdminProductVariant = {
  id: string;
  name: string;
  image: string | null;
  stock: number;
  position: number;
  active: boolean;
};

/**
 * Input de un sabor aceptado por `POST/PATCH /api/products` (ADR 0008, Decisión 6:
 * datos "fríos"). `id` presente = variante ya persistida a actualizar; ausente = alta
 * nueva. Sin `stock` a propósito: ese dato "caliente" solo se edita por
 * `PATCH /api/products/[id]/variants/[variantId]` (evita el lost-update).
 */
export const variantInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Falta el nombre del sabor"),
  image: z.string().trim().min(1).nullable().optional(),
  active: z.boolean().optional(),
  position: z.number().int().nonnegative().optional(),
});

export type VariantInput = z.infer<typeof variantInputSchema>;

/**
 * Array de sabores del payload de producto: opcional (ausente = no tocar
 * sabores, ver `replaceProductVariants`), tope defensivo de tamaño y sin
 * nombres duplicados (case-insensitive, mismo criterio que el índice único
 * real `product_variants(product_id, lower(name))`).
 */
export const variantsInputSchema = z
  .array(variantInputSchema)
  .max(MAX_VARIANTS_PER_PRODUCT, `Un producto admite hasta ${MAX_VARIANTS_PER_PRODUCT} sabores`)
  .optional()
  .refine(
    (variants) => {
      if (!variants) return true;
      const names = variants.map((variant) => variant.name.trim().toLowerCase());
      return new Set(names).size === names.length;
    },
    { message: "Hay sabores con el mismo nombre" }
  );

/**
 * Sincroniza los sabores de un producto contra el payload del form (ADR 0008,
 * Decisión 6): alta de los nuevos (sin `id`), update de nombre/imagen/activo/
 * orden de los existentes (por `id`) y `active=false` de los que ya no vienen
 * en el payload (baja lógica, nunca `DELETE` físico — preserva stock/historial
 * de `order_items.flavor`). Nunca toca `stock`.
 *
 * Nota de implementación (desvío verificado empíricamente del sketch del ADR,
 * ver docs/PROGRESS.md): el índice único real de la tabla es
 * `(product_id, lower(name))`, una expresión — PostgREST no acepta expresiones
 * en `on_conflict` (probado: `on_conflict=product_id,lower(name)` → error
 * Postgres 42703 "column lower does not exist"; `on_conflict=product_id,name`
 * → 42P10 "no unique or exclusion constraint matching"). Por eso el upsert usa
 * `id` (columna simple) como conflict target: a las altas se les asigna un id
 * generado acá mismo (PostgREST exige que todas las filas de un mismo
 * insert/upsert tengan las mismas keys) y a los updates se les pasa su id real.
 */
export async function replaceProductVariants(
  supabase: SupabaseClient,
  productId: string,
  variants: VariantInput[]
): Promise<{ error: string | null }> {
  const { data: existingRows, error: fetchError } = await supabase
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .returns<{ id: string }[]>();

  if (fetchError) return { error: fetchError.message };

  const existingIds = new Set((existingRows ?? []).map((row) => row.id));

  for (const variant of variants) {
    if (variant.id && !existingIds.has(variant.id)) {
      return { error: "Uno de los sabores enviados no pertenece a este producto" };
    }
  }

  if (variants.length > 0) {
    const rows = variants.map((variant, index) => ({
      id: variant.id ?? crypto.randomUUID(),
      product_id: productId,
      name: variant.name,
      image: variant.image ?? null,
      active: variant.active ?? true,
      position: variant.position ?? index,
    }));

    const { error: upsertError } = await supabase
      .from("product_variants")
      .upsert(rows, { onConflict: "id" });

    if (upsertError) {
      if (upsertError.code === UNIQUE_VIOLATION_CODE) {
        return { error: "Hay sabores con el mismo nombre" };
      }
      return { error: upsertError.message };
    }
  }

  const keptIds = new Set(variants.filter((variant) => variant.id).map((variant) => variant.id as string));
  const idsToDeactivate = [...existingIds].filter((id) => !keptIds.has(id));

  if (idsToDeactivate.length > 0) {
    const { error: deactivateError } = await supabase
      .from("product_variants")
      .update({ active: false })
      .in("id", idsToDeactivate);

    if (deactivateError) return { error: deactivateError.message };
  }

  return { error: null };
}
