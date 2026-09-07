import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { getProductByKey } from "../../../../lib/api/products.api";
import { ADMIN_PRODUCT_COLUMNS, mapAdminProduct, type AdminProductRow } from "../../../../lib/products";
import { isUuid } from "../../../../lib/uuid";

/** Código Postgres de violación de constraint único (`products.slug`). */
const UNIQUE_VIOLATION_CODE = "23505";

type RouteContext = { params: Promise<{ key: string }> };

const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    slug: z
      .string()
      .trim()
      .min(1)
      .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones")
      .optional(),
    description: z.string().trim().min(1).nullable().optional(),
    price: z.number().nonnegative("El precio no puede ser negativo").optional(),
    transferPrice: z.number().nonnegative("El precio de transferencia no puede ser negativo").nullable().optional(),
    cost: z.number().nonnegative("El costo no puede ser negativo").optional(),
    stock: z.number().int().nonnegative("El stock no puede ser negativo").optional(),
    images: z.array(z.string().trim().min(1)).optional(),
    brand: z.string().trim().min(1).nullable().optional(),
    active: z.boolean().optional(),
    commissionOverridePct: z.number().min(0).nullable().optional(),
    commissionOverrideAmount: z.number().min(0).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No hay campos para actualizar" })
  .refine((data) => data.commissionOverridePct == null || data.commissionOverrideAmount == null, {
    message: "No se puede combinar override de comisión por porcentaje y por monto fijo",
    path: ["commissionOverrideAmount"],
  });

type UpdateProductInput = z.infer<typeof updateProductSchema>;

/** Resuelve un producto activo por `slug`, o por `id` si `key` es un uuid. Público (RLS: active=true). */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  const { key } = await params;
  const product = await getProductByKey(key);

  if (!product) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json(product);
}

/** Edita un producto por id (admin). Acepta `cost`, `brand` y overrides de comisión. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { key } = await params;
  if (!isUuid(key)) {
    return NextResponse.json({ error: "Id de producto inválido" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateProductSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de producto inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update(buildProductUpdate(parsed.data))
    .eq("id", key)
    .select(ADMIN_PRODUCT_COLUMNS)
    .maybeSingle()
    .returns<AdminProductRow | null>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Ya existe un producto con ese slug" }, { status: 409 });
    }
    console.error("[PATCH /api/products/[key]]", error);
    return NextResponse.json({ error: "No se pudo actualizar el producto" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json(mapAdminProduct(data));
}

/**
 * Baja de producto (admin). Soft-delete (`active=false`): no se borra la fila para que
 * `order_items.product_id` de órdenes históricas siga apuntando a un producto real (ADR 0002 #8).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { key } = await params;
  if (!isUuid(key)) {
    return NextResponse.json({ error: "Id de producto inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .update({ active: false })
    .eq("id", key)
    .select(ADMIN_PRODUCT_COLUMNS)
    .maybeSingle()
    .returns<AdminProductRow | null>();

  if (error) {
    console.error("[DELETE /api/products/[key]]", error);
    return NextResponse.json({ error: "No se pudo eliminar el producto" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
  }

  return NextResponse.json(mapAdminProduct(data));
}

/** Mapea el input camelCase ya validado a las columnas snake_case a actualizar (solo las presentes). */
function buildProductUpdate(input: UpdateProductInput): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.slug !== undefined) update.slug = input.slug;
  if (input.description !== undefined) update.description = input.description;
  if (input.price !== undefined) update.price = input.price;
  if (input.transferPrice !== undefined) update.transfer_price = input.transferPrice;
  if (input.cost !== undefined) update.cost = input.cost;
  if (input.stock !== undefined) update.stock = input.stock;
  if (input.images !== undefined) update.images = input.images;
  if (input.brand !== undefined) update.brand = input.brand;
  if (input.active !== undefined) update.active = input.active;
  if (input.commissionOverridePct !== undefined) update.commission_override_pct = input.commissionOverridePct;
  if (input.commissionOverrideAmount !== undefined)
    update.commission_override_amount = input.commissionOverrideAmount;

  return update;
}
