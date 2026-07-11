-- 0034_projects
-- Projetos técnicos de fabricação (parâmetros de fatiamento + custo) e o quadro
-- de ideias (project_notes), saindo do localStorage para o banco (multi-tenant).
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

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

-- Quadro de ideias (post-its)
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
