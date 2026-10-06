-- 0084 — role-based DELETE on business tables + suspended orgs lose RLS access
--
-- WHAT
--   1. `fn_user_org_ids()` and `fn_user_role_in_org()` only return orgs whose
--      `organizations.status = 'active'`. Before this, suspending a tenant
--      (app/api/v1/admin/tenants/[id]/suspend) only redirected the PAGES to
--      /account-suspended; the members' JWT still passed every RLS policy, so
--      PostgREST, Realtime and any server action kept reading and writing the
--      suspended org's data. Every tenant policy, `fn_role_at_least`,
--      `fn_user_role_in` and `fn_assert_org_access` (0083) are built on these
--      two helpers, so fixing them closes all of it at once. Platform admins
--      are unaffected (they pass through `fn_is_platform_admin()`), and so is
--      the service role (bypasses RLS).
--   2. The `*_all` FOR ALL tenant policy on the tables below let ANY member —
--      viewer included — DELETE. It is split into SELECT / INSERT / UPDATE for
--      members (same expression as before, WITH CHECK kept on insert/update)
--      plus a DELETE policy gated by role:
--        admin   : contacts (LGPD prefers anonymisation; a hard delete loses the
--                  conversation history), financial_records (the books).
--        manager : crm_leads, conversations, messages, print_jobs,
--                  service_orders, products, inventory_assets, projects,
--                  suppliers, supplier_purchases, calendar_events,
--                  marketplace_orders, service_order_documents.
--        member  : filaments, printers, service_order_items — their save
--                  actions are REPLACE-ALL (upsert the list, then delete what
--                  the user removed), so deletion is part of an ordinary edit
--                  that any member performs:
--                  app/actions/printers/actions.ts savePrintersAndFilaments,
--                  app/actions/service-orders/items.ts saveServiceOrderItems.
--      Platform admin may always delete. FK cascades (e.g. deleting a service
--      order removes its items) are referential actions and are not subject to
--      RLS, so they keep working.
--      NOTE: a DELETE with no matching policy does not raise — it deletes 0
--      rows. The app actions that delete check the affected row count and
--      report the denial instead of returning success.
--
-- Idempotent: create or replace / drop policy if exists. The DO block skips a
-- table that does not exist (defensive for partial clones). No BEGIN/COMMIT
-- (the runner wraps it).

-- 1. ------------------------------------------------------------------------
create or replace function public.fn_user_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path to 'public'
as $$
  select uo.organization_id
    from public.user_organizations uo
    join public.organizations o on o.id = uo.organization_id
   where uo.user_id = auth.uid()
     and uo.revoked_at is null
     and o.status = 'active';
$$;

comment on function public.fn_user_org_ids() is
  'Orgs the JWT caller belongs to (membership not revoked AND organizations.status = active). Migration 0084.';

create or replace function public.fn_user_role_in_org(p_org uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select uo.role
    from public.user_organizations uo
    join public.organizations o on o.id = uo.organization_id
   where uo.user_id = auth.uid()
     and uo.organization_id = p_org
     and uo.revoked_at is null
     and o.status = 'active'
   limit 1;
$$;

comment on function public.fn_user_role_in_org(uuid) is
  'Role of the JWT caller in an ACTIVE org (null if not a member or the org is suspended). Migration 0084.';

-- 2. ------------------------------------------------------------------------
do $$
declare
  r record;
  v_member text;
  v_delete text;
begin
  for r in
    select * from (values
      ('contacts',                'tenant_isolation_contacts',                'admin',   true),
      ('financial_records',       'tenant_isolation_financial_records',       'admin',   false),
      ('crm_leads',               'tenant_isolation_crm_leads',               'manager', true),
      ('conversations',           'conversations_tenant_isolation',           'manager', true),
      ('messages',                'messages_tenant_isolation',                'manager', true),
      ('print_jobs',              'tenant_isolation_print_jobs',              'manager', false),
      ('service_orders',          'tenant_isolation_service_orders',          'manager', false),
      ('products',                'tenant_isolation_products',                'manager', false),
      ('inventory_assets',        'tenant_isolation_inventory_assets',        'manager', false),
      ('projects',                'tenant_isolation_projects',                'manager', false),
      ('suppliers',               'tenant_isolation_suppliers',               'manager', false),
      ('supplier_purchases',      'tenant_isolation_supplier_purchases',      'manager', false),
      ('calendar_events',         'tenant_isolation_calendar_events',         'manager', false),
      ('marketplace_orders',      'tenant_isolation_marketplace_orders',      'manager', false),
      ('service_order_documents', 'tenant_isolation_service_order_documents', 'manager', false),
      ('filaments',               'tenant_isolation_filaments',               'member',  false),
      ('printers',                'tenant_isolation_printers',                'member',  false),
      ('service_order_items',     'tenant_isolation_service_order_items',     'member',  false)
    ) as t(tbl, prefix, delete_min_role, with_platform_admin)
  loop
    if to_regclass(format('public.%I', r.tbl)) is null then
      raise notice '0084: table public.% not found, skipped', r.tbl;
      continue;
    end if;

    -- Same expression the old FOR ALL policy used for this table.
    v_member := case when r.with_platform_admin
      then '(organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin())'
      else '(organization_id in (select public.fn_user_org_ids()))'
    end;

    v_delete := case when r.delete_min_role = 'member'
      then v_member
      else format('(public.fn_role_at_least(organization_id, %L) or public.fn_is_platform_admin())', r.delete_min_role)
    end;

    execute format('drop policy if exists %I on public.%I', r.prefix || '_all', r.tbl);

    execute format('drop policy if exists %I on public.%I', r.prefix || '_select', r.tbl);
    execute format('create policy %I on public.%I for select using %s',
                   r.prefix || '_select', r.tbl, v_member);

    execute format('drop policy if exists %I on public.%I', r.prefix || '_insert', r.tbl);
    execute format('create policy %I on public.%I for insert with check %s',
                   r.prefix || '_insert', r.tbl, v_member);

    execute format('drop policy if exists %I on public.%I', r.prefix || '_update', r.tbl);
    execute format('create policy %I on public.%I for update using %s with check %s',
                   r.prefix || '_update', r.tbl, v_member, v_member);

    execute format('drop policy if exists %I on public.%I', r.prefix || '_delete', r.tbl);
    execute format('create policy %I on public.%I for delete using %s',
                   r.prefix || '_delete', r.tbl, v_delete);
  end loop;
end $$;
