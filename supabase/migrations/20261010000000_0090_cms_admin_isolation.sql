-- =============================================================================
-- Migration 0090: CMS Admin Isolation, RBAC Hardening & Anti-Lockout
-- =============================================================================
-- Prerrogativa:
-- 1. A vitrine oficial e configurações de landing page pertencem exclusivamente
--    à Diretoria da GLTech3D e Super-Admins de Plataforma.
-- 2. Garantia estrita de anti-lockout para 'diretoria.gltech@gmail.com' e
--    'diretoria@gltech3d.com.br'.
-- 3. Clientes assinantes de outros tenants (ex: Calc3D PRO) possuem isolamento
--    completo e não podem alterar parâmetros da GLTech3D.
-- =============================================================================

-- 1. Helper definer para identificação segura da Diretoria e Super-Admins
create or replace function public.fn_is_directorate_or_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'is_platform_admin')::boolean = true
    or lower(coalesce(auth.jwt() ->> 'email', '')) in ('diretoria@gltech3d.com.br', 'diretoria.gltech@gmail.com')
    or exists (
      select 1 from public.user_organizations uo
      join public.organizations o on o.id = uo.organization_id
      where uo.user_id = auth.uid()
        and o.slug = 'gltech3d'
        and uo.role in ('admin', 'owner')
    ),
    false
  );
$$;

comment on function public.fn_is_directorate_or_platform_admin() is
  'Retorna true se o usuário autenticado for da diretoria GLTech3D ou super-admin da plataforma (anti-lockout garantido).';

-- 2. Isolamento de RLS em landing_settings
alter table public.landing_settings enable row level security;

drop policy if exists tenant_isolation_landing_settings_all on public.landing_settings;
drop policy if exists landing_settings_select on public.landing_settings;
drop policy if exists landing_settings_insert on public.landing_settings;
drop policy if exists landing_settings_update on public.landing_settings;
drop policy if exists landing_settings_delete on public.landing_settings;

-- Leitura: membros do tenant OU leitura pública da landing GLTech3D para storefront
create policy landing_settings_select on public.landing_settings
  for select to authenticated, anon
  using (
    organization_id in (select public.fn_user_org_ids())
    or organization_id = coalesce((select id from public.organizations where slug = 'gltech3d' limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
    or public.fn_is_directorate_or_platform_admin()
  );

-- Inserção: apenas diretoria para a vitrine gltech3d; admins de tenant para seus próprios tenants
create policy landing_settings_insert on public.landing_settings
  for insert to authenticated
  with check (
    public.fn_is_directorate_or_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and organization_id <> coalesce((select id from public.organizations where slug = 'gltech3d' limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
      and public.fn_user_role_in_org(organization_id) in ('admin', 'owner')
    )
  );

-- Atualização: apenas diretoria para gltech3d; admins de tenant para seus próprios tenants
create policy landing_settings_update on public.landing_settings
  for update to authenticated
  using (
    public.fn_is_directorate_or_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and organization_id <> coalesce((select id from public.organizations where slug = 'gltech3d' limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
      and public.fn_user_role_in_org(organization_id) in ('admin', 'owner')
    )
  )
  with check (
    public.fn_is_directorate_or_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and organization_id <> coalesce((select id from public.organizations where slug = 'gltech3d' limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
      and public.fn_user_role_in_org(organization_id) in ('admin', 'owner')
    )
  );

-- Exclusão: apenas diretoria para gltech3d; admins de tenant para seus próprios tenants
create policy landing_settings_delete on public.landing_settings
  for delete to authenticated
  using (
    public.fn_is_directorate_or_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and organization_id <> coalesce((select id from public.organizations where slug = 'gltech3d' limit 1), '00000000-0000-0000-0000-000000000000'::uuid)
      and public.fn_user_role_in_org(organization_id) in ('admin', 'owner')
    )
  );

-- 3. Isolamento de RLS em platform_commissions
alter table public.platform_commissions enable row level security;

drop policy if exists tenant_isolation_platform_commissions_all on public.platform_commissions;
drop policy if exists platform_commissions_select on public.platform_commissions;
drop policy if exists platform_commissions_write on public.platform_commissions;

create policy platform_commissions_select on public.platform_commissions
  for select to authenticated
  using (
    organization_id in (select public.fn_user_org_ids())
    or public.fn_is_directorate_or_platform_admin()
  );

create policy platform_commissions_write on public.platform_commissions
  for all to authenticated
  using (
    public.fn_is_directorate_or_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_user_role_in_org(organization_id) in ('admin', 'owner')
    )
  )
  with check (
    public.fn_is_directorate_or_platform_admin()
    or (
      organization_id in (select public.fn_user_org_ids())
      and public.fn_user_role_in_org(organization_id) in ('admin', 'owner')
    )
  );
