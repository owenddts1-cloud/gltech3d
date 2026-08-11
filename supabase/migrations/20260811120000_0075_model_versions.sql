-- =============================================================================
-- Migration 0075 — model_versions
-- =============================================================================
-- Histórico de edições de uma peça do repositório 3D.
--
-- POR QUE VERSÃO E NÃO SOBRESCREVER. Editar a peça (girar, escalar, espelhar) é
-- destrutivo: o arquivo original é o que veio do CAD, e refazer a transformação
-- ao contrário nem sempre devolve o mesmo — escala não-uniforme seguida de
-- rotação não tem inversa exata em ponto flutuante. Guardando cada estado como
-- linha própria, voltar atrás é trocar qual arquivo o registro aponta, não
-- recalcular nada.
--
-- O ARQUIVO DE CADA VERSÃO É INDEPENDENTE. `file_path` aponta para um objeto
-- próprio no bucket `models-3d`. Não guardamos só a matriz porque um `.stl`
-- concreto é o que o fatiador, o download e outro dispositivo conseguem abrir
-- sem depender de reexecutar a transformação com a mesma versão do código.
--
-- `transform` guarda o que foi aplicado (rotação/escala/translação) apenas como
-- REGISTRO legível — a fonte da verdade é o arquivo.

create table if not exists public.model_versions (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  model_id          uuid not null references public.models_3d(id) on delete cascade,
  -- 1 é o estado original, gravado na primeira edição.
  version_number    integer not null,
  file_path         text not null,
  size_kb           integer not null default 0,
  triangles         integer not null default 0,
  volume_cm3        numeric not null default 0,
  bounding_box      jsonb not null default '{}'::jsonb,
  transform         jsonb not null default '{}'::jsonb,
  note              text not null default '',
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now()
);

-- Numeração por peça, não global: duas peças diferentes têm cada uma a sua v1.
create unique index if not exists model_versions_model_number_key
  on public.model_versions (model_id, version_number);

create index if not exists model_versions_org_model_idx
  on public.model_versions (organization_id, model_id, version_number desc);

alter table public.model_versions enable row level security;

drop policy if exists tenant_isolation_model_versions_all on public.model_versions;
create policy tenant_isolation_model_versions_all on public.model_versions
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));

revoke all on public.model_versions from anon;

drop trigger if exists trg_model_versions_audit on public.model_versions;
create trigger trg_model_versions_audit
  after insert or update or delete on public.model_versions
  for each row execute function public.fn_audit_log_row();

-- Ponteiro para a versão ativa. Nulo = o arquivo em `models_3d.file_path` nunca
-- foi editado. Sem `references` circular com cascade: apagar a versão ativa
-- deixaria a peça apontando para o vazio, então o ON DELETE é SET NULL.
alter table public.models_3d
  add column if not exists current_version_id uuid references public.model_versions(id) on delete set null;
