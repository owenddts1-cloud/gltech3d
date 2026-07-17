-- 0050_consumables
-- Consumíveis da oficina (filamentos, resinas) — estoque em GRAMAS, custo por kg.
-- Módulo próprio (não é inventory_assets, que é ATIVO FIXO): consumível se gasta e
-- tem estoque de material. Alimenta o "Sincronizar" da planilha de Controle (linhas
-- de categoria "Filamentos" viram consumíveis) e o alerta de estoque baixo.
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

create table if not exists public.consumables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  category text not null default 'filamento'
    check (category in ('filamento', 'resina', 'outro')),
  material text,                                   -- PLA, ABS, PETG, TPU, ...
  color text,
  stock_grams numeric not null default 0,         -- estoque atual em gramas
  min_stock_grams numeric not null default 0,     -- alerta de reposição
  cost_per_kg_cents bigint not null default 0,    -- custo por kg
  supplier text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists consumables_org_idx on public.consumables (organization_id);
create index if not exists consumables_org_cat_idx on public.consumables (organization_id, category);

alter table public.consumables enable row level security;
drop policy if exists tenant_isolation_consumables_all on public.consumables;
create policy tenant_isolation_consumables_all on public.consumables
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.consumables from anon;

drop trigger if exists trg_consumables_audit on public.consumables;
create trigger trg_consumables_audit
  after insert or update or delete on public.consumables
  for each row execute function public.fn_audit_log_row();
