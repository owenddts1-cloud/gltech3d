-- 0063_service_order_auto_sale
-- Gera automaticamente uma Venda (marketplace_orders) quando uma O.S. entra em
-- 'concluido'. DML local dentro da mesma transação (mesmo padrão de
-- fn_bump_product_sales, migration 0055) — sem HTTP, sem event_log/worker.
-- Idempotente via unique index parcial em service_order_id + on conflict do nothing:
-- reabrir e concluir a O.S. de novo não duplica a venda; a venda já gerada não é
-- apagada/revertida ao reabrir (fica editável manualmente).
-- Idempotent — safe to re-apply.

create unique index if not exists marketplace_orders_service_order_id_unique
  on public.marketplace_orders (service_order_id)
  where service_order_id is not null;

create or replace function public.fn_service_order_auto_sale()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_name text;
  v_next_pos numeric;
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' then

    select name into v_channel_name
    from public.sale_channels
    where id = new.channel_id and organization_id = new.organization_id;

    select coalesce(max(board_position), 0) + 1 into v_next_pos
    from public.marketplace_orders
    where organization_id = new.organization_id;

    insert into public.marketplace_orders (
      organization_id, service_order_id, channel_id, platform,
      contact_id, customer_name, total_cents, qty,
      status, fulfillment_status, payment_status, sold_at,
      notes, board_position, product_id
    ) values (
      new.organization_id, new.id, new.channel_id, coalesce(v_channel_name, 'Outro'),
      new.contact_id, new.contact_name, new.total_cents, new.qty,
      'concluido', 'pronta', 'pendente', now(),
      'Gerado automaticamente a partir da O.S. ' || coalesce(new.code, new.id::text) || ': ' || new.title,
      v_next_pos, null
    )
    on conflict (service_order_id) do nothing;

    -- Best-effort/observability — não é o mecanismo principal do side-effect,
    -- nenhum worker novo é necessário para consumir isto agora.
    perform public.emit_event(
      'service_order.concluded', 'service_order', new.id,
      jsonb_build_object('service_order_id', new.id), '{}'::jsonb, new.organization_id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_service_order_auto_sale on public.service_orders;
create trigger trg_service_order_auto_sale
  after update of status on public.service_orders
  for each row execute function public.fn_service_order_auto_sale();
