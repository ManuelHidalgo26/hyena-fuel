-- =========================================================
-- HYENA FUEL — products.brand (QA-6)
--
-- Ya aplicado a mano en el proyecto Supabase real (vjjxrrsnbmmkijobrzgi).
-- `0001_init.sql` ya declara `brand` para instalaciones nuevas; este archivo
-- es el que efectivamente la agrega en el ambiente existente, y es
-- idempotente (columna se agrega una sola vez, reaplicar no rompe nada).
-- =========================================================
alter table public.products
  add column if not exists brand text;
