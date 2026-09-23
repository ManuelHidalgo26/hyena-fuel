import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente Supabase de lectura pública, SIN `cookies()` (ADR 0009 D3).
 * Anon key + RLS, sin sesión. Habilita ISR en la tienda pública: al no leer
 * cookies, la ruta que lo usa puede quedar fuera del render dinámico.
 *
 * Uso exclusivo de `lib/api/products.api.ts` (lecturas públicas de catálogo).
 * Prohibido para escrituras, para todo lo que dependa de la sesión y para
 * cualquier `select` que incluya columnas de negocio (`cost`, overrides de
 * comisión). Para eso sigue existiendo `lib/supabase/server.ts` (panel/guards)
 * y `lib/supabase/admin.ts` (service role).
 */
export function createPublicClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createSupabaseClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
