import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "../../../../../../lib/auth/guards";
import { generateTemporaryPassword, MIN_PASSWORD_LENGTH } from "../../../../../../lib/auth/password";
import { createAdminClient } from "../../../../../../lib/supabase/admin";
import { isUuid } from "../../../../../../lib/uuid";

type RouteContext = { params: Promise<{ id: string }> };

const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`)
    .optional(),
});

/**
 * Reset de contraseña de un vendedor (admin, ADR 0003). Si el admin no manda `password`,
 * se genera una temporal y se devuelve una única vez en la respuesta (mismo criterio que
 * el alta en `POST /api/admin/sellers`), para entregarla a mano al vendedor.
 */
export async function POST(request: NextRequest, { params }: RouteContext) {
  const guard = await requireAdmin();
  if (!guard.authorized) return guard.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Id de vendedor inválido" }, { status: 400 });
  }

  let json: unknown = {};
  const rawBody = await request.text();
  if (rawBody) {
    try {
      json = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
    }
  }

  const parsed = resetPasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Contraseña inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  const { data: sellerRow, error: sellerError } = await supabase
    .from("sellers")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (sellerError) {
    console.error("[POST /api/admin/sellers/[id]/reset-password]", sellerError);
    return NextResponse.json({ error: "No se pudo resetear la contraseña" }, { status: 500 });
  }
  if (!sellerRow) {
    return NextResponse.json({ error: "Vendedor no encontrado" }, { status: 404 });
  }

  const generatedPassword = parsed.data.password ? null : generateTemporaryPassword();

  const { error: updateError } = await supabase.auth.admin.updateUserById(id, {
    password: parsed.data.password ?? generatedPassword ?? undefined,
  });

  if (updateError) {
    console.error("[POST /api/admin/sellers/[id]/reset-password] updateUserById", updateError);
    return NextResponse.json({ error: "No se pudo resetear la contraseña" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, temporaryPassword: generatedPassword ?? undefined });
}
