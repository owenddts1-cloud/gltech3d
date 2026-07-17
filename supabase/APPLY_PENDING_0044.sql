-- =============================================================================
-- APLICAR PENDÊNCIA — migration 0044_calendar_events
-- =============================================================================
-- Cole este arquivo INTEIRO no Supabase SQL Editor e clique em "Run".
-- Idempotente; roda numa transação (rollback automático se algo falhar).
-- =============================================================================

begin;

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  event_date date not null,
  type text not null default 'custom'
    check (type in ('maintenance', 'meeting', 'delivery', 'custom')),
  printer_name text,
  contact_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists calendar_events_org_date_idx
  on public.calendar_events (organization_id, event_date);

alter table public.calendar_events enable row level security;
drop policy if exists tenant_isolation_calendar_events_all on public.calendar_events;
create policy tenant_isolation_calendar_events_all on public.calendar_events
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.calendar_events from anon;

drop trigger if exists trg_calendar_events_audit on public.calendar_events;
create trigger trg_calendar_events_audit
  after insert or update or delete on public.calendar_events
  for each row execute function public.fn_audit_log_row();

commit;

-- CONFERÊNCIA (rode após o commit):
--   select relrowsecurity from pg_class where relname = 'calendar_events';  -- t
--   select count(*) from pg_trigger where tgname = 'trg_calendar_events_audit'; -- 1
