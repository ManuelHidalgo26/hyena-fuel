-- 0010_orders_note.sql
-- ADR 0006 — Nota opcional del pedido (Fase 2): cierra la parte pendiente de 0006
-- (que solo agregó la columna). Agrega el parámetro `p_note` a la RPC `create_order`
-- e inserta la nota junto con el resto de la orden. Idempotente.
--
-- NO APLICAR A PRODUCCIÓN DESDE ACÁ: el orquestador la aplica a un branch de Supabase
-- para QA; el cliente decide el deploy a la base real.
--
-- IMPORTANTE: la firma "viva" de `create_order` NO es la de 14 args que documenta el
-- SQL de referencia del ADR 0006 (redactado antes de 0009) — es la de 17 args de
-- 0009_discount_codes.sql (canje de cupón atómico incluido). Esta migración dropea esa
-- firma de 17 args y recrea con 18 (los mismos 17, sin cambios de lógica, + `p_note`
-- al final) para no dejar dos overloads húerfanos que PostgREST podría resolver mal.

-- 1) Columna nullable en orders (ya la agregó 0006; se repite acá por idempotencia
--    y para que esta migración sea autocontenida si se corre sola).
alter table public.orders add column if not exists note text;

-- 2) RPC create_order: dropear la firma viva (17 args, 0009) y recrear con 18.
drop function if exists public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric
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
  p_note                 text    default null
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
    discount_code_id, discount_code, discount_code_amount, note
  ) values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address,
    p_payment_method, p_delivery_method, p_subtotal, p_discount, p_shipping_cost, p_total_final,
    p_seller_id, p_attribution_source, p_commission_total,
    p_discount_code_id, p_discount_code, coalesce(p_discount_code_amount, 0), p_note
  ) returning id into v_order_id;

  -- (a) Descuento de stock atómico por ítem (idéntico a 0009, flavor-aware).
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

-- 3) Grants: mismo hardening que 0008/0009 (service_role only; anon/authenticated sin
--    acceso). `revoke ... from public` NO alcanza para anon/authenticated (son roles
--    con membresía propia en Supabase) — hay que revocarles el EXECUTE explícito.
revoke all on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text
) from public;
revoke execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text
) from anon, authenticated;
grant execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb, uuid, text, numeric, text
) to service_role;

-- =========================================================
-- ROLLBACK: si hay que revertir esta migración, re-aplicar la definición de
-- `create_order` tal como queda en 0009_discount_codes.sql (17 args, sin `p_note`)
-- — eso dropea la firma de 18 args (ver el `drop function if exists` de arriba, con
-- la lista de 18 tipos) y la reemplaza por la de 17. La columna `orders.note` puede
-- quedar (es nullable, no rompe nada) o eliminarse aparte con
-- `alter table public.orders drop column if exists note;` si se quiere limpiar del todo.
-- =========================================================
