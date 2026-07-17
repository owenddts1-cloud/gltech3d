-- 0049_model_folders
-- Explorador de arquivos por cliente na Modelagem 3D. Cria a árvore livre de
-- pastas/subpastas (`model_folders`) e generaliza `models_3d` (que era só STL)
-- para guardar qualquer arquivo do cliente (STL/3MF/PNG) dentro de uma pasta.
--
-- Pastas são livres (o usuário cria e nomeia), com vínculo OPCIONAL a um contato
-- do CRM. Arquivo sem pasta = raiz. Ao apagar uma pasta, a aplicação re-parenta
-- os filhos para o pai (nada se perde) — o cascade abaixo é só backstop.
--
-- Idempotent — safe to re-apply.

create table if not exists public.model_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid references public.model_folders(id) on delete cascade,  -- null = raiz
  name text not null,
  icon text not null default 'Folder',          -- nome do allowlist (lib/models/folder-icons.ts)
  color text,                                    -- cor opcional do ícone
  contact_id uuid references public.contacts(id) on delete set null,     -- vínculo opcional ao CRM
  sort_order numeric,                            -- ordenação manual (fractional indexing)
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists model_folders_org_parent_idx
  on public.model_folders (organization_id, parent_id);

alter table public.model_folders enable row level security;
drop policy if exists tenant_isolation_model_folders_all on public.model_folders;
create policy tenant_isolation_model_folders_all on public.model_folders
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.model_folders from anon;

drop trigger if exists trg_model_folders_audit on public.model_folders;
create trigger trg_model_folders_audit
  after insert or update or delete on public.model_folders
  for each row execute function public.fn_audit_log_row();

-- =============================================================================
-- Generalizar models_3d: passa a ser a tabela de ARQUIVOS do cliente (não só
-- STL). Nome mantido (forward-only). Colunas STL (triangles/volume/bounding_box)
-- ficam nulas/zeradas para 3MF/PNG.
-- =============================================================================
alter table public.models_3d
  add column if not exists folder_id uuid references public.model_folders(id) on delete set null,
  add column if not exists mime_type text,
  add column if not exists kind text not null default 'stl',
  add column if not exists sort_order numeric;

-- kind conhecido: stl (inspetor 3D), model3mf (inspetor 3D), image (preview), other.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'models_3d_kind_known') then
    alter table public.models_3d
      add constraint models_3d_kind_known
      check (kind in ('stl', 'model3mf', 'image', 'other'));
  end if;
end $$;

create index if not exists models_3d_org_folder_idx
  on public.models_3d (organization_id, folder_id);
