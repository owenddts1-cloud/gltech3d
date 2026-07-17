-- 0051_project_board
-- Evolui o "Quadro de Ideias" de Projetos para um quadro branco de briefing com RAIAS (fases).
-- project_notes ganha `phase` (nome da raia) e `sort_order` (ordem dentro da raia).
-- project_phases guarda as raias nomeadas (permite raia vazia — "Nova Fase").
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

alter table public.project_notes
  add column if not exists phase text,
  add column if not exists sort_order numeric not null default 0;

create table if not exists public.project_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  sort_order numeric not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_phases_org_idx on public.project_phases (organization_id, sort_order);

alter table public.project_phases enable row level security;
drop policy if exists tenant_isolation_project_phases_all on public.project_phases;
create policy tenant_isolation_project_phases_all on public.project_phases
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.project_phases from anon;

drop trigger if exists trg_project_phases_audit on public.project_phases;
create trigger trg_project_phases_audit
  after insert or update or delete on public.project_phases
  for each row execute function public.fn_audit_log_row();
