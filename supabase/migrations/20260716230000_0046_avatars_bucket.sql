-- 0046_avatars_bucket
-- Bucket `avatars` para foto de perfil. Antes o avatar só aceitava uma URL
-- pública colada à mão ("upload — em breve").
--
-- Diferente dos outros buckets, o escopo aqui é POR USUÁRIO, não por org:
-- o avatar é da pessoa, não do tenant. O caminho é `<user_id>/<arquivo>` e as
-- policies conferem `auth.uid()` contra a primeira pasta.
--
-- Público na leitura: avatar aparece na UI; é foto de perfil, não dado sensível.
--
-- Idempotent — safe to re-apply.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880, -- 5 MB: foto de perfil não precisa de mais
  array['image/png', 'image/jpeg', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public_read_avatars" on storage.objects;
create policy "public_read_avatars" on storage.objects for select
  using (bucket_id = 'avatars');

-- Escrita/atualização/remoção: só na própria pasta (<user_id>/...).
drop policy if exists "own_write_avatars" on storage.objects;
create policy "own_write_avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and (split_part(name, '/', 1)) = auth.uid()::text);

drop policy if exists "own_update_avatars" on storage.objects;
create policy "own_update_avatars" on storage.objects for update
  using (bucket_id = 'avatars' and (split_part(name, '/', 1)) = auth.uid()::text);

drop policy if exists "own_delete_avatars" on storage.objects;
create policy "own_delete_avatars" on storage.objects for delete
  using (bucket_id = 'avatars' and (split_part(name, '/', 1)) = auth.uid()::text);
