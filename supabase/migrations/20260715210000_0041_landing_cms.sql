-- 0041_landing_cms
-- Landing Edit: transforma `products` na fonte de verdade única da landing
-- pública, que até aqui lia um arquivo TS estático (lib/marketing/products.ts).
-- Acrescenta os campos de vitrine (slug, publicação, pódio de mais vendidos,
-- links de plataforma, ficha) e de comércio (estoque, vendidos) ao catálogo que
-- já carrega a engenharia de custo (migration 0030).
--
-- Acrescenta também:
--   landing_settings     — textos/banners por seção da landing (1 linha por org)
--   platform_commissions — % de comissão por plataforma, entrada manual
--
-- NÃO concede acesso a `anon`: a landing é Server Component e lê via admin
-- client com organization_id resolvido de env (fonte confiável). Expor products
-- ao anon vazaria filament_grams/extra_costs/margin_pct — a estrutura de custo
-- inteira — já que a anon key é pública no browser.
--
-- Idempotent — safe to re-apply.

-- =============================================================================
-- products — campos de vitrine e de comércio
-- =============================================================================
alter table public.products
  add column if not exists slug text,
  add column if not exists is_published boolean not null default false,
  add column if not exists is_top boolean not null default false,
  add column if not exists bestseller_rank smallint,
  add column if not exists sort_order numeric,
  add column if not exists hero_copy text,
  add column if not exists price_range text,
  add column if not exists links jsonb not null default '{}'::jsonb,
  add column if not exists videos jsonb not null default '[]'::jsonb,
  add column if not exists colors jsonb not null default '[]'::jsonb,
  add column if not exists material text,
  add column if not exists dimensions text,
  add column if not exists stock_qty integer not null default 0,
  add column if not exists sold_qty integer not null default 0;

comment on column public.products.slug is
  'Identificador da peça na URL pública (/product/<slug>). Único por org.';
comment on column public.products.is_published is
  'Falso = rascunho, invisível na landing. Toda peça nasce despublicada.';
comment on column public.products.is_top is
  'Selo "Destaque" no card. Independe de bestseller_rank.';
comment on column public.products.bestseller_rank is
  '1..3 = pódio "Mais Vendidos" da landing. Null = fora do pódio.';
comment on column public.products.sort_order is
  'Ordem manual na galeria. Numeric para permitir fractional indexing
   (inserir entre dois vizinhos sem reescrever a coluna inteira).';
comment on column public.products.price_range is
  'Faixa de preço exibida quando a peça tem variações (ex.: "16,90 - 32,90").';
comment on column public.products.sold_qty is
  'Vendas acumuladas, lançamento manual. Alimenta a ordenação do pódio.';

-- Guardas de integridade. Criadas via DO block porque `add constraint if not
-- exists` não existe em Postgres.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_bestseller_rank_range') then
    alter table public.products
      add constraint products_bestseller_rank_range
      check (bestseller_rank is null or bestseller_rank between 1 and 3);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_stock_qty_non_negative') then
    alter table public.products
      add constraint products_stock_qty_non_negative check (stock_qty >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'products_sold_qty_non_negative') then
    alter table public.products
      add constraint products_sold_qty_non_negative check (sold_qty >= 0);
  end if;
end $$;

-- Dedup defensivo antes dos índices únicos: um banco de clone pode já ter
-- linhas com slug repetido ou dois produtos no mesmo degrau do pódio.
-- Sem isto, o update.sh do kit self-host quebra ao criar o índice.
with ranked as (
  select id,
         row_number() over (partition by organization_id, slug order by created_at, id) as rn
  from public.products
  where slug is not null
)
update public.products p
set slug = p.slug || '-' || left(replace(p.id::text, '-', ''), 6)
from ranked r
where p.id = r.id and r.rn > 1;

with ranked as (
  select id,
         row_number() over (partition by organization_id, bestseller_rank order by sold_qty desc, created_at, id) as rn
  from public.products
  where bestseller_rank is not null
)
update public.products p
set bestseller_rank = null
from ranked r
where p.id = r.id and r.rn > 1;

create unique index if not exists products_org_slug_unique
  on public.products (organization_id, slug)
  where slug is not null;

-- Um único campeão, um único 2º, um único 3º por org.
create unique index if not exists products_org_bestseller_rank_unique
  on public.products (organization_id, bestseller_rank)
  where bestseller_rank is not null;

create index if not exists products_org_published_idx
  on public.products (organization_id, is_published)
  where is_published;

-- =============================================================================
-- landing_settings — textos e banners da landing (1 linha por org)
-- =============================================================================
create table if not exists public.landing_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  -- Textos por seção: { "<secao>": { "eyebrow": "...", "title": "...", ... } }.
  -- jsonb (e não colunas) porque as seções da landing mudam com o design; o
  -- schema de leitura é declarado em Zod na app (lib/landing/schema.ts).
  sections jsonb not null default '{}'::jsonb,
  -- Links globais de plataforma: { "shopee": "https://...", "whatsapp": "..." }
  links jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landing_settings_org_unique unique (organization_id)
);

alter table public.landing_settings enable row level security;
drop policy if exists tenant_isolation_landing_settings_all on public.landing_settings;
create policy tenant_isolation_landing_settings_all on public.landing_settings
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.landing_settings from anon;

drop trigger if exists trg_landing_settings_audit on public.landing_settings;
create trigger trg_landing_settings_audit
  after insert or update or delete on public.landing_settings
  for each row execute function public.fn_audit_log_row();

-- =============================================================================
-- platform_commissions — % de comissão por plataforma (entrada manual)
-- =============================================================================
-- Lista de plataformas espelha o check de financial_records.platform
-- (migration 0037) para os dois módulos falarem a mesma língua.
create table if not exists public.platform_commissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null,
  commission_pct numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_commissions_org_platform_unique unique (organization_id, platform),
  constraint platform_commissions_platform_known check (
    platform in ('B2B', 'Shopee', 'Facebook', 'Mercado Livre', 'TikTok Shop', 'Olx', 'Outro')
  ),
  constraint platform_commissions_pct_range check (commission_pct >= 0 and commission_pct <= 100)
);
create index if not exists platform_commissions_org_idx
  on public.platform_commissions (organization_id);

alter table public.platform_commissions enable row level security;
drop policy if exists tenant_isolation_platform_commissions_all on public.platform_commissions;
create policy tenant_isolation_platform_commissions_all on public.platform_commissions
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.platform_commissions from anon;

drop trigger if exists trg_platform_commissions_audit on public.platform_commissions;
create trigger trg_platform_commissions_audit
  after insert or update or delete on public.platform_commissions
  for each row execute function public.fn_audit_log_row();

-- Toda org existente ganha as 7 plataformas em 0% — o dono ajusta na tela.
-- Genérico de propósito: nenhum id de tenant hardcoded.
insert into public.platform_commissions (organization_id, platform, commission_pct)
select o.id, p.platform, 0
from public.organizations o
cross join (
  values ('B2B'), ('Shopee'), ('Facebook'), ('Mercado Livre'),
         ('TikTok Shop'), ('Olx'), ('Outro')
) as p(platform)
on conflict (organization_id, platform) do nothing;
