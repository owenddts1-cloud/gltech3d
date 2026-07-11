-- 0035_suppliers
-- Cadastro real de fornecedores + histórico de compras de insumos, saindo do
-- localStorage para o banco (multi-tenant). Tenant-scoped + RLS + audit.
-- Idempotent — safe to re-apply.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'filament'
    check (category in ('filament', 'printer', 'shipping', 'tools', 'other')),
  contact_person text,
  phone text,
  website text,
  rating integer not null default 5 check (rating between 1 and 5),
  avg_delivery_days integer not null default 5,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists suppliers_org_idx on public.suppliers (organization_id);

alter table public.suppliers enable row level security;
drop policy if exists tenant_isolation_suppliers_all on public.suppliers;
create policy tenant_isolation_suppliers_all on public.suppliers
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.suppliers from anon;

drop trigger if exists trg_suppliers_audit on public.suppliers;
create trigger trg_suppliers_audit
  after insert or update or delete on public.suppliers
  for each row execute function public.fn_audit_log_row();

-- Histórico de compras de insumos
create table if not exists public.supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null,               -- snapshot (independe do fornecedor)
  item_name text not null,
  qty integer not null default 1,
  unit_price_cents bigint not null default 0,
  purchased_at date not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists supplier_purchases_org_idx
  on public.supplier_purchases (organization_id, purchased_at desc);

alter table public.supplier_purchases enable row level security;
drop policy if exists tenant_isolation_supplier_purchases_all on public.supplier_purchases;
create policy tenant_isolation_supplier_purchases_all on public.supplier_purchases
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.supplier_purchases from anon;

drop trigger if exists trg_supplier_purchases_audit on public.supplier_purchases;
create trigger trg_supplier_purchases_audit
  after insert or update or delete on public.supplier_purchases
  for each row execute function public.fn_audit_log_row();
