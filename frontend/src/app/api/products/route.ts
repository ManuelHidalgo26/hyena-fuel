import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../lib/auth/guards";
import { createAdminClient } from "../../../lib/supabase/admin";
import { ADMIN_PRODUCT_COLUMNS, mapAdminProduct, type AdminProductRow } from "../../../lib/products";

/**
 * La lectura pública de productos hoy es directa desde Server Components
 * (`lib/api/products.api.ts`, ver Sesión 4 de `docs/PROGRESS.md`), no pasa
 * por este Route Handler. Este archivo solo trae el `POST` admin (spec Fase 1,
 * tarea 6); migrar la lectura pública a `/api` es otra tarea, fuera de alcance acá.
 */

/** Código Postgres de violación de constraint único (`products.slug`). */
const UNIQUE_VIOLATION_CODE = "23505";

const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "Falta el nombre"),
    slug: z
      .string()
      .trim()
      .min(1, "Falta el slug")
      .regex(/^[a-z0-9-]+$/, "El slug solo admite minúsculas, números y guiones"),
    description: z.string().trim().min(1).nullable().optional(),
    price: z.number().nonnegative("El precio no puede ser negativo"),
    transferPrice: z.number().nonnegative("El precio de transferencia no puede ser negativo").nullable().optional(),
    cost: z.number().nonnegative("El costo no puede ser negativo").optional(),
    stock: z.number().int().nonnegative("El stock no puede ser negativo"),
    images: z.array(z.string().trim().min(1)).optional(),
    brand: z.string().trim().min(1).nullable().optional(),
    active: z.boolean().optional(),
    commissionOverridePct: z.number().min(0).nullable().optional(),
    commissionOverrideAmount: z.number().min(0).nullable().optional(),
  })
  .refine((data) => data.commissionOverridePct == null || data.commissionOverrideAmount == null, {
    message: "No se puede combinar override de comisión por porcentaje y por monto fijo",
    path: ["commissionOverrideAmount"],
  });

/** Alta de producto (admin). A diferencia del checkout público, acepta `cost` y overrides de comisión. */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createProductSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de producto inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      price: input.price,
      transfer_price: input.transferPrice ?? null,
      cost: input.cost ?? 0,
      stock: input.stock,
      images: input.images ?? [],
      brand: input.brand ?? null,
      active: input.active ?? true,
      commission_override_pct: input.commissionOverridePct ?? null,
      commission_override_amount: input.commissionOverrideAmount ?? null,
    })
    .select(ADMIN_PRODUCT_COLUMNS)
    .single()
    .returns<AdminProductRow>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Ya existe un producto con ese slug" }, { status: 409 });
    }
    console.error("[POST /api/products]", error);
    return NextResponse.json({ error: "No se pudo crear el producto" }, { status: 500 });
  }

  return NextResponse.json(mapAdminProduct(data), { status: 201 });
}
