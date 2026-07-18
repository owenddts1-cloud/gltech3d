-- 0055_catalog_and_orders_integrity
-- Normaliza categorias, adiciona código legível a O.S., view unificada de pedidos,
-- liga marketplace_orders → products, CHECK constraints de integridade, trigger de
-- sales_count, índice trigram para busca fuzzy, e view de custo calculado.
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) CATEGORIES — catálogo normalizado
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  sort_order      numeric,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint categories_name_len check (char_length(name) between 1 and 120)
);
create unique index if not exists categories_org_slug_unique
  on public.categories (organization_id, slug);
create index if not exists categories_org_idx
  on public.categories (organization_id);

alter table public.categories enable row level security;
drop policy if exists tenant_isolation_categories_all on public.categories;
create policy tenant_isolation_categories_all on public.categories
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.categories from anon;

drop trigger if exists trg_categories_audit on public.categories;
create trigger trg_categories_audit
  after insert or update or delete on public.categories
  for each row execute function public.fn_audit_log_row();

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
  before update on public.categories
  for each row execute function public.fn_set_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) Ligar products → categories SEM quebrar o category text existente
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.products
  add column if not exists category_id uuid references public.categories(id) on delete set null;
create index if not exists products_org_category_id_idx
  on public.products (organization_id, category_id);

-- Backfill: cria 1 categoria por valor distinto de products.category e religa
-- Usa regexp_replace para gerar slug amigável (ex: "Action Figure" → "action-figure")
insert into public.categories (organization_id, name, slug)
select distinct p.organization_id, p.category,
       lower(regexp_replace(btrim(p.category), '[^a-zA-Z0-9À-ÿ]+', '-', 'g'))
from public.products p
where p.category is not null and btrim(p.category) <> ''
on conflict (organization_id, slug) do nothing;

update public.products p
set category_id = c.id
from public.categories c
where c.organization_id = p.organization_id
  and lower(regexp_replace(btrim(p.category), '[^a-zA-Z0-9À-ÿ]+', '-', 'g')) = c.slug
  and p.category_id is null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) O.S. com CÓDIGO LEGÍVEL "OS-300" (per-org, sem sequence global)
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.service_orders
  add column if not exists code text;

create or replace function public.fn_assign_os_code() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_next bigint;
begin
  if new.code is not null then return new; end if;
  -- serializa por org p/ evitar corrida (ateliê = baixo volume, advisory lock ok)
  perform pg_advisory_xact_lock(hashtext(new.organization_id::text || ':os'));
  select coalesce(max((regexp_replace(code, '\D', '', 'g'))::bigint), 299) + 1
    into v_next
  from public.service_orders
  where organization_id = new.organization_id and code ~ '^OS-\d+$';
  new.code := 'OS-' || v_next;
  return new;
end $$;

drop trigger if exists trg_os_code on public.service_orders;
create trigger trg_os_code before insert on public.service_orders
  for each row execute function public.fn_assign_os_code();

create unique index if not exists service_orders_org_code_unique
  on public.service_orders (organization_id, code) where code is not null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) VIEW unificada de leitura (marketplace_orders ∪ service_orders)
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace view public.v_orders_unified as
  select mo.id, mo.organization_id, 'Venda'::text as type,
         mo.external_order_id as code, mo.customer_name as client_name,
         mo.sold_at::timestamptz as date, mo.total_cents, mo.status
  from public.marketplace_orders mo
  union all
  select so.id, so.organization_id, 'O.S.'::text as type,
         so.code, so.contact_name as client_name,
         so.created_at as date, so.total_cents, so.status
  from public.service_orders so;

alter view public.v_orders_unified set (security_invoker = on);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5) Liga Venda → produto (habilita trigger de sales_count)
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.marketplace_orders
  add column if not exists product_id uuid references public.products(id) on delete set null;

-- qty pode já existir; só adiciona se não existir
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'marketplace_orders' and column_name = 'qty'
  ) then
    alter table public.marketplace_orders add column qty integer not null default 1;
  end if;
end $$;

create index if not exists marketplace_orders_org_product_idx
  on public.marketplace_orders (organization_id, product_id) where product_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6) CHECK CONSTRAINTS — a lacuna real (zero existiam até agora)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Pre-flight passed: zero violations on 18 products, 0 orders.
-- Using DO blocks so re-apply doesn't fail on duplicate constraint names.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_stock_nonneg') then
    alter table public.products add constraint products_stock_nonneg check (stock_qty >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_sold_nonneg') then
    alter table public.products add constraint products_sold_nonneg check (sold_qty >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_price_pos') then
    alter table public.products add constraint products_price_pos check (sale_price_cents is null or sale_price_cents > 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_grams_nonneg') then
    alter table public.products add constraint products_grams_nonneg check (filament_grams >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'products_margin_nonneg') then
    alter table public.products add constraint products_margin_nonneg check (margin_pct >= 0);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mo_total_nonneg') then
    alter table public.marketplace_orders add constraint mo_total_nonneg check (total_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'mo_qty_pos') then
    alter table public.marketplace_orders add constraint mo_qty_pos check (qty > 0);
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'so_total_nonneg') then
    alter table public.service_orders add constraint so_total_nonneg check (total_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'so_qty_pos') then
    alter table public.service_orders add constraint so_qty_pos check (qty > 0);
  end if;
end $$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7) TRIGGER — bump sold_qty / stock_qty quando venda concluída
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_bump_product_sales() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  -- dispara quando a Venda entra/transiciona para 'pago' ou 'concluido' com produto ligado
  if new.product_id is not null
     and new.status in ('pago', 'concluido')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then

    update public.products
      set sold_qty  = sold_qty + coalesce(new.qty, 1),
          stock_qty = greatest(0, stock_qty - coalesce(new.qty, 1)),
          updated_at = now()
    where id = new.product_id and organization_id = new.organization_id;

    -- Emite evento no bus interno (padrão do repo: trigger emite, worker consome)
    perform public.emit_event(
      'product.sold',              -- p_event_type
      'product',                   -- p_entity_kind
      new.product_id,              -- p_entity_id
      jsonb_build_object(          -- p_payload
        'marketplace_order_id', new.id,
        'qty', coalesce(new.qty, 1),
        'total_cents', new.total_cents
      ),
      '{}'::jsonb,                 -- p_metadata
      new.organization_id          -- p_organization_id
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_bump_sales on public.marketplace_orders;
create trigger trg_bump_sales
  after insert or update of status on public.marketplace_orders
  for each row execute function public.fn_bump_product_sales();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 8) GIN TRIGRAM INDEX — busca fuzzy por nome de produto (dashboard + landing)
-- ═══════════════════════════════════════════════════════════════════════════════
create index if not exists products_org_name_trgm
  on public.products using gin (name public.gin_trgm_ops);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 9) VIEW de custo calculado (NÃO coluna persistida — doutrina DIRC-C)
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace view public.v_products_costed as
select p.id, p.organization_id, p.name, p.sale_price_cents,
       p.filament_grams, p.print_time_seconds, p.category_id,
       c.name as category_name,
       -- material_cost: gramas × custo/grama do filamento vinculado
       round(p.filament_grams * coalesce(f.cost_per_gram, 0), 2) as material_cost,
       -- energy_cost: horas × potência_kW × tarifa_kWh da org
       round(
         (p.print_time_seconds / 3600.0)
         * (coalesce(pr.power_draw, 200) / 1000.0)
         * coalesce((o.settings->>'kwh_rate')::numeric, 0.92),
       2) as energy_cost
from public.products p
left join public.categories  c  on c.id = p.category_id
left join public.filaments   f  on f.client_id = p.filament_client_id
                                and f.organization_id = p.organization_id
left join public.printers    pr on pr.client_id = p.printer_client_id
                                and pr.organization_id = p.organization_id
left join public.organizations o on o.id = p.organization_id;
