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
 * SOLO se debe usar dentro de Route Handlers (`src/app/api/**`), nunca en
 * Server/Client Components. El import de "server-only" hace fallar el build
 * si este módulo termina incluido en un bundle de cliente.
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
