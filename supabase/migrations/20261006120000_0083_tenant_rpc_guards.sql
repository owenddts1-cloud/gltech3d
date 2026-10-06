-- 0083 — tenant guards on SECURITY DEFINER RPCs, private bucket listing, audit insert
--
-- WHAT
--   1. `fn_assert_org_access(uuid)`: raises 42501 unless the caller belongs to
--      the org (or is platform admin). Calls with no JWT (direct connection,
--      pg_cron, migrations) and the service role pass — they are trusted.
--   2. `emit_event` calls it. `fn_log_event` delegates to `emit_event`, so it is
--      covered too. Before this, any logged-in user could append rows to ANY
--      org's `event_log` (these functions are SECURITY DEFINER and granted to
--      `authenticated`), and that queue drives the AI dispatcher.
--   3. `activate_kb_version`, `fn_publish_ai_agent_version` and
--      `retrieve_top_k_chunks` trusted the org/agent ids they were given and
--      were executable by `authenticated` (the publish one even by `anon`).
--      Every caller in the app uses the service role, so EXECUTE is revoked
--      from PUBLIC/anon/authenticated instead of rewriting their bodies.
--   4. `landing-media` and `avatars` allowed anyone to LIST the bucket. Folder
--      names are org ids / user ids, which is what made (2) and (3) cheap to
--      exploit. Public object URLs do not depend on a SELECT policy (public
--      bucket), so listing is narrowed to members of the owning org / the owner.
--   5. `api_audit_log` insert from `authenticated` no longer accepts a NULL
--      organization_id (anyone could forge "global" audit rows). The app writes
--      audit rows with the service role, which is unaffected.
--
-- Idempotent: create or replace / drop policy if exists / revoke is a no-op
-- when the privilege is absent. No BEGIN/COMMIT (the runner wraps it).

-- 1. ------------------------------------------------------------------------
create or replace function public.fn_assert_org_access(p_organization_id uuid)
returns void
language plpgsql
stable
set search_path to 'public'
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_role   text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    case when v_claims is not null then v_claims::jsonb ->> 'role' end
  );
begin
  -- No JWT at all = not a PostgREST request (psql, pg_cron, migrations,
  -- triggers fired by those). Service role = the app's trusted server side.
  if v_role is null or v_role = 'service_role' then
    return;
  end if;

  if p_organization_id is null then
    raise exception 'organization_id obrigatorio' using errcode = '42501';
  end if;

  if p_organization_id in (select public.fn_user_org_ids()) or public.fn_is_platform_admin() then
    return;
  end if;

  raise exception 'forbidden_organization' using errcode = '42501';
end $$;

comment on function public.fn_assert_org_access(uuid) is
  'Raises 42501 unless the JWT caller is a member of the org (or platform admin). No-JWT and service_role callers pass. Migration 0083.';

-- 2. ------------------------------------------------------------------------
create or replace function public.emit_event(
  p_event_type text,
  p_entity_kind text,
  p_entity_id uuid,
  p_payload jsonb default '{}'::jsonb,
  p_metadata jsonb default '{}'::jsonb,
  p_organization_id uuid default null::uuid
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_org_id uuid;
  v_event_id uuid;
begin
  v_org_id := p_organization_id;
  if v_org_id is null then
    -- Try to resolve from caller's first org (best-effort; trigger callers MUST pass it)
    select organization_id into v_org_id
      from public.user_organizations
      where user_id = auth.uid() and revoked_at is null
      limit 1;
  end if;
  if v_org_id is null then
    raise exception 'emit_event: organization_id obrigatorio';
  end if;

  -- Tenant guard (0083): SECURITY DEFINER bypasses RLS, so membership is
  -- checked explicitly before writing into another org's event queue.
  perform public.fn_assert_org_access(v_org_id);

  insert into public.event_log
    (organization_id, event_type, entity_kind, entity_id, payload, metadata)
  values
    (v_org_id, p_event_type, p_entity_kind, p_entity_id,
     coalesce(p_payload, '{}'::jsonb),
     coalesce(p_metadata, '{}'::jsonb)
       || jsonb_build_object('emitted_at', extract(epoch from now())))
  returning id into v_event_id;

  return v_event_id;
end $$;

-- 3. ------------------------------------------------------------------------
revoke execute on function public.activate_kb_version(uuid, uuid) from public, anon, authenticated;
grant  execute on function public.activate_kb_version(uuid, uuid) to service_role;

revoke execute on function public.fn_publish_ai_agent_version(uuid, uuid, uuid) from public, anon, authenticated;
grant  execute on function public.fn_publish_ai_agent_version(uuid, uuid, uuid) to service_role;

revoke execute on function public.retrieve_top_k_chunks(uuid, uuid, public.vector, integer, real) from public, anon, authenticated;
grant  execute on function public.retrieve_top_k_chunks(uuid, uuid, public.vector, integer, real) to service_role;

-- 4. ------------------------------------------------------------------------
drop policy if exists "public_read_landing_media" on storage.objects;
drop policy if exists "tenant_read_landing_media" on storage.objects;
create policy "tenant_read_landing_media" on storage.objects for select
  using (
    bucket_id = 'landing-media'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id::text = split_part(name, '/', 1)
    )
  );

drop policy if exists "public_read_avatars" on storage.objects;
drop policy if exists "own_read_avatars" on storage.objects;
create policy "own_read_avatars" on storage.objects for select
  using (bucket_id = 'avatars' and split_part(name, '/', 1) = auth.uid()::text);

-- 5. ------------------------------------------------------------------------
drop policy if exists "audit_log_insert_tenant_member" on public.api_audit_log;
create policy "audit_log_insert_tenant_member" on public.api_audit_log
  for insert to authenticated
  with check (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_platform_admin()
  );
