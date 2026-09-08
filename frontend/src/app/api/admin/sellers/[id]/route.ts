import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../lib/uuid";
import { SELLER_COLUMNS, mapSeller, sellerCodeSchema, type SellerRow } from "../../../../../lib/sellers";

/** Código Postgres de violación de constraint único (`sellers.code`). */
const UNIQUE_VIOLATION_CODE = "23505";

/** `ban_duration` "para siempre" que acepta la Admin API de Supabase (~100 años, ADR 0003). */
const PERMANENT_BAN_DURATION = "876000h";

type RouteContext = { params: Promise<{ id: string }> };

const updateSellerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    phone: z.string().trim().min(1).nullable().optional(),
    code: sellerCodeSchema.optional(),
    defaultCommissionPct: z.number().min(0, "La comisión no puede ser negativa").optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No hay campos para actualizar" });

type UpdateSellerInput = z.infer<typeof updateSellerSchema>;

/** Edita la ficha del vendedor (admin): nombre, teléfono, código, comisión default, activo. */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de vendedor inválido" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateSellerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de vendedor inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sellers")
    .update(buildSellerUpdate(parsed.data))
    .eq("id", id)
    .select(SELLER_COLUMNS)
    .maybeSingle()
    .returns<SellerRow | null>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Ya existe un vendedor con ese código" }, { status: 409 });
    }
    console.error("[PATCH /api/admin/sellers/[id]]", error);
    return NextResponse.json({ error: "No se pudo actualizar el vendedor" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
  }

  return NextResponse.json(mapSeller(data));
}

/**
 * Baja de vendedor (admin, ADR 0003): soft-delete (`active=false`, preserva historial de
 * órdenes) + baneo de la cuenta de auth (bloquea el login de verdad).
 */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de vendedor inválido" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sellers")
    .update({ active: false })
    .eq("id", id)
    .select(SELLER_COLUMNS)
    .maybeSingle()
    .returns<SellerRow | null>();

  if (error) {
    console.error("[DELETE /api/admin/sellers/[id]]", error);
    return NextResponse.json({ error: "No se pudo dar de baja al vendedor" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
  }

  const { error: banError } = await supabase.auth.admin.updateUserById(id, {
    ban_duration: PERMANENT_BAN_DURATION,
  });

  if (banError) {
    console.error("[DELETE /api/admin/sellers/[id]] ban", banError);
    return NextResponse.json(
      { error: "El vendedor quedó inactivo pero no se pudo bloquear su acceso" },
      { status: 500 }
    );
  }

  return NextResponse.json(mapSeller(data));
}

/** Mapea el input camelCase ya validado a las columnas snake_case a actualizar (solo las presentes). */
function buildSellerUpdate(input: UpdateSellerInput): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (input.name !== undefined) update.name = input.name;
  if (input.phone !== undefined) update.phone = input.phone;
  if (input.code !== undefined) update.code = input.code;
  if (input.defaultCommissionPct !== undefined) update.default_commission_pct = input.defaultCommissionPct;
  if (input.active !== undefined) update.active = input.active;

  return update;
}
