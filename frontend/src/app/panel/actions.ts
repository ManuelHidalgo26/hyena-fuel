"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../lib/supabase/server";

/**
 * Cierra la sesión del usuario logueado en el panel (server action invocada
 * desde el botón "Cerrar sesión" de `/panel`). Usa el cliente server (lee/
 * escribe las cookies de la request actual) para poder borrar la cookie de
 * sesión; después redirige al login.
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/panel/login");
}
