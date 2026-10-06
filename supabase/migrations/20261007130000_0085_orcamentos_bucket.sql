-- 0085 — private `orcamentos` bucket for the public quote page (/orcamento)
--
-- WHAT / WHY
--   The quote page uploaded the visitor's 3D model with the browser client
--   straight into a bucket called `orcamentos-public` that no migration ever
--   created: on a fresh clone the upload failed (silently, console only) and on
--   the production project it depended on a bucket configured by hand. If that
--   bucket had been made public with an anon INSERT policy, it was free file
--   hosting for anyone.
--
--   Now: private bucket, MIME and size enforced by Storage itself (not only by
--   the Zod of the route that issues the slot — that route is public, and
--   validation that lives only in the app can be bypassed). Writes happen only
--   through a signed upload URL issued server-side by
--   /api/v1/public/orcamento/upload-slot (server-generated `<uuid>/<name>` path,
--   IP rate limit). Reading: platform admin, or the 7-day signed link that the
--   server issues after the upload and the visitor sends on WhatsApp.
--
--   No policy for anon/authenticated: the visitor has no account and there is
--   no tenant to match (same design as `pro-receipts`, migration 0081).
--
--   NO `application/octet-stream`: it would accept ANY bytes, turning the
--   bucket into anonymous file hosting. The slot route maps every accepted
--   extension (.stl/.3mf/.obj/.step...) to an explicit MIME of this list. The
--   MIME is still chosen by the uploader (a Supabase signed upload URL cannot
--   bind it), so the confirm route re-checks the stored content type and the
--   file's magic bytes, deletes what does not match, and only issues links for
--   slots younger than 2 hours (issuance time is encoded in the folder name).
--
-- Idempotent: upsert of the bucket row, drop policy if exists.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('orcamentos', 'orcamentos', false, 52428800,
        array[
          'model/stl',
          'application/sla',
          'application/vnd.ms-pki.stl',
          'model/3mf',
          'application/vnd.ms-package.3dmanufacturing-3dmodel+xml',
          'model/obj',
          'application/step',
          'model/step',
          'image/png',
          'image/jpeg',
          'image/webp',
          'application/pdf'
        ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists platform_admin_read_orcamentos on storage.objects;
create policy platform_admin_read_orcamentos on storage.objects for select
  using (bucket_id = 'orcamentos' and public.fn_is_platform_admin());
