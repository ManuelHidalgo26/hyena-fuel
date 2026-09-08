-- =========================================================
-- HYENA FUEL — Esquema Postgres (Supabase) — Fase 1
-- Fuente: docs/adr/0002-modelo-de-datos.md
--
-- NOTA (QA-6 / housekeeping Sesión 6): este archivo documenta el esquema
-- que YA está aplicado en el proyecto Supabase real (vjjxrrsnbmmkijobrzgi).
-- Se escribe ahora, versionado, para que el esquema sea reproducible desde
-- el repo. Es 100% idempotente (create table/index "if not exists", policies
-- con "drop policy if exists" previo) para poder reaplicarlo sin romper la
-- base ya viva. Incluye `products.brand`, que en la base real ya existe pero
-- no estaba en el SQL de referencia del ADR (ver también 0002_products_brand.sql).
-- =========================================================
create extension if not exists "pgcrypto";  -- gen_random_uuid()
create extension if not exists "citext";     -- email case-insensitive

-- ---------- Helpers ----------
create or replace function public.is_admin()
returns boolean language sql stable as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ---------- sellers ----------
create table if not exists public.sellers (
  id                     uuid primary key,            -- = auth.users.id (seteado por la app)
  code                   text not null unique,        -- ej. JUAN10
  name                   text not null,
  phone                  text,
  default_commission_pct numeric(5,2) not null default 0 check (default_commission_pct >= 0),
  active                 boolean not null default true,
  created_at             timestamptz not null default now()
);
create index if not exists sellers_active_idx on public.sellers(active);

-- ---------- products ----------
create table if not exists public.products (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  slug                       text not null unique,
  description                text,
  price                      numeric(12,2) not null check (price >= 0),   -- lista / MercadoPago
  transfer_price             numeric(12,2) check (transfer_price >= 0),   -- transferencia (~10% off)
  cost                       numeric(12,2) not null default 0 check (cost >= 0),
  brand                      text,
  commission_override_pct    numeric(5,2)  check (commission_override_pct >= 0),
  commission_override_amount numeric(12,2) check (commission_override_amount >= 0),
  stock                      integer not null default 0 check (stock >= 0),
  images                     text[] not null default '{}',
  active                     boolean not null default true,
  legacy_id                  text unique,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now(),
  constraint commission_override_one check (
    commission_override_pct is null or commission_override_amount is null
  )
);
create index if not exists products_active_idx on public.products(active);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ---------- commission_payments (liquidaciones) ----------
create table if not exists public.commission_payments (
  id         uuid primary key default gen_random_uuid(),
  seller_id  uuid not null references public.sellers(id) on delete restrict,
  period     text not null,                            -- ej. '2026-09'
  amount     numeric(12,2) not null default 0 check (amount >= 0),
  status     text not null default 'pending' check (status in ('pending','paid')),
  paid_at    timestamptz,
  notes      text,
  created_at timestamptz not null default now()
);
create index if not exists commission_payments_seller_idx on public.commission_payments(seller_id);
create index if not exists commission_payments_status_idx on public.commission_payments(status);

-- ---------- orders ----------
create table if not exists public.orders (
  id                    uuid primary key default gen_random_uuid(),
  customer_name         text not null,
  customer_email        text,
  customer_phone        text,
  customer_address      text,
  payment_method        text not null check (payment_method in ('transferencia','mercadopago')),
  delivery_method       text not null default 'envio' check (delivery_method in ('envio','retiro')),
  status                text not null default 'pending'
                          check (status in ('pending','confirmed','dispatched','paid','cancelled')),
  subtotal              numeric(12,2) not null default 0,   -- Σ(precio lista · qty)
  discount              numeric(12,2) not null default 0,   -- ahorro transferencia + cupones
  shipping_cost         numeric(12,2) not null default 0,
  total_final           numeric(12,2) not null default 0,   -- subtotal - discount + shipping_cost
  seller_id             uuid references public.sellers(id) on delete restrict,
  attribution_source    text check (attribution_source in ('link','manual')),
  commission_total      numeric(12,2) not null default 0,   -- congelada al crear
  commission_payment_id uuid references public.commission_payments(id) on delete set null,
  payment_ref           text,                                -- id preferencia/pago MercadoPago
  legacy_id             text unique,
  created_at            timestamptz not null default now()
);
create index if not exists orders_seller_idx on public.orders(seller_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at);
create index if not exists orders_commission_payment_idx on public.orders(commission_payment_id);

-- ---------- order_items ----------
create table if not exists public.order_items (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders(id) on delete cascade,
  product_id      uuid references public.products(id) on delete set null,
  name            text not null,                        -- congelado
  quantity        integer not null check (quantity > 0),
  unit_price      numeric(12,2) not null default 0,     -- precio lista congelado
  unit_cost       numeric(12,2) not null default 0,     -- costo congelado
  unit_commission numeric(12,2) not null default 0,     -- comisión/unidad congelada
  created_at      timestamptz not null default now()
);
create index if not exists order_items_order_idx on public.order_items(order_id);
create index if not exists order_items_product_idx on public.order_items(product_id);

-- ---------- newsletter ----------
create table if not exists public.newsletter (
  id         uuid primary key default gen_random_uuid(),
  email      citext not null unique,
  legacy_id  text unique,
  created_at timestamptz not null default now()
);

-- ---------- reviews ----------
create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  text       text not null,
  rating     smallint not null check (rating between 1 and 5),
  approved   boolean not null default false,
  product_id uuid references public.products(id) on delete set null,
  legacy_id  text unique,
  created_at timestamptz not null default now()
);
create index if not exists reviews_approved_idx on public.reviews(approved);
create index if not exists reviews_product_idx on public.reviews(product_id);

-- =========================== RLS ===========================
alter table public.products            enable row level security;
alter table public.orders              enable row level security;
alter table public.order_items         enable row level security;
alter table public.sellers             enable row level security;
alter table public.commission_payments enable row level security;
alter table public.newsletter          enable row level security;
alter table public.reviews             enable row level security;

-- products
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products
  for select to anon, authenticated using (active = true);
drop policy if exists products_admin_all on public.products;
create policy products_admin_all on public.products
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- orders
drop policy if exists orders_admin_all on public.orders;
create policy orders_admin_all on public.orders
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists orders_seller_read on public.orders;
create policy orders_seller_read on public.orders
  for select to authenticated using (seller_id = auth.uid());

-- order_items
drop policy if exists order_items_admin_all on public.order_items;
create policy order_items_admin_all on public.order_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists order_items_seller_read on public.order_items;
create policy order_items_seller_read on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.seller_id = auth.uid())
  );

-- sellers
drop policy if exists sellers_admin_all on public.sellers;
create policy sellers_admin_all on public.sellers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists sellers_self_read on public.sellers;
create policy sellers_self_read on public.sellers
  for select to authenticated using (id = auth.uid());

-- commission_payments
drop policy if exists commission_payments_admin_all on public.commission_payments;
create policy commission_payments_admin_all on public.commission_payments
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists commission_payments_seller_read on public.commission_payments;
create policy commission_payments_seller_read on public.commission_payments
  for select to authenticated using (seller_id = auth.uid());

-- newsletter (alta vía service role)
drop policy if exists newsletter_admin_all on public.newsletter;
create policy newsletter_admin_all on public.newsletter
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- reviews (alta vía service role)
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews
  for select to anon, authenticated using (approved = true);
drop policy if exists reviews_admin_all on public.reviews;
create policy reviews_admin_all on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
