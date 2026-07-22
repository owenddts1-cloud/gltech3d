-- 0066_financial_records_propagate_and_auto_sync
-- Trigger #4 (financial_records edits → service_orders + marketplace_orders, linhas
-- já vinculadas) e Trigger #5 (Controle→módulos automático: linha nova/editada com
-- category='Venda' vira O.S.+Venda na hora, sem precisar clicar em "Sincronizar").
-- Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER #4 — financial_records edits (linha JÁ vinculada) → SO + MO
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_financial_records_propagate_edits()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_product text;
  v_client text;
begin
  if new.service_order_id is null then
    return new;
  end if;

  if old.description is distinct from new.description then
    select p.product, p.client into v_product, v_client
    from public.fn_parse_sale_description(new.description) p;
  end if;

  update public.service_orders so
  set total_cents   = case when old.revenue_cents is distinct from new.revenue_cents then new.revenue_cents else so.total_cents  end,
      qty           = case when old.quantity      is distinct from new.quantity      then new.quantity      else so.qty          end,
      title         = case when old.description   is distinct from new.description and coalesce(v_product, '') <> '' then v_product else so.title end,
      contact_name  = case when old.description   is distinct from new.description and coalesce(v_client, '')  <> '' then v_client  else so.contact_name end,
      updated_at    = now()
  where so.id = new.service_order_id;

  update public.marketplace_orders mo
  set total_cents   = case when old.revenue_cents is distinct from new.revenue_cents then new.revenue_cents else mo.total_cents   end,
      qty           = case when old.quantity      is distinct from new.quantity      then new.quantity      else mo.qty           end,
      platform      = case when old.platform      is distinct from new.platform      then new.platform      else mo.platform      end,
      customer_name = case when old.description   is distinct from new.description and coalesce(v_client, '') <> '' then v_client  else mo.customer_name end,
      updated_at    = now()
  where mo.service_order_id = new.service_order_id;

  return new;
end $$;

drop trigger if exists trg_financial_records_propagate_edits on public.financial_records;
create trigger trg_financial_records_propagate_edits
  after update of revenue_cents, quantity, platform, description on public.financial_records
  for each row
  when (
    old.service_order_id is not null
    and new.service_order_id is not null
    and (
      old.revenue_cents is distinct from new.revenue_cents
      or old.quantity      is distinct from new.quantity
      or old.platform      is distinct from new.platform
      or old.description   is distinct from new.description
    )
  )
  execute function public.fn_financial_records_propagate_edits();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TRIGGER #5 — Controle→módulos automático (porta planControlSync/syncControlToModules
-- só a parte "Venda" — Ferramentas/Insumos/Filamentos continuam manuais, fora de escopo)
-- ═══════════════════════════════════════════════════════════════════════════════
-- BEFORE INSERT OR UPDATE (não AFTER): a função muta NEW.service_order_id e devolve
-- NEW — o Postgres grava a linha JÁ com o vínculo numa escrita física só, sem
-- precisar de um segundo UPDATE na própria tabela (que reacionaria triggers AFTER de
-- novo). Mesmo idiom já usado por fn_service_orders_stamp_concluded (migration 0043,
-- BEFORE UPDATE OF status, muta new.concluded_at).
create or replace function public.fn_financial_records_auto_sync_venda()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_product text;
  v_client text;
  v_contact_id uuid;
  v_so_id uuid;
  v_mo_id uuid;
  v_next_pos numeric;
  v_platform text;
begin
  -- WHEN já filtra category='Venda' and revenue_cents>0 and service_order_id is null,
  -- mas repetimos aqui por segurança (defesa em profundidade, barato).
  if new.category is distinct from 'Venda' or coalesce(new.revenue_cents, 0) <= 0
     or new.service_order_id is not null then
    return new;
  end if;

  select p.product, p.client into v_product, v_client
  from public.fn_parse_sale_description(new.description) p;

  -- Cliente: acha-ou-cria (dedup case-insensitive por display_name/name), exceto
  -- se for o dono da oficina (SYNC_OWNER_NAMES = ['gui'] em sync-map.ts:82).
  -- Duplicação intencional dessa lista aqui — se SYNC_OWNER_NAMES crescer no TS,
  -- atualize esta lista também (mesma razão de fn_control_month acima).
  if coalesce(v_client, '') <> '' and lower(btrim(v_client)) <> 'gui' then
    select id into v_contact_id
    from public.contacts
    where organization_id = new.organization_id
      and lower(coalesce(display_name, name, '')) = lower(btrim(v_client))
    limit 1;

    if v_contact_id is null then
      insert into public.contacts (organization_id, name, display_name, source, created_by_user_id)
      values (new.organization_id, v_client, v_client, 'controle', new.created_by)
      returning id into v_contact_id;
    end if;
  end if;

  v_platform := coalesce(nullif(btrim(new.platform), ''), 'Outro');

  -- O.S. nova, status inicial 'aprovado' (igual ao TS syncControlToModules:140).
  insert into public.service_orders (
    organization_id, title, contact_id, contact_name, status,
    total_cents, qty, created_by
  ) values (
    new.organization_id,
    coalesce(nullif(v_product, ''), 'Venda'),
    v_contact_id,
    nullif(v_client, ''),
    'aprovado',
    greatest(new.revenue_cents, 0),
    greatest(coalesce(new.quantity, 1), 1),
    new.created_by
  )
  returning id into v_so_id;

  select coalesce(max(board_position), 0) + 1 into v_next_pos
  from public.marketplace_orders where organization_id = new.organization_id;

  -- Venda nova, status 'pago' (igual ao TS syncControlToModules:111 — mantém
  -- exatamente o valor que o código manual já usava, pra não mudar comportamento
  -- de dashboards/filtros que já esperam 'pago' nessas vendas vindas do Controle).
  insert into public.marketplace_orders (
    organization_id, platform, external_order_id, customer_name, contact_id,
    status, total_cents, qty, sold_at, service_order_id, board_position, created_by
  ) values (
    new.organization_id,
    v_platform,
    'ctrl:' || new.id::text,
    nullif(v_client, ''),
    v_contact_id,
    'pago',
    greatest(new.revenue_cents, 0),
    greatest(coalesce(new.quantity, 1), 1),
    new.date,
    v_so_id,
    v_next_pos,
    new.created_by
  )
  on conflict (service_order_id) where service_order_id is not null do nothing
  returning id into v_mo_id;

  -- Linka a própria linha SEM um segundo UPDATE (mutação de NEW em trigger BEFORE).
  new.service_order_id := v_so_id;

  perform public.emit_event(
    'financial_record.auto_synced', 'financial_record', new.id,
    jsonb_build_object('service_order_id', v_so_id, 'marketplace_order_id', v_mo_id),
    '{}'::jsonb, new.organization_id
  );

  return new;
end $$;

drop trigger if exists trg_financial_records_auto_sync_venda on public.financial_records;
create trigger trg_financial_records_auto_sync_venda
  before insert or update of category, revenue_cents, description, platform, date on public.financial_records
  for each row
  when (new.category = 'Venda' and new.revenue_cents > 0 and new.service_order_id is null)
  execute function public.fn_financial_records_auto_sync_venda();
