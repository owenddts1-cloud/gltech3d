-- 0086 — control_sheets: the custom tabs of the "Controle" screen move to the DB
--
-- WHAT / WHY
--   The Controle screen (app/app/(pro)/control) lets the user add free-form
--   spreadsheet tabs next to the built-in ones. Those tabs lived only in the
--   browser's localStorage: switching device or clearing the browser lost the
--   data, and nobody else in the org saw it (the screen even carried a notice
--   saying so). This table makes them per-org records.
--
--   DIRC: the grid is one document edited as a whole (autosave writes the full
--   matrix), never queried cell by cell, so `cells` is jsonb (array of arrays of
--   strings) and NOT a cells table — a row per cell would mean up to 6000 rows
--   rewritten on every autosave. Its shape is defined in ONE place,
--   lib/control/sheets.ts (Zod, 200 rows x 30 cols, 500 chars per cell); the
--   CHECK below is the backstop against a client that skips the app.
--   `columns` holds optional column titles/widths (same Zod module).
--
--   RLS: any member SELECTs; agent and above (or platform admin) insert,
--   update and DELETE. Unlike the business tables of migration 0084 there is
--   no manager gate on delete: a sheet is scratch space of whoever edits the
--   screen and removing a tab is ordinary editing (same reasoning as
--   filaments/printers in 0084). A viewer stays read-only, as everywhere else.
--   created_by defaults to auth.uid(), INSERT refuses another user id and a
--   trigger keeps it unchanged on UPDATE (authorship is not editable).
--
--   AUDIT: row audit on insert, delete and RENAME only (`update of name`).
--   Cell autosave runs every ~800 ms while typing; auditing it would write one
--   api_audit_log row per keystroke burst into a 5-year append-only log.
--
-- Idempotent: create ... if not exists, drop ... if exists before create.

create table if not exists public.control_sheets (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name            text not null,
  position        numeric not null default 0,
  cells           jsonb not null default '[]'::jsonb,
  columns         jsonb,
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Re-applied over a table created before the default existed.
alter table public.control_sheets alter column created_by set default auth.uid();

alter table public.control_sheets drop constraint if exists control_sheets_name_length;
alter table public.control_sheets add constraint control_sheets_name_length
  check (char_length(name) between 1 and 60);

alter table public.control_sheets drop constraint if exists control_sheets_cells_shape;
alter table public.control_sheets add constraint control_sheets_cells_shape
  check (jsonb_typeof(cells) = 'array');

alter table public.control_sheets drop constraint if exists control_sheets_cells_size;
alter table public.control_sheets add constraint control_sheets_cells_size
  check (octet_length(cells::text) < 1000000);

alter table public.control_sheets drop constraint if exists control_sheets_columns_size;
alter table public.control_sheets add constraint control_sheets_columns_size
  check (columns is null or octet_length(columns::text) < 100000);

create index if not exists control_sheets_org_position_idx
  on public.control_sheets (organization_id, position);

alter table public.control_sheets enable row level security;

-- Read: any member of the (active) org. Write: agent and above, or platform
-- admin. A `viewer` is read-only everywhere else in the product, and is here too.
drop policy if exists tenant_isolation_control_sheets_all on public.control_sheets;
drop policy if exists tenant_isolation_control_sheets_select on public.control_sheets;
create policy tenant_isolation_control_sheets_select on public.control_sheets
  for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_control_sheets_insert on public.control_sheets;
create policy tenant_isolation_control_sheets_insert on public.control_sheets
  for insert with check (
    (public.fn_role_at_least(organization_id, 'agent') or public.fn_is_platform_admin())
    and (created_by is null or created_by = auth.uid())
  );
drop policy if exists tenant_isolation_control_sheets_update on public.control_sheets;
create policy tenant_isolation_control_sheets_update on public.control_sheets
  for update using (public.fn_role_at_least(organization_id, 'agent') or public.fn_is_platform_admin())
  with check (public.fn_role_at_least(organization_id, 'agent') or public.fn_is_platform_admin());
drop policy if exists tenant_isolation_control_sheets_delete on public.control_sheets;
create policy tenant_isolation_control_sheets_delete on public.control_sheets
  for delete using (public.fn_role_at_least(organization_id, 'agent') or public.fn_is_platform_admin());

revoke all on public.control_sheets from anon;
grant select, insert, update, delete on public.control_sheets to authenticated;
grant all on public.control_sheets to service_role;

drop trigger if exists trg_control_sheets_updated_at on public.control_sheets;
create trigger trg_control_sheets_updated_at
  before update on public.control_sheets
  for each row execute function public.fn_set_updated_at();

-- `created_by` is authorship, not editable data. INSERT: the column defaults
-- to the caller and the policy refuses anyone else's id. UPDATE: RLS cannot
-- compare old and new values (another agent legitimately edits the sheet), so
-- a trigger keeps the original author.
create or replace function public.fn_control_sheets_keep_created_by()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.created_by := old.created_by;
  return new;
end $$;

drop trigger if exists trg_control_sheets_keep_created_by on public.control_sheets;
create trigger trg_control_sheets_keep_created_by
  before update on public.control_sheets
  for each row execute function public.fn_control_sheets_keep_created_by();

drop trigger if exists trg_control_sheets_audit on public.control_sheets;
create trigger trg_control_sheets_audit
  after insert or delete or update of name on public.control_sheets
  for each row execute function public.fn_audit_log_row();

comment on table public.control_sheets is
  'Custom spreadsheet tabs of the Controle screen, per org. cells = jsonb array of string arrays (shape in lib/control/sheets.ts). Migration 0086.';
