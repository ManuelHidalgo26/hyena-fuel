import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSeller } from "../../../../lib/auth/guards";
import { MIN_PASSWORD_LENGTH } from "../../../../lib/auth/password";
import { createClient } from "../../../../lib/supabase/server";

const changePasswordSchema = z.object({
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`),
});

/**
 * Cambio de contraseña propia del vendedor (ADR 0003). Usa el cliente con la sesión del
 * propio usuario (no la Admin API): `auth.updateUser` solo puede tocar la cuenta ya
 * autenticada en esa sesión, así que es estructuralmente imposible cambiar la de otro.
 */
export async function POST(request: NextRequest) {
  const guard = await requireSeller();
  if (!guard.authorized) return guard.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Contraseña inválida", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

  if (error) {
    console.error("[POST /api/seller/change-password]", error);
    return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
