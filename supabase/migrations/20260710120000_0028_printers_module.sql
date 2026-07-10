-- 0028_printers_module
-- Fazenda de impressão 3D: migra impressoras/filamentos/jobs de
-- organizations.settings (jsonb) para tabelas dedicadas com RLS por tenant,
-- índices e audit. Resolve read-modify-write concorrente e habilita baixa de
-- estoque row-level pelo webhook de telemetria.
-- PK uuid + client_id text (id gerado no cliente, ex: 'prn_1'), único por org —
-- mantém o contrato do frontend existente sem reescrevê-lo.
-- Idempotent — safe to re-apply.

-- =============================================================================
-- filaments
-- =============================================================================
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

-- =============================================================================
-- printers
-- =============================================================================
create table if not exists public.printers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  client_id text not null,
  name text not null,
  status text not null default 'idle' check (status in ('idle', 'printing', 'error', 'offline')),
  power_draw integer not null default 200,
  depreciation_per_hour numeric not null default 0.40,
  active_filament_id text,          -- referencia filaments.client_id (lógico, sem FK dura)
  active_print_job jsonb,           -- snapshot transiente de telemetria
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

-- =============================================================================
-- print_jobs (histórico; alimentado pelo webhook de telemetria e pelo app)
-- =============================================================================
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
