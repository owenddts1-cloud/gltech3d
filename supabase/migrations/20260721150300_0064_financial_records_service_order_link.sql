-- 0064_financial_records_service_order_link
-- (1) FIX DE PRODUÇÃO: fn_service_order_auto_sale usava
--     `on conflict (service_order_id) do nothing`, mas o único índice único em
--     service_order_id é PARCIAL (`where service_order_id is not null`). Sem repetir
--     o predicado no ON CONFLICT, o Postgres não usa o índice parcial como arbiter e
--     TODA tentativa de insert falha com "there is no unique or exclusion constraint
--     matching the ON CONFLICT specification" — não só duplicatas reais. Foi o que
--     aconteceu com uma O.S. real em 2026-07-21: a transação abortou inteira, a O.S.
--     voltou pro status anterior e nenhuma Venda foi criada. Confirmado por query
--     direta (status ficou no estágio anterior, concluded_at null, 0 linhas em
--     marketplace_orders para o service_order_id).
--
-- (2) financial_records.service_order_id — vínculo que faltava (era 100%
--     desacoplada de service_orders/marketplace_orders por schema). Vira a fonte de
--     idempotência do sync Controle→módulos e do sync bidirecional das migrations
--     0065/0066.
--
-- (3) Relaxa financial_records.platform_check pro mesmo padrão frouxo de
--     marketplace_orders.platform (migration 0062) — canal de venda customizado
--     (sale_channels, migration 0061) precisa poder aparecer aqui também.
--
-- (4) fn_control_month / fn_parse_sale_description — portam pro banco a lógica hoje
--     só em TS (app/app/control/_lib/aggregate.ts e sync-map.ts:97-105), necessária
--     pelos triggers de propagação das migrations 0065/0066.
--
-- (5) fn_service_order_auto_sale ganha um segundo INSERT (em financial_records) na
--     mesma transação, linkado por service_order_id.
--
-- Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) financial_records.service_order_id + índice único parcial
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.financial_records
  add column if not exists service_order_id uuid references public.service_orders(id) on delete set null;

create unique index if not exists financial_records_service_order_id_unique
  on public.financial_records (service_order_id)
  where service_order_id is not null;

create index if not exists financial_records_org_service_order_idx
  on public.financial_records (organization_id, service_order_id)
  where service_order_id is not null;

comment on column public.financial_records.service_order_id is
  'Vínculo com a O.S./Venda que originou este lançamento. NULL = lançamento manual
   (ou legado, pré-sync automático). Fonte de idempotência do sync Controle→módulos
   e do sync bidirecional SO<->MO<->FR (migrations 0064-0066). Índice único parcial:
   uma O.S. tem no máximo 1 Lançamento vinculado.';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) Relaxa o CHECK fechado de financial_records.platform (mesmo molde da 0062)
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.financial_records
  drop constraint if exists financial_records_platform_check;

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.financial_records'::regclass
      and contype = 'c'
      and conname <> 'fr_platform_len'
      and pg_get_constraintdef(oid) ilike '%platform%'
      and (pg_get_constraintdef(oid) ilike '%= any%' or pg_get_constraintdef(oid) ilike '%platform% in (%')
  loop
    execute format('alter table public.financial_records drop constraint %I', r.conname);
  end loop;
end $$;

-- char_length(NULL) é NULL, e CHECK trata NULL como "passou" — preserva o
-- comportamento atual de aceitar platform IS NULL. char_length('') = 0, dentro do
-- range — preserva aceitar string vazia.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'fr_platform_len') then
    alter table public.financial_records
      add constraint fr_platform_len check (char_length(platform) between 0 and 80);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) Helpers plpgsql — mês (JAN./FEV./...) e parse "Produto - Cliente"
-- ═══════════════════════════════════════════════════════════════════════════════

-- Espelha MONTH_ORDER de app/app/control/_lib/aggregate.ts:3. Array do Postgres é
-- 1-indexado e extract(month) retorna 1-12 — sem o "-1" que o TS precisa (array 0-indexado).
create or replace function public.fn_control_month(p_date date)
returns text
language sql
immutable
as $$
  select (array['JAN.','FEV.','MAR.','ABR.','MAI.','JUN.','JUL.','AGO.','SET.','OUT.','NOV.','DEZ.'])
    [extract(month from p_date)::int];
$$;

comment on function public.fn_control_month(date) is
  'Espelha MONTH_ORDER (app/app/control/_lib/aggregate.ts). Se esse array mudar no
   TS, mude aqui também — duplicação intencional, mesma razão de SYNC_OWNER_NAMES.';

-- Espelha parseSale() de app/app/control/_lib/sync-map.ts:97-105. Convenção da
-- planilha: "Produto - Cliente", separador = ÚLTIMO " - " (produto pode ter hífen).
-- " - " é um palíndromo (' ','-',' ') então buscar ' - ' em reverse(desc) encontra a
-- ÚLTIMA ocorrência em desc. Fórmula da posição (1-indexed) do início do separador
-- em desc a partir da posição do match em reverse(desc):
--   v_sep_pos = length(desc) - v_pos_in_reverse - length(' - ') + 2
--             = length(desc) - v_pos_in_reverse - 1
-- Verificado manualmente com "Maxilar 3D - Wellington Denise" e "AB - CD - EF".
create or replace function public.fn_parse_sale_description(p_desc text)
returns table(product text, client text)
language plpgsql
immutable
as $$
declare
  v_desc text := coalesce(p_desc, '');
  v_pos_rev int;
  v_sep_pos int;
  v_product text;
  v_client text;
begin
  v_pos_rev := position(' - ' in reverse(v_desc));

  if v_pos_rev > 0 then
    v_sep_pos := length(v_desc) - v_pos_rev - 1;
    if v_sep_pos > 0 then
      v_product := btrim(substring(v_desc from 1 for v_sep_pos - 1));
      v_client  := btrim(substring(v_desc from v_sep_pos + 3));
    end if;
  end if;

  if v_product is null or v_product = '' or v_client is null or v_client = '' then
    -- Sem separador válido (ou produto/cliente vazio após trim) — tudo vira produto,
    -- sem cliente. Espelha o fallback `{ product: desc || "Venda", client: "" }` do TS.
    v_product := nullif(v_desc, '');
    v_client := '';
  end if;

  product := coalesce(v_product, 'Venda');
  client := v_client;
  return next;
end $$;

comment on function public.fn_parse_sale_description(text) is
  'Espelha parseSale() em app/app/control/_lib/sync-map.ts:97-105. Testar manualmente
   com: SELECT * FROM fn_parse_sale_description(''Maxilar 3D - Wellington Denise'')
   → deve retornar (''Maxilar 3D'', ''Wellington Denise'').';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) fn_service_order_auto_sale — FIX + extensão (cria também o Lançamento)
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_service_order_auto_sale()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_channel_name text;
  v_next_pos numeric;
  v_platform text;
  v_description text;
begin
  if new.status = 'concluido' and old.status is distinct from 'concluido' then

    select name into v_channel_name
    from public.sale_channels
    where id = new.channel_id and organization_id = new.organization_id;

    v_platform := coalesce(v_channel_name, 'Outro');

    select coalesce(max(board_position), 0) + 1 into v_next_pos
    from public.marketplace_orders
    where organization_id = new.organization_id;

    insert into public.marketplace_orders (
      organization_id, service_order_id, channel_id, platform,
      contact_id, customer_name, total_cents, qty,
      status, fulfillment_status, payment_status, sold_at,
      notes, board_position, product_id
    ) values (
      new.organization_id, new.id, new.channel_id, v_platform,
      new.contact_id, new.contact_name, new.total_cents, new.qty,
      'concluido', 'pronta', 'pendente', now(),
      'Gerado automaticamente a partir da O.S. ' || coalesce(new.code, new.id::text) || ': ' || new.title,
      v_next_pos, null
    )
    -- FIX: repete o predicado do índice parcial. Sem isso, TODO insert falhava
    -- (não só duplicatas) — era o bug de produção do 2026-07-21.
    on conflict (service_order_id) where service_order_id is not null do nothing;

    -- ── Lançamento (financial_records) vinculado ──
    v_description := new.title
      || case when coalesce(new.contact_name, '') <> '' then ' - ' || new.contact_name else '' end;

    insert into public.financial_records (
      organization_id, date, month, quantity, description, type, category,
      revenue_cents, expense_cents, installments, platform, service_order_id, created_by
    ) values (
      new.organization_id,
      coalesce(new.concluded_at::date, current_date),
      public.fn_control_month(coalesce(new.concluded_at::date, current_date)),
      greatest(new.qty, 1),
      v_description,
      'Receita',
      'Venda',
      new.total_cents,
      0,
      '1',
      v_platform,
      new.id,
      new.created_by
    )
    -- Mesmo padrão: reabrir/reconcluir a O.S. não duplica o Lançamento.
    on conflict (service_order_id) where service_order_id is not null do nothing;

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
