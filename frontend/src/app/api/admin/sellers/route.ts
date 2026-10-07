import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../lib/auth/guards";
import { generateTemporaryPassword, passwordSchema } from "../../../../lib/auth/password";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { SELLER_COLUMNS, mapSeller, sellerCodeSchema, type SellerRow } from "../../../../lib/sellers";
import { listSellersForAdmin, type SellerWithEmail } from "../../../../lib/admin/sellers";

/** Código Postgres de violación de constraint único (`sellers.code`). */
const UNIQUE_VIOLATION_CODE = "23505";


const createSellerSchema = z.object({
  email: z.email("Email inválido"),
  name: z.string().trim().min(1, "Falta el nombre"),
  phone: z.string().trim().min(1).optional(),
  code: sellerCodeSchema,
  defaultCommissionPct: z.number().min(0, "La comisión no puede ser negativa"),
  password: passwordSchema.optional(),
});

type CreateSellerInput = z.infer<typeof createSellerSchema>;

/** Listado de vendedores para el panel admin, con el email de su cuenta de auth y sus ventas. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  try {
    return NextResponse.json(await listSellersForAdmin(createAdminClient()));
  } catch (error) {
    console.error("[GET /api/admin/sellers]", error);
    return NextResponse.json({ error: "No se pudieron obtener los vendedores" }, { status: 500 });
  }
}

/**
 * Alta de vendedor (ADR 0003): crea el usuario de auth con `app_metadata.role='seller'`
 * y su fila en `sellers`. Si el admin no manda `password`, se genera una temporal y se
 * devuelve una única vez en la respuesta (no se guarda en ningún lado en texto plano).
 */
export async function POST(request: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = createSellerSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Datos de vendedor inválidos", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  return createSeller(parsed.data);
}

async function createSeller(input: CreateSellerInput): Promise<NextResponse> {
  const supabase = createAdminClient();
  const generatedPassword = input.password ? null : generateTemporaryPassword();

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email,
    password: input.password ?? generatedPassword ?? undefined,
    email_confirm: true,
    app_metadata: { role: "seller" },
  });

  if (authError || !authData.user) {
    if (isEmailAlreadyRegistered(authError)) {
      return NextResponse.json({ error: "Ya existe una cuenta con ese email" }, { status: 409 });
    }
    console.error("[POST /api/admin/sellers] createUser", authError);
    return NextResponse.json({ error: "No se pudo crear el vendedor" }, { status: 500 });
  }

  const { data: sellerRow, error: insertError } = await supabase
    .from("sellers")
    .insert({
      id: authData.user.id,
      code: input.code,
      name: input.name,
      phone: input.phone ?? null,
      default_commission_pct: input.defaultCommissionPct,
    })
    .select(SELLER_COLUMNS)
    .single()
    .returns<SellerRow>();

  if (insertError) {
    // El auth user quedaría huérfano (sin fila `sellers`) si no lo revertimos acá.
    await supabase.auth.admin.deleteUser(authData.user.id);

    if (insertError.code === UNIQUE_VIOLATION_CODE) {
      return NextResponse.json({ error: "Ya existe un vendedor con ese código" }, { status: 409 });
    }
    console.error("[POST /api/admin/sellers] insert sellers", insertError);
    return NextResponse.json({ error: "No se pudo crear el vendedor" }, { status: 500 });
  }

  const seller: SellerWithEmail = { ...mapSeller(sellerRow), email: input.email };
  return NextResponse.json({ seller, temporaryPassword: generatedPassword ?? undefined }, { status: 201 });
}

function isEmailAlreadyRegistered(error: { code?: string } | null): boolean {
  return error?.code === "email_exists" || error?.code === "user_already_exists";
}
