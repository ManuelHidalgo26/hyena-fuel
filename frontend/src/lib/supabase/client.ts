import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicEnv } from "./env";

/**
 * Cliente Supabase para Client Components (browser).
 * Usa la anon key: solo puede leer/escribir lo que RLS permite.
 */
export function createClient() {
  const { url, anonKey } = getSupabasePublicEnv();

  return createBrowserClient(url, anonKey);
}
