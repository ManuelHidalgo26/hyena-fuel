-- 0009_discount_codes.sql
-- ADR 0010 — Códigos de descuento (cupones para redes sociales). Idempotente.
-- On-disk previo: 0001..0008. RPC create_order viva = la de 0007/0008 (14 args, flavor-aware).
-- p_note (ADR 0006) NO está aplicado a la firma viva; no se toca en esta migración.
--
-- NO APLICAR A PRODUCCIÓN DESDE ACÁ: el orquestador la aplica a un branch de Supabase
-- para QA; el cliente decide el deploy a la base real.

-- 1) Tabla de códigos.
create table if not exists public.discount_codes (
  id           uuid primary key default gen_random_uuid(),
  code         citext not null unique,
  type         text not null check (type in ('pct','fixed')),
  value        numeric(12,2) not null check (value > 0),
  max_uses     integer check (max_uses is null or max_uses > 0),
  uses_count   integer not null default 0 check (uses_count >= 0),
  min_purchase numeric(12,2) check (min_purchase is null or min_purchase >= 0),
  starts_at    timestamptz,
  expires_at   timestamptz,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint discount_codes_pct_range check (type <> 'pct' or (value > 0 and value <= 100)),
  constraint discount_codes_window     check (starts_at is null or expires_at is null or expires_at > starts_at)
);
create index if not exists discount_codes_active_idx on public.discount_codes(active);
create index if not exists discount_codes_expires_idx on public.discount_codes(expires_at)
  where active = true and expires_at is not null;

drop trigger if exists discount_codes_set_updated_at on public.discount_codes;
create trigger discount_codes_set_updated_at before update on public.discount_codes
  for each row execute function public.set_updated_at();  -- helper de 0001

-- 2) RLS (admin-only; anon sin acceso: ni lee, ni enumera, ni escribe).
alter table public.discount_codes enable row level security;
drop policy if exists discount_codes_admin_all on public.discount_codes;
create policy discount_codes_admin_all on public.discount_codes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- 3) Registro del canje en orders (columnas aditivas, nullable/default — no rompe filas viejas).
alter table public.orders add column if not exists discount_code_id uuid
  references public.discount_codes(id) on delete set null;
alter table public.orders add column if not exists discount_code text;
alter table public.orders add column if not exists discount_code_amount numeric(12,2) not null default 0;
create index if not exists orders_discount_code_idx on public.orders(discount_code_id);

-- 4) RPC create_order: dropear la firma viva (14 args, 0007/0008) y recrear con
--    el canje de cupón embebido (misma transacción que el descuento de stock y el insert).
drop function if exists public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb
);

create or replace function public.create_order(
  p_customer_name        text,
  p_customer_email       text,
  p_customer_phone       text,
  p_customer_address     text,
  p_payment_method       text,
  p_delivery_method      text,
  p_subtotal             numeric,
  p_discount             numeric,
  p_shipping_cost        numeric,
  p_total_final          numeric,
  p_seller_id            uuid,
  p_attribution_source   text,
  p_commission_total     numeric,
  p_items                jsonb,
  p_discount_code_id     uuid    default null,
  p_discount_code        text    default null,
  p_discount_code_amount numeric default 0
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
    seller_id, attribution_source, commission_total,
    discount_code_id, discount_code, discount_code_amount
  ) values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address,
    p_payment_method, p_delivery_method, p_subtotal, p_discount, p_shipping_cost, p_total_final,
    p_seller_id, p_attribution_source, p_commission_total,
    p_discount_code_id, p_discount_code, coalesce(p_discount_code_amount, 0)
  ) returning id into v_order_id;

  -- (a) Descuento de stock atómico por ítem (idéntico a 0007, flavor-aware).
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id   := (v_item ->> 'product_id')::uuid;
    v_quantity     := (v_item ->> 'quantity')::integer;
    v_product_name := v_item ->> 'name';
    v_flavor       := nullif(btrim(v_item ->> 'flavor'), '');

    if v_flavor is null then
      update public.products
         set stock = stock - v_quantity
       where id = v_product_id and active = true and stock >= v_quantity;
    else
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

  -- (b) Canje ATÓMICO del cupón (misma transacción). Guard = fuente de verdad (ADR 0010
  --     Decisión 9): mismo patrón anti-TOCTOU que el `update ... where stock >= qty` de
  --     arriba. Si 0 filas: perdió la carrera por el último uso, venció o se desactivó
  --     entre validar (`resolveDiscountCode`) y canjear.
  if p_discount_code_id is not null then
    update public.discount_codes
       set uses_count = uses_count + 1,
           active = case
                      when max_uses is not null and uses_count + 1 >= max_uses then false
                      else active
                    end
     where id = p_discount_code_id
       and active = true
       and (starts_at is null or now() >= starts_at)
       and (expires_at is null or now() < expires_at)
       and (max_uses is null or uses_count < max_uses);

    get diagnostics v_updated_rows = row_count;
    if v_updated_rows = 0 then
      raise exception using errcode = 'HY002',
        message = 'El código de descuento ya no está disponible';
    end if;
  end if;

  return query select * from public.orders where id = v_order_id;
end; $$;

-- 5) Grants: mismo hardening que 0008 (service_role only; anon/authenticated sin acceso).
revoke all on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric
) from public;
revoke execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric
) from anon, authenticated;
grant execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric
) to service_role;

-- =========================================================
-- pg_cron (defensa SECUNDARIA, OPCIONAL — ADR 0010 Decisión 10 / spec §3.1).
-- NO es la fuente de verdad: el guard del paso 4(b) ya rechaza códigos vencidos/agotados
-- en el instante del canje, sin depender de este barrido. El cron solo prolija la vista
-- admin flipeando `active` de los vencidos (los agotados ya se auto-desactivan en el guard).
-- El estado "vencido" además se DERIVA en la lectura del admin (`deriveDiscountCodeStatus`
-- en `lib/discountCodes.ts`), así que ni siquiera la vista depende de que esto corra.
--
-- Queda comentado a propósito: requiere la extensión `pg_cron` habilitada en el proyecto.
-- Si el cliente la habilita, descomentar y aplicar (es idempotente, `cron.schedule` con el
-- mismo nombre de job actualiza el schedule existente).
--
-- select cron.schedule('deactivate-expired-discount-codes', '*/15 * * * *', $cron$
--   update public.discount_codes
--      set active = false
--    where active = true and expires_at is not null and expires_at <= now();
-- $cron$);
-- =========================================================
