import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new Error("Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY");
  }

  return key;
}

/**
 * Cliente Supabase con la service role key: bypassa RLS por completo.
 *
 * SOLO server-side: Route Handlers (`src/app/api/**`) y Server Components de
 * `src/app/panel/(app)/**`, siempre después de un guard admin en el mismo
 * archivo. Nunca en Client Components ni bajo `(store)`. El import de
 * "server-only" hace fallar el build si este módulo termina incluido en un
 * bundle de cliente.
 */
export function createAdminClient() {
  const { url } = getSupabasePublicEnv();
  const serviceRoleKey = getServiceRoleKey();

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
