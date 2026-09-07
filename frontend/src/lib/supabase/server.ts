import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente Supabase para Server Components / Route Handlers.
 * Usa la anon key + cookies de sesión: solo puede leer/escribir lo que RLS permite.
 * Debe crearse una instancia nueva por request (no compartir entre renders).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Se puede ignorar si hay middleware refrescando la sesión: un Server
          // Component no puede escribir cookies, solo Route Handlers/Server Actions.
        }
      },
    },
  });
}
