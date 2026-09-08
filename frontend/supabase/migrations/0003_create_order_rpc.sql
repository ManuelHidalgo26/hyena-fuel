-- =========================================================
-- HYENA FUEL — RPC create_order (alta atómica de pedido + descuento de stock)
-- QA-1 (ALTO), Sesión 5: el descuento de stock no era atómico; se validaba
-- `stock >= qty` en la app y se insertaba en pasos separados, dejando una
-- ventana de carrera (TOCTOU) entre dos checkouts concurrentes del mismo
-- producto.
--
-- Esta función hace, en una sola llamada RPC (una transacción implícita):
--   1) inserta la orden con los totales/comisión ya calculados y congelados
--      en el server (`src/lib/orders.ts`, ver ADR 0002 — esa lógica no se
--      re-litiga acá, esta función solo persiste);
--   2) por cada ítem, descuenta stock con `update ... where stock >= qty`;
--      si la fila afectada es 0 (stock insuficiente, producto inactivo o
--      inexistente), aborta con SQLSTATE 'HY001' — Route Handler lo mapea
--      a 400 con `error.message`;
--   3) inserta `order_items` ya congelados (name/unit_price/unit_cost/unit_commission).
-- Si cualquier paso falla, Postgres revierte todo: nunca queda una orden
-- huérfana ni stock descontado a medias (resuelve de paso QA-7).
--
-- `security definer`: corre con los privilegios del dueño de la función
-- (bypassa RLS), igual que ya hace el cliente admin de service role que la
-- invoca. Por eso el `execute` se revoca de `public`/`anon`/`authenticated`
-- y se otorga solo a `service_role`: un cliente anónimo no puede llamarla
-- directo contra PostgREST para forjar `seller_id`/`commission_total` sin
-- pasar por las validaciones del Route Handler.
-- =========================================================

create or replace function public.create_order(
  p_customer_name      text,
  p_customer_email     text,
  p_customer_phone     text,
  p_customer_address   text,
  p_payment_method     text,
  p_delivery_method    text,
  p_subtotal           numeric,
  p_discount           numeric,
  p_shipping_cost      numeric,
  p_total_final        numeric,
  p_seller_id          uuid,
  p_attribution_source text,
  p_commission_total   numeric,
  p_items              jsonb
)
returns setof public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id     uuid;
  v_item         jsonb;
  v_product_id   uuid;
  v_quantity     integer;
  v_product_name text;
  v_updated_rows integer;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La orden no tiene ítems';
  end if;

  insert into public.orders (
    customer_name, customer_email, customer_phone, customer_address,
    payment_method, delivery_method,
    subtotal, discount, shipping_cost, total_final,
    seller_id, attribution_source, commission_total
  ) values (
    p_customer_name, p_customer_email, p_customer_phone, p_customer_address,
    p_payment_method, p_delivery_method,
    p_subtotal, p_discount, p_shipping_cost, p_total_final,
    p_seller_id, p_attribution_source, p_commission_total
  )
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_product_id   := (v_item ->> 'product_id')::uuid;
    v_quantity     := (v_item ->> 'quantity')::integer;
    v_product_name := v_item ->> 'name';

    update public.products
       set stock = stock - v_quantity
     where id = v_product_id
       and active = true
       and stock >= v_quantity;

    get diagnostics v_updated_rows = row_count;

    if v_updated_rows = 0 then
      raise exception using
        errcode = 'HY001',
        message = format('Stock insuficiente de "%s"', coalesce(v_product_name, v_product_id::text));
    end if;

    insert into public.order_items (
      order_id, product_id, name, quantity, unit_price, unit_cost, unit_commission
    ) values (
      v_order_id,
      v_product_id,
      v_product_name,
      v_quantity,
      (v_item ->> 'unit_price')::numeric,
      (v_item ->> 'unit_cost')::numeric,
      (v_item ->> 'unit_commission')::numeric
    );
  end loop;

  return query select * from public.orders where id = v_order_id;
end;
$$;

revoke all on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb
) from public;

grant execute on function public.create_order(
  text, text, text, text, text, text, numeric, numeric, numeric, numeric, uuid, text, numeric, jsonb
) to service_role;
