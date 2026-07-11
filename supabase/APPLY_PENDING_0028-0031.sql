-- =============================================================================
-- APLICAR PENDÊNCIAS — migrations 0028, 0029, 0030, 0031, 0032, 0033, 0034, 0035
-- =============================================================================
-- Cole este arquivo INTEIRO no Supabase SQL Editor e clique em "Run".
-- Todas as instruções são idempotentes (safe to re-apply) e rodam numa única
-- transação — se algo falhar, nada é aplicado (rollback automático).
--
-- Ordem obrigatória: 0028 (impressoras) → 0029 (OS) → 0030 (produtos) →
-- 0031 (estágios/prioridade/material da OS, que depende de service_orders).
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 0028_printers_module — filaments, printers, print_jobs (RLS + audit)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.filaments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id text not null,
  name text not null,
  material text,
  color text,
  initial_weight_grams numeric not null default 0,
  weight_grams numeric not null default 0,
  cost_per_gram numeric not null default 0,
  min_weight_alert numeric not null default 0,
  supplier text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint filaments_org_client_unique unique (organization_id, client_id)
);
create index if not exists filaments_org_idx on public.filaments (organization_id);
alter table public.filaments enable row level security;
drop policy if exists tenant_isolation_filaments_all on public.filaments;
create policy tenant_isolation_filaments_all on public.filaments
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.filaments from anon;
drop trigger if exists trg_filaments_audit on public.filaments;
create trigger trg_filaments_audit
  after insert or update or delete on public.filaments
  for each row execute function public.fn_audit_log_row();

create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id text not null,
  name text not null,
  status text not null default 'idle' check (status in ('idle', 'printing', 'error', 'offline')),
  power_draw integer not null default 200,
  depreciation_per_hour numeric not null default 0.40,
  active_filament_id text,
  active_print_job jsonb,
  network_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint printers_org_client_unique unique (organization_id, client_id)
);
create index if not exists printers_org_idx on public.printers (organization_id);
alter table public.printers enable row level security;
drop policy if exists tenant_isolation_printers_all on public.printers;
create policy tenant_isolation_printers_all on public.printers
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.printers from anon;
drop trigger if exists trg_printers_audit on public.printers;
create trigger trg_printers_audit
  after insert or update or delete on public.printers
  for each row execute function public.fn_audit_log_row();

create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  printer_client_id text,
  printer_name text,
  filename text,
  weight_grams numeric not null default 0,
  print_time_seconds integer not null default 0,
  filament_client_id text,
  filament_name text,
  material_cost numeric,
  energy_cost numeric,
  depreciation_cost numeric,
  total_cost numeric,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists print_jobs_org_completed_idx
  on public.print_jobs (organization_id, completed_at desc);
alter table public.print_jobs enable row level security;
drop policy if exists tenant_isolation_print_jobs_all on public.print_jobs;
create policy tenant_isolation_print_jobs_all on public.print_jobs
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.print_jobs from anon;
drop trigger if exists trg_print_jobs_audit on public.print_jobs;
create trigger trg_print_jobs_audit
  after insert or update or delete on public.print_jobs
  for each row execute function public.fn_audit_log_row();

-- ─────────────────────────────────────────────────────────────────────────
-- 0029_service_orders — board de OS (RLS + audit)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text,
  status text not null default 'orcamento'
    check (status in ('orcamento', 'aprovado', 'em_producao', 'concluido')),
  total_cents bigint not null default 0,
  qty integer not null default 1,
  sla_due_at timestamptz,
  slicer_notes jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists service_orders_org_status_idx
  on public.service_orders (organization_id, status, position);
create index if not exists service_orders_org_sla_idx
  on public.service_orders (organization_id, sla_due_at);
alter table public.service_orders enable row level security;
drop policy if exists tenant_isolation_service_orders_all on public.service_orders;
create policy tenant_isolation_service_orders_all on public.service_orders
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.service_orders from anon;
drop trigger if exists trg_service_orders_audit on public.service_orders;
create trigger trg_service_orders_audit
  after insert or update or delete on public.service_orders
  for each row execute function public.fn_audit_log_row();

-- ─────────────────────────────────────────────────────────────────────────
-- 0030_products_catalog — catálogo + BOM (RLS + audit)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text,
  description text,
  images jsonb not null default '[]'::jsonb,
  filament_client_id text,
  filament_grams numeric not null default 0,
  print_time_seconds integer not null default 0,
  printer_client_id text,
  extra_costs jsonb not null default '[]'::jsonb,
  margin_pct numeric not null default 100,
  sale_price_cents bigint,
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

-- ─────────────────────────────────────────────────────────────────────────
-- 0031_service_orders_stages — +2 estágios, priority, material
-- ─────────────────────────────────────────────────────────────────────────
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders add constraint service_orders_status_check
  check (status in (
    'orcamento', 'aprovado', 'em_producao', 'pos_processamento', 'pronto_entrega', 'concluido'
  ));
alter table public.service_orders add column if not exists priority text not null default 'media';
alter table public.service_orders drop constraint if exists service_orders_priority_check;
alter table public.service_orders add constraint service_orders_priority_check
  check (priority in ('alta', 'media', 'baixa'));
alter table public.service_orders add column if not exists material text;

-- ─────────────────────────────────────────────────────────────────────────
-- 0032_print_jobs_service_order — vínculo impressão ↔ OS
-- ─────────────────────────────────────────────────────────────────────────
alter table public.print_jobs
  add column if not exists service_order_id uuid
  references public.service_orders(id) on delete set null;
create index if not exists print_jobs_org_service_order_idx
  on public.print_jobs (organization_id, service_order_id);

-- ─────────────────────────────────────────────────────────────────────────
-- 0033_inventory_assets — patrimônio da oficina (RLS + audit)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.inventory_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'outro'
    check (category in ('impressora', 'ferramenta', 'movel', 'computador', 'estufa', 'eletronico', 'outro')),
  quantity integer not null default 1,
  purchase_value_cents bigint not null default 0,
  purchase_date date,
  useful_life_months integer not null default 60,
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

-- ─────────────────────────────────────────────────────────────────────────
-- 0034_projects — projetos técnicos + quadro de ideias (RLS + audit)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  filament_type text,
  weight_grams numeric not null default 0,
  print_hours numeric not null default 0,
  layer_height numeric not null default 0.2,
  infill text,
  speed integer not null default 0,
  nozzle_temp integer not null default 0,
  bed_temp integer not null default 0,
  description text,
  filament_cost_per_kg numeric not null default 0,
  wattage integer not null default 0,
  kwh_price numeric not null default 0.85,
  depreciation_per_hour numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists projects_org_idx on public.projects (organization_id, created_at desc);
alter table public.projects enable row level security;
drop policy if exists tenant_isolation_projects_all on public.projects;
create policy tenant_isolation_projects_all on public.projects
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.projects from anon;
drop trigger if exists trg_projects_audit on public.projects;
create trigger trg_projects_audit
  after insert or update or delete on public.projects
  for each row execute function public.fn_audit_log_row();

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  content text not null,
  color text not null default 'yellow' check (color in ('yellow', 'pink', 'blue', 'green')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_notes_org_idx on public.project_notes (organization_id, created_at desc);
alter table public.project_notes enable row level security;
drop policy if exists tenant_isolation_project_notes_all on public.project_notes;
create policy tenant_isolation_project_notes_all on public.project_notes
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.project_notes from anon;
drop trigger if exists trg_project_notes_audit on public.project_notes;
create trigger trg_project_notes_audit
  after insert or update or delete on public.project_notes
  for each row execute function public.fn_audit_log_row();

-- ─────────────────────────────────────────────────────────────────────────
-- 0035_suppliers — fornecedores + histórico de compras (RLS + audit)
-- ─────────────────────────────────────────────────────────────────────────
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

create table if not exists public.supplier_purchases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text not null,
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

commit;

-- =============================================================================
-- Verificação rápida (rode depois; deve listar as 4 tabelas e as colunas novas):
--   select table_name from information_schema.tables
--     where table_schema='public'
--       and table_name in ('filaments','printers','print_jobs','service_orders','products');
--   select column_name from information_schema.columns
--     where table_schema='public' and table_name='service_orders'
--       and column_name in ('priority','material');
-- =============================================================================
