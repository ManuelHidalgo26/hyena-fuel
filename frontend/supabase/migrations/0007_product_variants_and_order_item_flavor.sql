-- 0007_product_variants_and_order_item_flavor.sql
-- ADR 0008 — Inventario, imagen y selector por sabor (variantes reales). Idempotente.
-- On-disk hoy: 0001..0006. La RPC create_order vigente es la de 0003 (14 args).
-- p_note (ADR 0006) NO está aplicado a la firma viva; no se toca en esta migración.

-- 1) Tabla de variantes (sabores con inventario real).
create table if not exists public.product_variants (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id) on delete cascade,
  name        text not null,                 -- sabor, ej. "Chocolate"
  image       text,                          -- imagen del sabor; null => usa la principal del producto
  stock       integer not null default 0 check (stock >= 0),
  position    integer not null default 0,    -- orden en el selector
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create unique index if not exists product_variants_product_name_idx
  on public.product_variants(product_id, lower(name));
create index if not exists product_variants_product_idx on public.product_variants(product_id);
create index if not exists product_variants_active_idx  on public.product_variants(product_id, active);

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at before update on public.product_variants
  for each row execute function public.set_updated_at();  -- helper ya definido en 0001_init.sql

-- 2) RLS: espeja products (público lee variantes activas de productos activos; admin ALL).
alter table public.product_variants enable row level security;

drop policy if exists product_variants_public_read on public.product_variants;
create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated
  using (active = true
         and exists (select 1 from public.products p
                     where p.id = product_id and p.active = true));

drop policy if exists product_variants_admin_all on public.product_variants;
create policy product_variants_admin_all on public.product_variants
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3) Snapshot del sabor por línea (congelado, nullable, backward-compatible).
alter table public.order_items add column if not exists flavor text;

-- 4) RPC create_order: MISMA firma (14 args). El sabor viaja dentro de p_items (jsonb).
create or replace function public.create_order(
  p_customer_name text, p_customer_email text, p_customer_phone text, p_customer_address text,
  p_payment_method text, p_delivery_method text,
  p_subtotal numeric, p_discount numeric, p_shipping_cost numeric, p_total_final numeric,
  p_seller_id uuid, p_attribution_source text, p_commission_total numeric, p_items jsonb
)
returns setof public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid; v_item jsonb; v_product_id uuid; v_quantity integer;
  v_product_name text; v_flavor text; v_updated_rows integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden no tiene ítems';
  end if;

  insert into public.orders (
    customer_name, customer_email, customer_phone, customer_address,
    payment_method, delivery_method, subtotal, discount, shipping_cost, total_final,
    seller_id, attribution_source, commission_total
  ) values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address,
    p_payment_method, p_delivery_method, p_subtotal, p_discount, p_shipping_cost, p_total_final,
    p_seller_id, p_attribution_source, p_commission_total
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id   := (v_item ->> 'product_id')::uuid;
    v_quantity     := (v_item ->> 'quantity')::integer;
    v_product_name := v_item ->> 'name';
    v_flavor       := nullif(btrim(v_item ->> 'flavor'), '');

    if v_flavor is null then
      -- Producto SIN sabores: descuento a nivel producto (idéntico a hoy).
      update public.products
         set stock = stock - v_quantity
       where id = v_product_id and active = true and stock >= v_quantity;
    else
      -- Producto CON sabores: descuento a nivel variante (atómico, mismo patrón).
      update public.product_variants pv
         set stock = pv.stock - v_quantity
       where pv.product_id = v_product_id
         and lower(pv.name) = lower(v_flavor)
         and pv.active = true
         and pv.stock >= v_quantity
         and exists (select 1 from public.products p
                     where p.id = v_product_id and p.active = true);
    end if;

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows = 0 then
      raise exception using errcode = 'HY001',
        message = format('Stock insuficiente de "%s%s"',
          coalesce(v_product_name, v_product_id::text),
          case when v_flavor is null then '' else ' — ' || v_flavor end);
    end if;

    insert into public.order_items (
      order_id, product_id, name, quantity, unit_price, unit_cost, unit_commission, flavor
    ) values (
      v_order_id, v_product_id, v_product_name, v_quantity,
      (v_item ->> 'unit_price')::numeric, (v_item ->> 'unit_cost')::numeric,
      (v_item ->> 'unit_commission')::numeric, v_flavor
    );
  end loop;

  return query select * from public.orders where id = v_order_id;
end; $$;

revoke all on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb
) from public;
grant execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb
) to service_role;
