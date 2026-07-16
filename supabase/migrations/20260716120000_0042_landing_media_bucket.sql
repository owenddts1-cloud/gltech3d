-- Migration 0042: bucket `landing-media` da biblioteca de mídia do Landing Edit
--
-- Diferente de ai-policy (0014) e lgpd-exports (0017), este bucket é PÚBLICO na
-- leitura: são as fotos das peças na vitrine, servidas pela CDN do Storage para
-- visitante anônimo. Escrita e exclusão seguem fechadas, com o mesmo isolamento
-- por prefixo de caminho das migrations anteriores.
--
-- Convenção de caminho: <organization_id>/<uuid>-<arquivo>
--
-- Idempotent — safe to re-apply.

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
