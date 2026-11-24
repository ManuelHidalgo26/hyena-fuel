-- 0015_cancel_order_restock.sql
-- Cancelar un pedido repone su stock.
--
-- Hasta acá, `PATCH /api/orders/[id]/status` solo cambiaba `status` y el stock descontado al
-- crear el pedido (o al aprobarse el pago con tarjeta) quedaba perdido. Aditiva: solo agrega
-- una función, el código anterior sigue funcionando si se aplica antes del deploy.
--
-- NO APLICAR A PRODUCCIÓN DESDE ACÁ: se aplica con OK explícito del usuario, ANTES del deploy
-- del código que la usa (sin la función, cancelar responde 500).

-- Cancela un pedido y repone su stock, atómica e idempotente:
--   - Bloquea la fila del pedido: dos cancelaciones simultáneas no reponen dos veces.
--   - Repone solo si el pedido había descontado stock (`stock_committed_at`) y todavía no se
--     despachó (la mercadería de un pedido despachado o pagado ya salió del local).
--   - Limpia `stock_committed_at`: el pedido cancelado ya no tiene stock tomado.
--   - Recorre los ítems en el mismo orden que `create_order` y `apply_mercadopago_payment`
--     (product_id, sabor) para no producir deadlocks.
--   - Los productos o sabores que ya no existen se cuentan en `skipped_items`.
--   - No reactiva cupones ni toca el pago.
--
-- Outcomes: not_found, already_cancelled, cancelled.
create or replace function public.cancel_order(p_order_id uuid)
returns table (outcome text, restocked_items integer, skipped_items integer)
language plpgsql security definer set search_path = public as $$
declare
  v_order     public.orders%rowtype;
  v_item      record;
  v_rows      integer;
  v_restocked integer := 0;
  v_skipped   integer := 0;
begin
  select * into v_order from public.orders where id = p_order_id for update;

  if not found then
    return query select 'not_found'::text, 0, 0;
    return;
  end if;

  if v_order.status = 'cancelled' then
    return query select 'already_cancelled'::text, 0, 0;
    return;
  end if;

  if v_order.stock_committed_at is not null and v_order.status in ('pending', 'confirmed') then
    for v_item in
      select product_id, quantity, flavor
        from public.order_items
       where order_id = p_order_id
       order by product_id, lower(flavor)
    loop
      if v_item.flavor is null then
        update public.products
           set stock = stock + v_item.quantity
         where id = v_item.product_id;
      else
        update public.product_variants pv
           set stock = pv.stock + v_item.quantity
         where pv.product_id = v_item.product_id
           and lower(pv.name) = lower(v_item.flavor);
      end if;

      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        v_skipped := v_skipped + 1;
      else
        v_restocked := v_restocked + 1;
      end if;
    end loop;

    update public.orders
       set status = 'cancelled', stock_committed_at = null
     where id = p_order_id;
  else
    update public.orders set status = 'cancelled' where id = p_order_id;
  end if;

  return query select 'cancelled'::text, v_restocked, v_skipped;
end; $$;

-- `revoke ... from public` NO alcanza para anon/authenticated en Supabase: revocar explícito.
revoke all on function public.cancel_order(uuid) from public;
revoke execute on function public.cancel_order(uuid) from public, anon, authenticated;
grant execute on function public.cancel_order(uuid) to service_role;

-- VERIFICACIÓN POST-MIGRACIÓN: deben dar false, false, true.
--   select has_function_privilege('anon', 'public.cancel_order(uuid)', 'execute'),
--          has_function_privilege('authenticated', 'public.cancel_order(uuid)', 'execute'),
--          has_function_privilege('service_role', 'public.cancel_order(uuid)', 'execute');
--
-- ROLLBACK (después de volver el código atrás): drop function if exists public.cancel_order(uuid);
