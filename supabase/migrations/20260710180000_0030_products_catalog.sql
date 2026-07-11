-- 0030_products_catalog
-- Catálogo de produtos com engenharia de custo (BOM): custo real derivado de
-- gramas de filamento × custo/g + energia + depreciação + insumos extras, com
-- margem → preço sugerido. Tenant-scoped + RLS + audit.
-- Referencia filaments/printers por client_id (lógico, mesmos ids do frontend).
-- Idempotent — safe to re-apply.

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  images jsonb not null default '[]'::jsonb,        -- array de URLs
  filament_client_id text,                          -- filaments.client_id
  filament_grams numeric not null default 0,
  print_time_seconds integer not null default 0,
  printer_client_id text,                           -- printers.client_id (depreciação)
  extra_costs jsonb not null default '[]'::jsonb,   -- [{ label, cost_cents }]
  margin_pct numeric not null default 100,
  sale_price_cents bigint,                          -- override manual do preço (opcional)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_org_idx on public.products (organization_id);
create index if not exists products_org_category_idx on public.products (organization_id, category);

alter table public.products enable row level security;
drop policy if exists tenant_isolation_products_all on public.products;
create policy tenant_isolation_products_all on public.products
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.products from anon;

drop trigger if exists trg_products_audit on public.products;
create trigger trg_products_audit
  after insert or update or delete on public.products
  for each row execute function public.fn_audit_log_row();
