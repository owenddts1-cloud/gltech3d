-- 0045_models_3d
-- Repositório de modelos 3D (STL) saindo de client-only efêmero para o banco.
-- Antes os modelos viviam só na memória do navegador (IDs Math.random, sem
-- persistência) — sumiam ao recarregar. Agora: metadados no Postgres + arquivo
-- STL no Storage (bucket privado `models-3d`).
--
-- Idempotent — safe to re-apply.

create table if not exists public.models_3d (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  file_path text not null,                 -- <org_id>/<uuid>-<nome>.stl no bucket
  size_kb integer not null default 0,
  triangles integer not null default 0,
  volume_cm3 numeric not null default 0,
  bounding_box jsonb not null default '{}'::jsonb,  -- { min:[x,y,z], max:[x,y,z] }
  thumbnail_url text,                      -- data URL webp gerada no cliente
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists models_3d_org_idx on public.models_3d (organization_id, created_at desc);

alter table public.models_3d enable row level security;
drop policy if exists tenant_isolation_models_3d_all on public.models_3d;
create policy tenant_isolation_models_3d_all on public.models_3d
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.models_3d from anon;

drop trigger if exists trg_models_3d_audit on public.models_3d;
create trigger trg_models_3d_audit
  after insert or update or delete on public.models_3d
  for each row execute function public.fn_audit_log_row();

-- =============================================================================
-- Bucket privado `models-3d` — arquivos STL, isolados por org no prefixo do path
-- (mesmo padrão de ai-policy 0014 / landing-media 0042).
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'models-3d',
  'models-3d',
  false,                                   -- privado: geometria é dado da org
  104857600,                               -- 100 MB: STL de peça grande cabe
  null                                     -- STL não tem MIME confiável; valida-se por extensão no server
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tenant_read_models_3d" on storage.objects;
create policy "tenant_read_models_3d" on storage.objects for select
  using (
    bucket_id = 'models-3d'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );

drop policy if exists "tenant_write_models_3d" on storage.objects;
create policy "tenant_write_models_3d" on storage.objects for insert
  with check (
    bucket_id = 'models-3d'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );

drop policy if exists "tenant_delete_models_3d" on storage.objects;
create policy "tenant_delete_models_3d" on storage.objects for delete
  using (
    bucket_id = 'models-3d'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );
