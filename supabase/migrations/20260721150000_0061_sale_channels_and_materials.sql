-- 0061_sale_channels_and_materials
-- Dois catálogos de lookup por tenant, mesmo molde de public.categories (migration 0055):
--  - sale_channels: canal de venda, fonte única compartilhada entre O.S. e Vendas
--  - materials: sugestões de material de impressão para o campo livre service_orders.material
-- Seed dos 7 canais hoje hardcoded em SALES_PLATFORMS e de 3 materiais comuns, para
-- todas as orgs existentes, para não deixar os Comboboxes vazios no primeiro load.
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) SALE_CHANNELS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.sale_channels (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  sort_order      numeric,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint sale_channels_name_len check (char_length(name) between 1 and 120)
);
create unique index if not exists sale_channels_org_slug_unique
  on public.sale_channels (organization_id, slug);
create index if not exists sale_channels_org_idx
  on public.sale_channels (organization_id);

alter table public.sale_channels enable row level security;
drop policy if exists tenant_isolation_sale_channels_all on public.sale_channels;
create policy tenant_isolation_sale_channels_all on public.sale_channels
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.sale_channels from anon;

drop trigger if exists trg_sale_channels_audit on public.sale_channels;
create trigger trg_sale_channels_audit
  after insert or update or delete on public.sale_channels
  for each row execute function public.fn_audit_log_row();

drop trigger if exists trg_sale_channels_updated_at on public.sale_channels;
create trigger trg_sale_channels_updated_at
  before update on public.sale_channels
  for each row execute function public.fn_set_updated_at();

insert into public.sale_channels (organization_id, name, slug, sort_order)
select o.id, v.name, v.slug, v.sort_order
from public.organizations o
cross join (values
  ('B2B', 'b2b', 1),
  ('Shopee', 'shopee', 2),
  ('Facebook', 'facebook', 3),
  ('Mercado Livre', 'mercado-livre', 4),
  ('TikTok Shop', 'tiktok-shop', 5),
  ('Olx', 'olx', 6),
  ('Outro', 'outro', 7)
) as v(name, slug, sort_order)
on conflict (organization_id, slug) do nothing;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) MATERIALS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.materials (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  slug            text not null,
  sort_order      numeric,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint materials_name_len check (char_length(name) between 1 and 120)
);
create unique index if not exists materials_org_slug_unique
  on public.materials (organization_id, slug);
create index if not exists materials_org_idx
  on public.materials (organization_id);

alter table public.materials enable row level security;
drop policy if exists tenant_isolation_materials_all on public.materials;
create policy tenant_isolation_materials_all on public.materials
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.materials from anon;

drop trigger if exists trg_materials_audit on public.materials;
create trigger trg_materials_audit
  after insert or update or delete on public.materials
  for each row execute function public.fn_audit_log_row();

drop trigger if exists trg_materials_updated_at on public.materials;
create trigger trg_materials_updated_at
  before update on public.materials
  for each row execute function public.fn_set_updated_at();

insert into public.materials (organization_id, name, slug, sort_order)
select o.id, v.name, v.slug, v.sort_order
from public.organizations o
cross join (values ('PLA', 'pla', 1), ('ABS', 'abs', 2), ('PETG', 'petg', 3)) as v(name, slug, sort_order)
on conflict (organization_id, slug) do nothing;
