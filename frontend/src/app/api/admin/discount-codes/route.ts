import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../lib/auth/guards";
import { createAdminClient } from "../../../../lib/supabase/admin";
import {
  DISCOUNT_CODE_COLUMNS,
  deriveDiscountCodeStatus,
  discountCodeFormatSchema,
  mapDiscountCode,
  remainingDiscountCodeUses,
  type DiscountCode,
  type DiscountCodeRow,
} from "../../../../lib/discountCodes";

/** Código Postgres de violación de constraint único (`discount_codes.code`). */
const UNIQUE_VIOLATION_CODE = "23505";
/** Código Postgres de violación de check constraint (ej. `discount_codes_pct_range`/`_window`). */
const CHECK_VIOLATION_CODE = "23514";

const createDiscountCodeSchema = z
  .object({
    code: discountCodeFormatSchema,
    type: z.enum(["pct", "fixed"]),
    value: z.number().positive("El valor debe ser mayor a 0"),
    maxUses: z.number().int().positive("Los usos máximos deben ser mayor a 0").optional(),
    minPurchase: z.number().min(0, "La compra mínima no puede ser negativa").optional(),
    startsAt: z.iso.datetime({ offset: true, message: "Fecha de inicio inválida" }).optional(),
    expiresAt: z.iso.datetime({ offset: true, message: "Fecha de fin inválida" }).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "pct" && data.value > 100) {
      ctx.addIssue({ code: "custom", path: ["value"], message: "El porcentaje no puede superar 100" });
    }
    if (data.startsAt && data.expiresAt && new Date(data.expiresAt) <= new Date(data.startsAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "La fecha de fin debe ser posterior a la de inicio",
      });
    }
    // D3 (ADR 0010, decisión abierta cerrada por el cliente): exigir al menos usos O
    // vencimiento al crear, para que no queden códigos eternos por olvido.
    if (data.maxUses === undefined && data.expiresAt === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["maxUses"],
        message: "Definí una cantidad de usos, una fecha límite, o ambas",
      });
    }
  });

type CreateDiscountCodeInput = z.infer<typeof createDiscountCodeSchema>;

function mapDiscountCodeResponse(code: DiscountCode) {
  return {
    ...code,
    status: deriveDiscountCodeStatus(code),
    remainingUses: remainingDiscountCodeUses(code),
  };
}

/** Listado completo de códigos para el panel admin, con estado derivado y usos restantes (spec §7.1). */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .select(DISCOUNT_CODE_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<DiscountCodeRow[]>();

  if (error) {
    console.error("[GET /api/admin/discount-codes]", error);
    return NextResponse.json({ error: "No se pudieron obtener los códigos" }, { status: 500 });
  }

  return NextResponse.json((data ?? []).map(mapDiscountCode).map(mapDiscountCodeResponse));
}

/** Alta de código (ADR 0010): el admin lo escribe, se normaliza a mayúsculas (D7). */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createDiscountCodeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de código inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return createDiscountCode(parsed.data);
}

async function createDiscountCode(input: CreateDiscountCodeInput): Promise<NextResponse> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("discount_codes")
    .insert({
      code: input.code,
      type: input.type,
      value: input.value,
      max_uses: input.maxUses ?? null,
      min_purchase: input.minPurchase ?? null,
      starts_at: input.startsAt ?? null,
      expires_at: input.expiresAt ?? null,
    })
    .select(DISCOUNT_CODE_COLUMNS)
    .single()
    .returns<DiscountCodeRow>();

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
    console.error("[POST /api/admin/discount-codes]", error);
    return NextResponse.json({ error: "No se pudo crear el código" }, { status: 500 });
  }

  return NextResponse.json(mapDiscountCodeResponse(mapDiscountCode(data)), { status: 201 });
}
