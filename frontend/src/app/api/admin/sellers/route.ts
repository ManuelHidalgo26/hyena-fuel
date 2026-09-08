import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../lib/auth/guards";
import { generateTemporaryPassword, MIN_PASSWORD_LENGTH } from "../../../../lib/auth/password";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { SELLER_COLUMNS, mapSeller, sellerCodeSchema, type Seller, type SellerRow } from "../../../../lib/sellers";

/** Código Postgres de violación de constraint único (`sellers.code`). */
const UNIQUE_VIOLATION_CODE = "23505";

type AdminClient = ReturnType<typeof createAdminClient>;

/** Vendedor + email de su cuenta de auth (no vive en `sellers`, se resuelve aparte). */
type SellerWithEmail = Seller & { email: string | null };

const createSellerSchema = z.object({
  email: z.email("Email inválido"),
  name: z.string().trim().min(1, "Falta el nombre"),
  phone: z.string().trim().min(1).optional(),
  code: sellerCodeSchema,
  defaultCommissionPct: z.number().min(0, "La comisión no puede ser negativa"),
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    .optional(),
});

type CreateSellerInput = z.infer<typeof createSellerSchema>;

/** Listado de vendedores para el panel admin, con el email de su cuenta de auth. */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sellers")
    .select(SELLER_COLUMNS)
    .order("created_at", { ascending: false })
    .returns<SellerRow[]>();

  if (error) {
    console.error("[GET /api/admin/sellers]", error);
    return NextResponse.json({ error: "No se pudieron obtener los vendedores" }, { status: 500 });
  }

  const sellers = await attachEmails(supabase, (data ?? []).map(mapSeller));
  return NextResponse.json(sellers);
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

async function attachEmails(supabase: AdminClient, sellers: Seller[]): Promise<SellerWithEmail[]> {
  return Promise.all(
    sellers.map(async (seller) => {
      const { data } = await supabase.auth.admin.getUserById(seller.id);
      return { ...seller, email: data.user?.email ?? null };
    })
  );
}
