-- 0016_lgpd_emergency_scope
--
-- RECONSTRUÍDA. O arquivo desta migration nunca existiu no repositório: o
-- MANIFEST a lista como aplicada (versão 20260428000000) e o banco remoto a tem
-- em `supabase_migrations.schema_migrations`, mas a sequência de arquivos pulava
-- de 0015 direto para 0017. Qualquer clone que replicasse o diretório perdia
-- `lgpd_requests.emergency` e `.scope` — colunas NOT NULL usadas pelo watcher de
-- SLA da LGPD. O conteúdo abaixo foi extraído do `baseline.sql` (linhas
-- 1632-1635 e 2550), que é onde o schema real vive.
--
-- Idempotente e re-aplicável. O guard de existência da tabela é necessário
-- porque as migrations 0001-0009 são stubs (`SELECT 1;`) — num banco novo o
-- schema base vem de `supabase/baseline.sql`, não daqui. Ver MANIFEST.md.

do $$
begin
  if to_regclass('public.lgpd_requests') is null then
    raise notice '0016: lgpd_requests ainda não existe — pulando. Banco novo deve aplicar supabase/baseline.sql.';
    return;
  end if;

  -- EPIC-08 wave 3: pedido emergencial (SLA encurtado) e alcance do pedido.
  alter table public.lgpd_requests
    add column if not exists emergency boolean not null default false;

  alter table public.lgpd_requests
    add column if not exists scope text not null default 'contact';

  if not exists (select 1 from pg_constraint where conname = 'lgpd_requests_scope_check') then
    alter table public.lgpd_requests
      add constraint lgpd_requests_scope_check
      check (scope = any (array['contact'::text, 'tenant'::text]));
  end if;

  -- Índice parcial: o watcher só varre os emergenciais em aberto, então indexar
  -- a tabela inteira seria desperdício.
  create index if not exists lgpd_requests_emergency_idx
    on public.lgpd_requests using btree (organization_id, emergency, due_at)
    where emergency = true;
end $$;

comment on column public.lgpd_requests.emergency is
  'Pedido emergencial: encurta o SLA calculado por fn/computeDueAt.';
comment on column public.lgpd_requests.scope is
  'Alcance do pedido: contact (um titular) ou tenant (a organização inteira).';
