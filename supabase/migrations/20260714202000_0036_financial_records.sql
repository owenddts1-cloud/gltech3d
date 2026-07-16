-- 0036_financial_records
-- Planilha de controle financeiro e lançamentos de receitas/despesas da empresa (multi-tenant).
-- Tenant-scoped + RLS + audit.
-- Idempotent — safe to re-apply.

create table if not exists public.financial_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  date date not null default current_date,
  month text not null,
  quantity integer not null default 1 check (quantity >= 0),
  description text not null,
  type text not null check (type in ('Receita', 'Despesa')),
  category text not null,
  classification text not null default 'Outro' check (classification in ('Venda', 'Insumo', 'Outro')),
  revenue_cents bigint not null default 0 check (revenue_cents >= 0),
  expense_cents bigint not null default 0 check (expense_cents >= 0),
  installments text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_records_org_idx on public.financial_records (organization_id, date desc);

alter table public.financial_records enable row level security;
drop policy if exists tenant_isolation_financial_records_all on public.financial_records;
create policy tenant_isolation_financial_records_all on public.financial_records
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));

revoke all on public.financial_records from anon;

drop trigger if exists trg_financial_records_audit on public.financial_records;
create trigger trg_financial_records_audit
  after insert or update or delete on public.financial_records
  for each row execute function public.fn_audit_log_row();
