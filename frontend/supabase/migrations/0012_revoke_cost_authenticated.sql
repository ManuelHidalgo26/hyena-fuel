-- 0012_revoke_cost_authenticated.sql
-- Hardening de seguridad (SEC-COST-AUTH, docs/spec-sec-cost-auth.md). Idempotente.
--
-- Hallazgo: `authenticated` (rol compartido por admin y vendedor; el privilegio de
-- columna es por rol de Postgres, no por claim del JWT) conserva por privilegios por
-- defecto SELECT sobre TODAS las columnas de `products` y `order_items`. La RLS filtra
-- filas, no columnas: un vendedor con su JWT puede pedir directo a PostgREST
-- `products?select=cost` (catálogo activo, `products_public_read`) y
-- `order_items?select=unit_cost` (sus pedidos, `order_items_seller_read`).
--
-- Fix: mismo patrón que 0011 (anon). Revocar SELECT de tabla y re-otorgar solo columnas
-- no sensibles. El panel admin ya NO lee estas columnas con la sesión: desde CA1 usa
-- service role detrás del guard admin. PRECONDICIÓN: ese código tiene que estar
-- deployado en prod ANTES de aplicar esto; si no, /panel, /panel/productos y
-- /panel/pedidos fallan.
--
-- Columnas otorgadas:
--   products: exactamente la lista de 0011 (anon). `id` y `active` además los necesita
--     la subquery de la policy `product_variants_public_read` (corre como invocador).
--     Quedan AFUERA: cost, commission_override_pct, commission_override_amount, legacy_id.
--   order_items: todas menos `unit_cost`. `unit_commission` queda visible a propósito
--     (es la comisión del propio vendedor, ya expuesta agregada en /api/seller/me).
--
-- No se toca: anon (0011), service_role, INSERT/UPDATE/DELETE (bloqueados por RLS
-- `*_admin_all` para no-admin; la app escribe solo con service role), create_order
-- (SECURITY DEFINER, owner postgres), otras tablas.
--
-- ADVERTENCIA: una columna NUEVA en `products` u `order_items` NO será legible por
-- `authenticated` hasta sumarla a estos grants en una migración nueva (lo mismo que
-- 0011 para anon).

revoke select on public.products from authenticated;

grant select (
  id, name, slug, description, price, transfer_price, stock, images, active,
  created_at, updated_at, brand, category, attributes
) on public.products to authenticated;

revoke select on public.order_items from authenticated;

grant select (
  id, order_id, product_id, name, quantity, unit_price, unit_commission, flavor,
  created_at
) on public.order_items to authenticated;

-- Rollback (vuelve al estado previo exacto: SELECT de tabla completo a authenticated;
-- los grants de columna de arriba quedan redundantes e inofensivos):
-- grant select on public.products to authenticated;
-- grant select on public.order_items to authenticated;
