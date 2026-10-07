import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSeller } from "../../../../lib/auth/guards";
import { passwordSchema } from "../../../../lib/auth/password";
import { createClient } from "../../../../lib/supabase/server";

const changePasswordSchema = z.object({
  password: passwordSchema,
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
    // Errores que el vendedor puede corregir (contraseña débil/filtrada o igual a la actual): 400 legible.
    if (error.code === "weak_password") {
      return NextResponse.json(
        { error: "Esa contraseña es muy fácil de adivinar. Probá con una más larga o distinta." },
        { status: 400 }
      );
    }
    if (error.code === "same_password") {
      return NextResponse.json({ error: "La contraseña nueva tiene que ser distinta de la actual" }, { status: 400 });
    }
    console.error("[POST /api/seller/change-password]", error);
    return NextResponse.json({ error: "No se pudo cambiar la contraseña" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
