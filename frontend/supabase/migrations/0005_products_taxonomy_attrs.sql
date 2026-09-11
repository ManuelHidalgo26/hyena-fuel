-- 0005_products_taxonomy_attrs.sql
-- ADR 0005 — Taxonomía + atributos de producto (Fase 2). Idempotente.
-- Renumerada de 0004 -> 0005: el 0004 lo tomó el storage de imágenes (ADR 0007).
-- Aditivo y sin riesgo: agrega dos columnas de catálogo (datos públicos, no
-- sensibles) + un índice. Los 20 productos existentes quedan con category=null y
-- attributes={} (backfill manual posterior; degradación elegante en la UI).

alter table public.products add column if not exists category   text;
alter table public.products add column if not exists attributes jsonb not null default '{}'::jsonb;
create index if not exists products_category_idx on public.products(category);

-- reviews.product_id YA existe (0001_init.sql, ADR 0002 #9). No se toca.
