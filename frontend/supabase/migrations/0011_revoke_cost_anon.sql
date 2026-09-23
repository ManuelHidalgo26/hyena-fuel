-- 0011_revoke_cost_anon.sql
-- Hardening de seguridad (SEC-COST-ANON, docs/TASKS.md, hallazgo confirmado por el
-- orquestador en producción, 2026-09-23). Idempotente.
--
-- Hallazgo: el rol `anon` tiene SELECT a nivel de COLUMNA sobre TODAS las columnas de
-- `public.products` (incluidas `cost`, `commission_override_pct`,
-- `commission_override_amount` y `legacy_id`), otorgado por privilegios por defecto al
-- crear la tabla (mismo patrón ya documentado en 0008 para `create_order`: el grant vino
-- directo a `anon`/`authenticated`, no vía `public`, así que `revoke ... from public` NO
-- alcanza). La RLS `products_public_read` (0001) SOLO filtra FILAS (`active = true`), no
-- columnas. Como `NEXT_PUBLIC_SUPABASE_ANON_KEY` es pública, cualquiera puede pedir
-- `GET /rest/v1/products?select=cost` directo a PostgREST y leer costos/comisiones,
-- sin pasar por la app ni por `ADMIN_PRODUCT_COLUMNS`.
--
-- Fix: revocar SELECT completo de `products` a `anon` y re-otorgar SOLO las columnas que
-- ya expone el código público (`PRODUCT_COLUMNS`, `frontend/src/lib/api/products.api.ts`)
-- más `active` (necesaria para el `.eq("active", true)` de esas mismas consultas: PostgREST
-- exige SELECT en toda columna usada en un filtro, aunque no se devuelva). `legacy_id`
-- queda afuera a propósito: es un identificador de migración interno, sin uso en la tienda
-- pública ni motivo para ser legible por anon.
--
-- Alcance: SOLO `anon`. `authenticated` no se toca en esta migración — el panel admin
-- (`/panel/productos`, dashboard) lee `products` con el cliente SSR bajo sesión
-- `authenticated`, protegido por `products_admin_all` (RLS, solo filas si `is_admin()`) y
-- por el guard de la app (`getSessionUser().role === "admin"`). Ningún endpoint del
-- código expone `cost` a un `authenticated` no-admin. Reportado aparte (no corregido acá,
-- ver docs/PROGRESS.md): el grant de columna sobre `authenticated` para `products` parece
-- tener el mismo origen que el de `anon` (privilegios por defecto), por lo que un
-- `authenticated` no-admin (vendedor) podría en teoría leer `cost` de productos activos
-- vía PostgREST directo, salteando la app — la RLS de fila sí lo dejaría pasar (productos
-- activos) pero no hay ningún endpoint del código que se lo permita hoy. Requiere decisión
-- explícita de arqui antes de tocar `authenticated` (podría haber dependencias no
-- inventariadas).
--
-- Otras tablas con columnas sensibles (`product_variants`, `order_items`) NO requieren
-- este fix: `product_variants` no tiene columna `cost` (ADR 0008); `order_items` tiene
-- `unit_cost`/`unit_commission` pero NO existe ninguna policy RLS para `anon` sobre esa
-- tabla (solo `order_items_admin_all` y `order_items_seller_read`, ambas `to authenticated`)
-- — sin fila visible, el grant de columna es irrelevante para `anon`.
--
-- ADVERTENCIA: tras aplicar esta migración, cualquier columna NUEVA que se agregue a
-- `products` NO será visible para `anon` hasta que se sume explícitamente a la lista del
-- `grant` de abajo (a diferencia del comportamiento por defecto de hoy, que expone todo).
-- Si se agrega una columna pública nueva (ej. otro campo de ficha), hay que ampliar este
-- grant en una migración nueva.

revoke select on public.products from anon;

grant select (
  id, name, slug, description, price, transfer_price, stock, images, active,
  created_at, updated_at, brand, category, attributes
) on public.products to anon;

-- Rollback (si hiciera falta revertir por completo, ej. algo depende de una columna no
-- listada arriba y no se puede migrar rápido): vuelve al estado previo (todas las
-- columnas visibles a anon, RLS sin cambios).
-- grant select on public.products to anon;
