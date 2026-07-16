-- =============================================================================
-- APLICAR PENDÊNCIA — migration 0042_landing_media_bucket
-- =============================================================================
-- Cole este arquivo INTEIRO no Supabase SQL Editor e clique em "Run".
-- Idempotente; roda numa transação (rollback automático se algo falhar).
-- Pré-requisito: 0041 já aplicada.
-- =============================================================================

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'landing-media',
  'landing-media',
  true,
  52428800, -- 50 MB: cobre vídeo curto de peça
  array[
    'image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif',
    'video/mp4', 'video/webm'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública: a landing é anônima e estas são as fotos da vitrine.
drop policy if exists "public_read_landing_media" on storage.objects;
create policy "public_read_landing_media" on storage.objects for select
  using (bucket_id = 'landing-media');

-- Escrita: só membro ativo da org dona do prefixo do caminho.
drop policy if exists "tenant_write_landing_media" on storage.objects;
create policy "tenant_write_landing_media" on storage.objects for insert
  with check (
    bucket_id = 'landing-media'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );

drop policy if exists "tenant_update_landing_media" on storage.objects;
create policy "tenant_update_landing_media" on storage.objects for update
  using (
    bucket_id = 'landing-media'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );

drop policy if exists "tenant_delete_landing_media" on storage.objects;
create policy "tenant_delete_landing_media" on storage.objects for delete
  using (
    bucket_id = 'landing-media'
    and exists (
      select 1 from public.user_organizations uo
      where uo.user_id = auth.uid()
        and uo.revoked_at is null
        and uo.organization_id = (split_part(name, '/', 1))::uuid
    )
  );

commit;

-- CONFERÊNCIA (rode após o commit):
--   select id, public, file_size_limit from storage.buckets where id = 'landing-media';
--   -- esperado: landing-media | t | 52428800
--
--   select policyname from pg_policies
--    where tablename = 'objects' and policyname like '%landing_media%';
--   -- esperado: 4 (public_read, tenant_write, tenant_update, tenant_delete)
