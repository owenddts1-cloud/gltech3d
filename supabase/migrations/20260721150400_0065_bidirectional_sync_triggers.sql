-- 0065_bidirectional_sync_triggers
-- Trigger #2 (service_orders → marketplace_orders + financial_records) e
-- Trigger #3 (marketplace_orders → service_orders + financial_records).
-- Cada uma propaga DIRETO pras outras duas tabelas (não encadeia via a trigger
-- vizinha). O corte do loop infinito acontece no WHEN da trigger de DESTINO: cada
-- trigger escreve o valor exato que a origem já tem, então quando o "eco" chega de
-- volta o OLD já é igual ao NEW e o WHEN barra — no máximo 2 hops por edição.
-- Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER #2 — service_orders edits → marketplace_orders + financial_records
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_service_orders_propagate_edits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_name text;
  v_platform text;
  v_description text;
begin
  -- platform é sempre DERIVADO de channel_id neste lado (SO não tem coluna
  -- platform própria) — recomputa sempre, é barato e nunca diverge de channel_id.
  select name into v_channel_name
  from public.sale_channels
  where id = new.channel_id and organization_id = new.organization_id;
  v_platform := coalesce(v_channel_name, 'Outro');

  v_description := new.title
    || case when coalesce(new.contact_name, '') <> '' then ' - ' || new.contact_name else '' end;

  update public.marketplace_orders mo
  set total_cents   = case when old.total_cents  is distinct from new.total_cents  then new.total_cents  else mo.total_cents  end,
      qty           = case when old.qty          is distinct from new.qty          then new.qty          else mo.qty          end,
      channel_id    = case when old.channel_id   is distinct from new.channel_id   then new.channel_id   else mo.channel_id   end,
      platform      = case when old.channel_id   is distinct from new.channel_id   then v_platform        else mo.platform    end,
      contact_id    = case when old.contact_id   is distinct from new.contact_id   then new.contact_id   else mo.contact_id   end,
      customer_name = case when old.contact_name is distinct from new.contact_name then new.contact_name else mo.customer_name end,
      updated_at    = now()
  where mo.service_order_id = new.id;

  update public.financial_records fr
  set revenue_cents = case when old.total_cents  is distinct from new.total_cents  then new.total_cents else fr.revenue_cents end,
      quantity      = case when old.qty          is distinct from new.qty          then new.qty         else fr.quantity      end,
      platform      = case when old.channel_id   is distinct from new.channel_id   then v_platform       else fr.platform      end,
      description   = case when old.contact_name is distinct from new.contact_name then v_description    else fr.description   end,
      updated_at    = now()
  where fr.service_order_id = new.id;

  return new;
end $$;

drop trigger if exists trg_service_orders_propagate_edits on public.service_orders;
create trigger trg_service_orders_propagate_edits
  after update of total_cents, qty, channel_id, contact_id, contact_name on public.service_orders
  for each row
  when (
    old.total_cents  is distinct from new.total_cents
    or old.qty          is distinct from new.qty
    or old.channel_id   is distinct from new.channel_id
    or old.contact_id   is distinct from new.contact_id
    or old.contact_name is distinct from new.contact_name
  )
  execute function public.fn_service_orders_propagate_edits();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER #3 — marketplace_orders edits → service_orders + financial_records
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_marketplace_orders_propagate_edits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_so_title text;
  v_description text;
begin
  -- só propaga MOs que nasceram vinculadas a uma O.S.
  if new.service_order_id is null then
    return new;
  end if;

  update public.service_orders so
  set total_cents   = case when old.total_cents   is distinct from new.total_cents   then new.total_cents   else so.total_cents   end,
      qty           = case when old.qty           is distinct from new.qty           then new.qty           else so.qty           end,
      channel_id    = case when old.channel_id    is distinct from new.channel_id    then new.channel_id    else so.channel_id    end,
      contact_id    = case when old.contact_id    is distinct from new.contact_id    then new.contact_id    else so.contact_id    end,
      contact_name  = case when old.customer_name is distinct from new.customer_name then new.customer_name else so.contact_name  end,
      updated_at    = now()
  where so.id = new.service_order_id
  returning so.title into v_so_title;

  if v_so_title is null then
    -- SO vinculada não existe mais (linha órfã) — nada a propagar pra FR também.
    return new;
  end if;

  v_description := v_so_title
    || case when coalesce(new.customer_name, '') <> '' then ' - ' || new.customer_name else '' end;

  update public.financial_records fr
  set revenue_cents = case when old.total_cents   is distinct from new.total_cents   then new.total_cents else fr.revenue_cents end,
      quantity      = case when old.qty           is distinct from new.qty           then new.qty         else fr.quantity      end,
      platform      = case when old.platform      is distinct from new.platform      then new.platform    else fr.platform      end,
      description   = case when old.customer_name is distinct from new.customer_name then v_description   else fr.description   end,
      updated_at    = now()
  where fr.service_order_id = new.service_order_id;

  return new;
end $$;

drop trigger if exists trg_marketplace_orders_propagate_edits on public.marketplace_orders;
create trigger trg_marketplace_orders_propagate_edits
  after update of total_cents, qty, channel_id, platform, contact_id, customer_name on public.marketplace_orders
  for each row
  when (
    old.service_order_id is not null
    and new.service_order_id is not null
    and (
      old.total_cents   is distinct from new.total_cents
      or old.qty           is distinct from new.qty
      or old.channel_id    is distinct from new.channel_id
      or old.platform      is distinct from new.platform
      or old.contact_id    is distinct from new.contact_id
      or old.customer_name is distinct from new.customer_name
    )
  )
  execute function public.fn_marketplace_orders_propagate_edits();
