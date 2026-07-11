-- 0029_service_orders
-- Ordens de Serviço (OS) — board de orçamento→produção→concluído da fazenda 3D.
-- Tenant-scoped + RLS + audit. Referencia contacts (cliente) e projects (nullable).
-- Idempotent — safe to re-apply.

create table if not exists public.service_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  contact_name text,                       -- snapshot de exibição (independe do contato)
  status text not null default 'orcamento'
    check (status in ('orcamento', 'aprovado', 'em_producao', 'concluido')),
  total_cents bigint not null default 0,
  qty integer not null default 1,
  sla_due_at timestamptz,
  slicer_notes jsonb not null default '{}'::jsonb,  -- layer_height, infill, supports, notes
  position integer not null default 0,     -- ordenação dentro da coluna (dnd)
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
