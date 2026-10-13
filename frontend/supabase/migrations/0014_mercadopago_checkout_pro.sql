-- 0014_mercadopago_checkout_pro.sql
-- ADR 0012 / spec-mercadopago §5-6 — Pago con tarjeta con Mercado Pago Checkout Pro.
--
-- Aditiva y compatible hacia atrás: las columnas nuevas son nullable o tienen default y
-- `create_order` suma `p_defer_payment boolean default false` al final, así que el código
-- que hoy corre en producción sigue funcionando igual si esta migración se aplica antes del
-- deploy. La 0013 está reservada para vendedores (Tanda C): las dos son independientes.
--
-- NO APLICAR A PRODUCCIÓN DESDE ACÁ: la aplica el orquestador con OK explícito del usuario.
--
-- Contenido:
--   1) Columnas nuevas en `orders` (+ índices + backfill de `stock_committed_at`).
--   2) Tabla `payment_events` (log de auditoría del webhook, sin datos personales).
--   3) `create_order` de 19 args (dropea la de 18 de la 0010).
--   4) `apply_mercadopago_payment` (aplica un pago de forma atómica e idempotente).

-- =========================================================
-- 1) orders
-- =========================================================
alter table public.orders add column if not exists payment_status text
  check (payment_status in (
    'pending','in_process','in_mediation','approved','rejected','cancelled','refunded','charged_back'
  ));
alter table public.orders add column if not exists payment_status_detail text;
alter table public.orders add column if not exists payment_updated_at timestamptz;
alter table public.orders add column if not exists paid_at timestamptz;
alter table public.orders add column if not exists stock_committed_at timestamptz;
alter table public.orders add column if not exists mp_preference_id text;
alter table public.orders add column if not exists needs_review boolean not null default false;
alter table public.orders add column if not exists review_reason text
  check (review_reason in (
    'sin_stock','monto_distinto','pago_duplicado','pago_en_pedido_cancelado',
    'pago_refunded','pago_charged_back','pago_in_mediation','pago_cancelled'
  ));

create index if not exists orders_payment_ref_idx on public.orders(payment_ref);
create index if not exists orders_needs_review_idx on public.orders(needs_review) where needs_review;

-- Backfill: todos los pedidos existentes descontaron stock al crearse. El guard por
-- `payment_status is null` evita tocar pedidos con tarjeta si la migración se re-ejecuta.
update public.orders
   set stock_committed_at = created_at
 where stock_committed_at is null
   and payment_status is null;

-- =========================================================
-- 2) payment_events
-- =========================================================
create table if not exists public.payment_events (
  id                  bigint generated always as identity primary key,
  order_id            uuid references public.orders(id) on delete set null,
  provider            text not null default 'mercadopago',
  provider_payment_id text not null,
  status              text not null,
  status_detail       text,
  amount              numeric(12,2),
  currency            text,
  date_last_updated   timestamptz,
  outcome             text,
  received_at         timestamptz not null default now()
);
create index if not exists payment_events_order_idx on public.payment_events(order_id);
create index if not exists payment_events_payment_idx on public.payment_events(provider_payment_id);

-- Sin policies para anon/authenticated: solo service role (la RPC y el panel vía admin client).
alter table public.payment_events enable row level security;
revoke all on table public.payment_events from anon, authenticated;
grant all on table public.payment_events to service_role;

-- =========================================================
-- 3) create_order (19 args)
-- =========================================================
-- Dropea la firma viva de la 0010 (18 args) y recrea con 19 (los mismos 18 + p_defer_payment)
-- para no dejar dos overloads huérfanos que PostgREST podría resolver mal.
drop function if exists public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text
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
  p_discount_code_amount numeric default 0,
  p_note                 text    default null,
  p_defer_payment        boolean default false
)
returns setof public.orders language plpgsql security definer set search_path = public as $$
declare
  v_order_id uuid; v_item jsonb; v_product_id uuid; v_quantity integer;
  v_product_name text; v_flavor text; v_updated_rows integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden no tiene ítems';
  end if;

  -- Defensa: solo el pago con tarjeta puede diferir stock y cupón hasta que se apruebe.
  if p_defer_payment and p_payment_method <> 'mercadopago' then
    raise exception using errcode = '22023',
      message = 'Solo un pedido con tarjeta puede diferir el pago';
  end if;

  insert into public.orders (
    customer_name, customer_email, customer_phone, customer_address,
    payment_method, delivery_method, subtotal, discount, shipping_cost, total_final,
    seller_id, attribution_source, commission_total,
    discount_code_id, discount_code, discount_code_amount, note,
    payment_status, stock_committed_at
  ) values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address,
    p_payment_method, p_delivery_method, p_subtotal, p_discount, p_shipping_cost, p_total_final,
    p_seller_id, p_attribution_source, p_commission_total,
    p_discount_code_id, p_discount_code, coalesce(p_discount_code_amount, 0), p_note,
    case when p_defer_payment then 'pending' else null end,
    case when p_defer_payment then null else now() end
  ) returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id   := (v_item ->> 'product_id')::uuid;
    v_quantity     := (v_item ->> 'quantity')::integer;
    v_product_name := v_item ->> 'name';
    v_flavor       := nullif(btrim(v_item ->> 'flavor'), '');

    -- (a) Descuento de stock atómico por ítem (idéntico a 0010, flavor-aware). Con pago
    --     diferido el stock se descuenta recién cuando el pago se aprueba.
    if not p_defer_payment then
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
    end if;

    insert into public.order_items (
      order_id, product_id, name, quantity, unit_price, unit_cost, unit_commission, flavor
    ) values (
      v_order_id, v_product_id, v_product_name, v_quantity,
      (v_item ->> 'unit_price')::numeric, (v_item ->> 'unit_cost')::numeric,
      (v_item ->> 'unit_commission')::numeric, v_flavor
    );
  end loop;

  -- (b) Canje ATÓMICO del cupón (ADR 0010 Decisión 9). Con pago diferido el uso se registra
  --     al aprobarse el pago (`apply_mercadopago_payment`), no acá.
  if p_discount_code_id is not null and not p_defer_payment then
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

-- Grants: service_role only. `revoke ... from public` NO alcanza para anon/authenticated
-- (son roles con membresía propia en Supabase): hay que revocarles el EXECUTE explícito.
revoke all on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text, boolean
) from public;
revoke execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text, boolean
) from public, anon, authenticated;
grant execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text, boolean
) to service_role;

-- =========================================================
-- 4) apply_mercadopago_payment
-- =========================================================
-- Aplica un pago ya consultado a la API de Mercado Pago (el webhook y la vuelta del
-- comprador pasan por acá). Atómica e idempotente: bloquea la fila del pedido y la
-- transición a `approved` ocurre una sola vez (guard `paid_at is null`).
--
-- `p_amount` es `transaction_amount` (NO `total_paid_amount`: el interés de las cuotas lo
-- paga el comprador y no entra al total del pedido).
--
-- Outcomes: order_not_found, not_applicable, noop, stale, status_updated, reversed,
-- duplicate_payment, approved, approved_without_stock, approved_amount_mismatch,
-- approved_on_cancelled. Estado de pago desconocido => SQLSTATE 22023.
create or replace function public.apply_mercadopago_payment(
  p_order_id          uuid,
  p_payment_id        text,
  p_status            text,
  p_status_detail     text,
  p_amount            numeric,
  p_currency          text,
  p_date_approved     timestamptz,
  p_date_last_updated timestamptz
)
returns table (outcome text, order_status text, payment_status text, needs_review boolean)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_status  text;
  v_order   public.orders%rowtype;
  v_item    record;
  v_outcome text;
  v_updated_rows integer;
begin
  v_status := case p_status when 'authorized' then 'in_process' else p_status end;
  if v_status is null or v_status not in (
    'pending','in_process','in_mediation','approved','rejected','cancelled','refunded','charged_back'
  ) then
    raise exception using errcode = '22023', message = 'Estado de pago desconocido';
  end if;

  -- Serializa webhooks concurrentes del mismo pedido.
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    insert into public.payment_events (
      order_id, provider_payment_id, status, status_detail, amount, currency, date_last_updated, outcome
    ) values (
      null, p_payment_id, v_status, p_status_detail, p_amount, p_currency, p_date_last_updated, 'order_not_found'
    );
    return query select 'order_not_found'::text, null::text, null::text, null::boolean;
    return;
  end if;

  if v_order.payment_method <> 'mercadopago' or v_order.payment_status is null then
    v_outcome := 'not_applicable';

  -- A) Ya aprobado antes: solo eventos del MISMO pago pueden moverlo.
  elsif v_order.paid_at is not null then
    if p_payment_id = v_order.payment_ref then
      if v_status in ('refunded','charged_back','in_mediation','cancelled')
         and (v_order.payment_updated_at is null or p_date_last_updated >= v_order.payment_updated_at) then
        update public.orders
           set payment_status = v_status,
               payment_status_detail = p_status_detail,
               payment_updated_at = p_date_last_updated,
               needs_review = true,
               review_reason = 'pago_' || v_status
         where id = p_order_id;
        v_outcome := 'reversed';
      else
        v_outcome := 'noop';
      end if;
    elsif v_status = 'approved' then
      -- Otro pago aprobado para el mismo pedido: NO toca stock ni cupón.
      update public.orders
         set needs_review = true, review_reason = 'pago_duplicado'
       where id = p_order_id;
      v_outcome := 'duplicate_payment';
    else
      v_outcome := 'noop';
    end if;

  -- B) Todavía no aprobado y el evento tampoco es aprobado.
  elsif v_status <> 'approved' then
    if p_payment_id = v_order.payment_ref
       and v_order.payment_updated_at is not null
       and p_date_last_updated < v_order.payment_updated_at then
      v_outcome := 'stale';
    else
      update public.orders
         set payment_status = v_status,
             payment_status_detail = p_status_detail,
             payment_ref = p_payment_id,
             payment_updated_at = p_date_last_updated
       where id = p_order_id;
      v_outcome := 'status_updated';
    end if;

  -- C) Transición a aprobado: única (paid_at era null y tenemos el lock).
  else
    update public.orders
       set payment_status = 'approved',
           payment_status_detail = p_status_detail,
           payment_ref = p_payment_id,
           payment_updated_at = p_date_last_updated,
           paid_at = coalesce(p_date_approved, now())
     where id = p_order_id;

    if v_order.status = 'cancelled' then
      update public.orders
         set needs_review = true, review_reason = 'pago_en_pedido_cancelado'
       where id = p_order_id;
      v_outcome := 'approved_on_cancelled';

    elsif p_amount is null or upper(coalesce(p_currency, '')) <> 'ARS'
          or abs(p_amount - v_order.total_final) > 0.01 then
      update public.orders
         set needs_review = true, review_reason = 'monto_distinto'
       where id = p_order_id;
      v_outcome := 'approved_amount_mismatch';

    else
      -- C.1 Stock: todo o nada (el bloque con EXCEPTION es una subtransacción). Se bloquea en
      --     orden estable (product_id, sabor) para que dos pagos concurrentes no se tomen los
      --     locks cruzados; después products/variants -> discount_codes, como create_order.
      begin
        for v_item in
          select product_id, name, quantity, flavor
            from public.order_items
           where order_id = p_order_id
           order by product_id, lower(flavor)
        loop
          if v_item.product_id is null then
            raise exception using errcode = 'HY001', message = 'Producto eliminado';
          end if;

          -- D13: no exige active = true; el precio ya se aceptó cuando el producto estaba activo.
          if v_item.flavor is null then
            update public.products
               set stock = stock - v_item.quantity
             where id = v_item.product_id and stock >= v_item.quantity;
          else
            update public.product_variants pv
               set stock = pv.stock - v_item.quantity
             where pv.product_id = v_item.product_id
               and lower(pv.name) = lower(v_item.flavor)
               and pv.stock >= v_item.quantity;
          end if;

          get diagnostics v_updated_rows = row_count;
          if v_updated_rows = 0 then
            raise exception using errcode = 'HY001', message = 'Stock insuficiente';
          end if;
        end loop;

        update public.orders
           set stock_committed_at = now(),
               status = case when status = 'pending' then 'confirmed' else status end
         where id = p_order_id;
        v_outcome := 'approved';
      exception when sqlstate 'HY001' then
        update public.orders
           set needs_review = true, review_reason = 'sin_stock'
         where id = p_order_id;
        v_outcome := 'approved_without_stock';
      end;

      -- C.2 Cupón: registra el uso SIN guard (el precio ya se cobró), también si faltó stock.
      --     Si el código se borró no hay filas que actualizar y no es un error.
      if v_order.discount_code_id is not null then
        update public.discount_codes
           set uses_count = uses_count + 1,
               active = case
                          when max_uses is not null and uses_count + 1 >= max_uses then false
                          else active
                        end
         where id = v_order.discount_code_id;
      end if;
    end if;
  end if;

  insert into public.payment_events (
    order_id, provider_payment_id, status, status_detail, amount, currency, date_last_updated, outcome
  ) values (
    p_order_id, p_payment_id, v_status, p_status_detail, p_amount, p_currency, p_date_last_updated, v_outcome
  );

  return query
    select v_outcome, o.status, o.payment_status, o.needs_review
      from public.orders o
     where o.id = p_order_id;
end; $$;

revoke all on function public.apply_mercadopago_payment(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz
) from public;
revoke execute on function public.apply_mercadopago_payment(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_mercadopago_payment(
  uuid, text, text, text, numeric, text, timestamptz, timestamptz
) to service_role;

-- =========================================================
-- VERIFICACIÓN POST-MIGRACIÓN (QA / orquestador): deben dar false, false, true.
--   select has_function_privilege('anon', 'public.apply_mercadopago_payment(uuid,text,text,text,numeric,text,timestamptz,timestamptz)', 'execute'),
--          has_function_privilege('authenticated', 'public.apply_mercadopago_payment(uuid,text,text,text,numeric,text,timestamptz,timestamptz)', 'execute'),
--          has_function_privilege('service_role', 'public.apply_mercadopago_payment(uuid,text,text,text,numeric,text,timestamptz,timestamptz)', 'execute');
-- Idem para public.create_order(<19 tipos>).
--
-- ROLLBACK: re-aplicar la definición de `create_order` de 0010_orders_note.sql (dropea la
-- de 19 args y recrea la de 18), y después:
--   drop function if exists public.apply_mercadopago_payment(uuid, text, text, text, numeric, text, timestamptz, timestamptz);
--   drop table if exists public.payment_events;
--   alter table public.orders
--     drop column if exists payment_status, drop column if exists payment_status_detail,
--     drop column if exists payment_updated_at, drop column if exists paid_at,
--     drop column if exists stock_committed_at, drop column if exists mp_preference_id,
--     drop column if exists needs_review, drop column if exists review_reason;
-- (Hacer el rollback del código antes; los pedidos con tarjeta pendientes se pierden de vista.)
-- =========================================================
