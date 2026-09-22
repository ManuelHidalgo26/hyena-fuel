import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../lib/auth/guards";
import { createAdminClient } from "../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../lib/uuid";
import {
  DISCOUNT_CODE_COLUMNS,
  deriveDiscountCodeStatus,
  discountCodeFormatSchema,
  mapDiscountCode,
  remainingDiscountCodeUses,
  type DiscountCode,
  type DiscountCodeRow,
} from "../../../../../lib/discountCodes";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Código Postgres de violación de constraint único (`discount_codes.code`). */
const UNIQUE_VIOLATION_CODE = "23505";
/** Código Postgres de violación de check constraint (ej. `discount_codes_pct_range`/`_window`). */
const CHECK_VIOLATION_CODE = "23514";

type RouteContext = { params: Promise<{ id: string }> };

const updateDiscountCodeSchema = z
  .object({
    // `code`/`type` técnicamente editables (spec §8: "no se permite editar code/type de un
    // código con uses_count > 0"), pero bloqueados una vez que el cupón tuvo algún canje
    // (integridad del reporte de campaña) — ver el chequeo antes del `update` más abajo.
    code: discountCodeFormatSchema.optional(),
    type: z.enum(["pct", "fixed"]).optional(),
    active: z.boolean().optional(),
    maxUses: z.number().int().positive("Los usos máximos deben ser mayor a 0").nullable().optional(),
    minPurchase: z.number().min(0, "La compra mínima no puede ser negativa").nullable().optional(),
    expiresAt: z
      .iso.datetime({ offset: true, message: "Fecha de fin inválida" })
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No hay campos para actualizar" });

type UpdateDiscountCodeInput = z.infer<typeof updateDiscountCodeSchema>;

function mapDiscountCodeResponse(code: DiscountCode) {
  return {
    ...code,
    status: deriveDiscountCodeStatus(code),
    remainingUses: remainingDiscountCodeUses(code),
  };
}

/** Edita/desactiva un código admin (spec §5.3). `{active:false}` es el uso principal (soft-deactivation, sin DELETE físico). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de código inválido" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = updateDiscountCodeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de código inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (parsed.data.code !== undefined || parsed.data.type !== undefined) {
    const usageGuardResponse = await rejectIfAlreadyUsed(supabase, id);
    if (usageGuardResponse) return usageGuardResponse;
  }

  const { data, error } = await supabase
    .from("discount_codes")
    .update(buildDiscountCodeUpdate(parsed.data))
    .eq("id", id)
    .select(DISCOUNT_CODE_COLUMNS)
    .maybeSingle()
    .returns<DiscountCodeRow | null>();

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Ya existe un código con ese nombre" }, { status: 409 });
    }
    if (error.code === CHECK_VIOLATION_CODE) {
      return NextResponse.json(
        { error: "Los datos del código no cumplen las reglas (revisá tipo, valor o fechas)" },
        { status: 400 }
      );
    }
    console.error("[PATCH /api/admin/discount-codes/[id]]", error);
    return NextResponse.json({ error: "No se pudo actualizar el código" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  }

  return NextResponse.json(mapDiscountCodeResponse(mapDiscountCode(data)));
}

/** `null` si se puede seguir; la respuesta 404/409 lista para devolver si no. */
async function rejectIfAlreadyUsed(supabase: AdminClient, id: string): Promise<NextResponse | null> {
  const { data, error } = await supabase
    .from("discount_codes")
    .select("uses_count")
    .eq("id", id)
    .maybeSingle()
    .returns<{ uses_count: number } | null>();

  if (error) {
    console.error("[PATCH /api/admin/discount-codes/[id]] uses_count", error);
    return NextResponse.json({ error: "No se pudo actualizar el código" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  }
  if (data.uses_count > 0) {
    return NextResponse.json(
      { error: "No se puede editar el código ni el tipo de un cupón que ya fue usado" },
      { status: 409 }
    );
  }

  return null;
}

/** Mapea el input camelCase ya validado a las columnas snake_case a actualizar (solo las presentes). */
function buildDiscountCodeUpdate(input: UpdateDiscountCodeInput): Record<string, unknown> {
  const update: Record<string, unknown> = {};

  if (input.code !== undefined) update.code = input.code;
  if (input.type !== undefined) update.type = input.type;
  if (input.active !== undefined) update.active = input.active;
  if (input.maxUses !== undefined) update.max_uses = input.maxUses;
  if (input.minPurchase !== undefined) update.min_purchase = input.minPurchase;
  if (input.expiresAt !== undefined) update.expires_at = input.expiresAt;

  return update;
}
