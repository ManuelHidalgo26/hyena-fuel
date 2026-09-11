-- 0006_orders_note.sql
-- ADR 0006 — Nota opcional del pedido (Fase 2). Idempotente.
-- Renumerada de 0005 -> 0006 (el 0005 lo toma la taxonomía/atributos, ADR 0005).
--
-- ALCANCE DE ESTA MIGRACIÓN: SOLO la columna nullable `orders.note`. Es aditivo y
-- sin riesgo: la RPC `create_order` vigente inserta columnas explícitas (no incluye
-- `note`), así que la nueva columna simplemente queda NULL en cada alta y NADA del
-- checkout cambia de comportamiento.
--
-- PENDIENTE (NO en este archivo, a propósito): el cambio de la RPC `create_order`
-- que agrega `p_note` y lo inserta (ADR 0006 §Migración, drop de la firma de 14 args
-- + recreación con 15) se aplica JUNTO con la tanda D2 (Zod + CartContext/CartDrawer
-- + panel) y su re-QA acotado del checkout — para no tocar el núcleo del cobro sin
-- verificación. Ver docs/adr/0006-datos-del-comprador-en-el-checkout.md.

alter table public.orders add column if not exists note text;
