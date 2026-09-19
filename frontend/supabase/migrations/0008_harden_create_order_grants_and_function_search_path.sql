-- 0008_harden_create_order_grants_and_function_search_path.sql
-- Hardening de seguridad (Supabase advisors post-0007). Idempotente.
-- Ya aplicado a prod (vjjxrrsnbmmkijobrzgi) el 2026-09-19; se versiona para que repo y base coincidan.

-- 1) create_order es SECURITY DEFINER: NO debe ser invocable por anon/authenticated.
--    Confirmado explotable: con la anon key publica se podia POST /rest/v1/rpc/create_order
--    con args arbitrarios (total_final falso, stock drenado, comision/seller_id falsificados),
--    salteando TODA la validacion del Route Handler. La app la llama SOLO por service_role
--    (POST /api/orders -> createAdminClient). `revoke from public` (0003/0007) no alcanza:
--    el grant venia de default privileges directo a anon/authenticated.
revoke execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb
) from anon, authenticated;

-- 2) search_path fijo en funciones propias (advisor 0011 function_search_path_mutable).
--    is_admin usa auth.jwt() (schema-qualified) + operadores de pg_catalog => 'public' es seguro.
--    set_updated_at solo usa now() (pg_catalog) => seguro. NO se tocan grants: is_admin es
--    invocada por las policies RLS en el contexto del rol que consulta (anon/authenticated),
--    revocar su EXECUTE romperia esas lecturas.
alter function public.is_admin() set search_path = public;
alter function public.set_updated_at() set search_path = public;
