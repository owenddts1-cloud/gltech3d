-- 0033_inventory_assets
-- Inventário de ativos fixos da oficina (impressoras como patrimônio, ferramentas,
-- móveis, computadores, estufas), com valor de compra e depreciação linear.
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

create table if not exists public.inventory_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'outro'
    check (category in ('impressora', 'ferramenta', 'movel', 'computador', 'estufa', 'eletronico', 'outro')),
  quantity integer not null default 1,
  purchase_value_cents bigint not null default 0,   -- valor de compra unitário
  purchase_date date,
  useful_life_months integer not null default 60,   -- vida útil p/ depreciação linear
  status text not null default 'ativo'
    check (status in ('ativo', 'manutencao', 'inativo')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists inventory_assets_org_idx on public.inventory_assets (organization_id);
create index if not exists inventory_assets_org_status_idx on public.inventory_assets (organization_id, status);

alter table public.inventory_assets enable row level security;
drop policy if exists tenant_isolation_inventory_assets_all on public.inventory_assets;
create policy tenant_isolation_inventory_assets_all on public.inventory_assets
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.inventory_assets from anon;

drop trigger if exists trg_inventory_assets_audit on public.inventory_assets;
create trigger trg_inventory_assets_audit
  after insert or update or delete on public.inventory_assets
  for each row execute function public.fn_audit_log_row();
