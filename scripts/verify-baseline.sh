#!/usr/bin/env bash
# Valida `supabase/baseline.sql` num Postgres descartável.
#
# POR QUE ISTO EXISTE. O kit self-host (`hostgator-setup-kit/`) aplica SÓ o
# baseline — nunca as migrations. Então uma mudança de schema que não chegue ao
# apêndice do baseline simplesmente não existe para quem clonou o projeto. Pior:
# um apêndice que não seja idempotente derruba o `update.sh` de quem já tinha o
# banco. Os dois defeitos são invisíveis no desenvolvimento e só aparecem na
# máquina de terceiro.
#
# Reproduz exatamente os dois caminhos do kit:
#   install.sh  psql -v ON_ERROR_STOP=1 -f baseline.sql   (banco novo, tem de passar limpo)
#   update.sh   psql -f baseline.sql                      (re-aplicado, erro benigno é ok)
#
# STUB DO SUPABASE. O baseline usa `auth.uid()`, `auth.users`, `auth.sessions`,
# `storage.objects` e `storage.buckets`, que o Supabase provê e um Postgres puro
# não tem. Criamos versões mínimas — é o que torna o teste possível fora do
# Supabase, e está declarado aqui para ninguém confundir com validação do
# ambiente real.
#
# Uso:  bash scripts/verify-baseline.sh

set -uo pipefail

IMAGE="pgvector/pgvector:pg17"
NAME="gl-baseline-check"
PASS="baseline"
DB="postgres"

cleanup() { docker rm -f "$NAME" >/dev/null 2>&1 || true; }
trap cleanup EXIT
cleanup

echo "== subindo $IMAGE =="
docker run -d --name "$NAME" -e POSTGRES_PASSWORD="$PASS" "$IMAGE" >/dev/null || exit 1

echo "== esperando o Postgres aceitar conexão =="
for _ in $(seq 1 60); do
  if docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  docker exec "$NAME" sleep 1 >/dev/null 2>&1 || true
done
docker exec "$NAME" pg_isready -U postgres || { echo "Postgres não subiu"; exit 1; }

psql_run() { docker exec -i -e PGPASSWORD="$PASS" "$NAME" psql -U postgres -d "$DB" "$@"; }

echo "== extensões (iguais às do install.sh) =="
# `uuid-ossp` e `pgcrypto` vão para o schema `extensions`, NÃO para o public: o
# baseline chama `extensions.uuid_generate_v4()` e `extensions.gen_random_bytes()`,
# que é onde o Supabase as instala. Instalar no public faz o install falhar na
# primeira tabela com default de uuid.
psql_run -v ON_ERROR_STOP=1 -q -c "
  create schema if not exists extensions;
  create extension if not exists vector  with schema public;
  create extension if not exists citext  with schema public;
  create extension if not exists pg_trgm with schema public;
  create extension if not exists \"uuid-ossp\" with schema extensions;
  create extension if not exists pgcrypto  with schema extensions;
" || exit 1

echo "== papéis do Supabase =="
# `anon`, `authenticated` e `service_role` são criados pelo Supabase, não pelo
# baseline — e o dump tem 187 GRANTs para eles. Sem os papéis, o install para no
# primeiro GRANT.
psql_run -v ON_ERROR_STOP=1 -q -c "
  do \$\$
  begin
    if not exists (select 1 from pg_roles where rolname='anon')          then create role anon nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin noinherit; end if;
    if not exists (select 1 from pg_roles where rolname='service_role')  then create role service_role nologin noinherit bypassrls; end if;
  end \$\$;
" || exit 1

echo "== stub do Supabase (auth/storage) =="
psql_run -v ON_ERROR_STOP=1 -q -c "
  create schema if not exists auth;
  create schema if not exists storage;
  create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
  );
  create table if not exists auth.sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    created_at timestamptz default now()
  );
  create table if not exists storage.buckets (
    id text primary key,
    name text not null,
    owner uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    public boolean default false,
    avif_autodetection boolean default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id),
    name text,
    owner uuid,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_accessed_at timestamptz default now(),
    metadata jsonb,
    path_tokens text[]
  );
  create or replace function auth.uid() returns uuid
    language sql stable as \$\$ select null::uuid \$\$;
" || exit 1

echo
echo "== 1/2 INSTALL: banco novo, ON_ERROR_STOP=1 =="
if psql_run -v ON_ERROR_STOP=1 -q -f - < supabase/baseline.sql; then
  echo "OK — baseline aplica limpo num banco novo"
else
  echo "FALHOU — install.sh quebraria num clone novo"
  exit 1
fi

echo
echo "== 2/2 UPDATE: re-aplicando sobre o banco existente, sem ON_ERROR_STOP =="
raw="$(psql_run -f - < supabase/baseline.sql 2>&1)"

# Mesma lista de erros benignos do update.sh — re-aplicar sobre base existente
# gera "já existe", e isso é esperado.
benign='already exists|multiple primary keys|multiple default values|is already a member|already a partition'
unexpected="$(printf '%s\n' "$raw" | grep -iE 'ERROR|FATAL' | grep -viE "$benign" || true)"

if [ -n "$unexpected" ]; then
  echo "FALHOU — erros que o update.sh NÃO trata como benignos:"
  printf '%s\n' "$unexpected" | head -40
  exit 1
fi
echo "OK — re-aplicação só gerou erro benigno"

echo
echo "== invariantes da 0075 (model_versions) =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'tabela: '        || count(*) from pg_tables   where schemaname='public' and tablename='model_versions';
  select 'rls: '           || relrowsecurity from pg_class where relname='model_versions';
  select 'policies: '      || count(*) from pg_policies where tablename='model_versions';
  select 'unique por peca: '|| count(*) from pg_indexes where indexname='model_versions_model_number_key';
  select 'ponteiro ativo: '|| count(*) from information_schema.columns
    where table_name='models_3d' and column_name='current_version_id';
" || exit 1

echo
echo "== invariantes da 0080 (identidade do Instagram no contato) =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'colunas: ' || count(*) from information_schema.columns
    where table_name='contacts' and column_name in ('instagram_user_id','instagram_username');
  select 'indice unico parcial: ' ||
    case when indexdef ilike '%UNIQUE%' and indexdef ilike '%WHERE%' then 'ok' else 'FALHOU' end
    from pg_indexes where indexname='contacts_instagram_user_key';
" || exit 1

echo
echo "== invariantes da 0079 (Instagram como canal) =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'tabelas novas: ' || count(*) from pg_tables where schemaname='public'
    and tablename in ('instagram_accounts','automation_rules','scheduled_posts');
  select 'RLS nas tres: ' || count(*) from pg_class
    where relname in ('instagram_accounts','automation_rules','scheduled_posts') and relrowsecurity;
  select 'conversations aceita instagram: ' ||
    case when pg_get_constraintdef(oid) ilike '%instagram%' then 'sim' else 'NAO' end
    from pg_constraint where conname='conversations_channel_check';
  select 'check de canal unico: ' || count(*) from pg_constraint
    where conname in ('conversations_exactly_one_channel','ai_agent_versions_exactly_one_channel');
  select 'indice do cron: ' || count(*) from pg_indexes where indexname='scheduled_posts_due_idx';
" || exit 1

echo
echo "== invariantes da 0078 (peca avulsa) =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'coluna: ' || count(*) from information_schema.columns
    where table_name='marketplace_orders' and column_name='is_custom_item';
  select 'check xor: ' || count(*) from pg_constraint
    where conname='marketplace_orders_custom_xor_product';
  select 'indice de cobertura: ' || count(*) from pg_indexes
    where indexname='marketplace_orders_unclassified_idx';
" || exit 1

echo "== a CHECK impede afirmar as duas coisas? =="
psql_run -q -t -c "
  select case when count(*) = 1 then 'OK: check com a condicao certa' else 'FALHOU' end
  from pg_constraint
  where conname='marketplace_orders_custom_xor_product'
    and pg_get_constraintdef(oid) ilike '%is_custom_item%product_id%';
" | sed 's/^/      /'

echo
echo "== invariantes da 0077 (produto <-> modelo) =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'colunas novas: ' || count(*) from information_schema.columns
    where table_name='products'
      and column_name in ('model_id','cost_estimated_at','cost_estimate_source');
  select 'FK set null: ' || count(*) from information_schema.referential_constraints rc
    join information_schema.key_column_usage k on k.constraint_name = rc.constraint_name
   where k.table_name='products' and k.column_name='model_id' and rc.delete_rule='SET NULL';
" || exit 1

echo
echo "== invariantes da 0076 (um default por org) =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'indice parcial: ' || count(*) from pg_indexes
    where indexname='crm_pipelines_one_default_per_org';
" || exit 1

echo
echo "== a 0076 e mesmo UNIQUE e PARCIAL? =="
# Prova pela definicao, nao por insercao: `crm_pipelines` tem colunas
# obrigatorias que mudam com o tempo, e um teste que insere linha quebraria a
# cada coluna nova sem que a invariante tivesse mudado.
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select case
    when indexdef ilike '%UNIQUE%' and indexdef ilike '%WHERE is_default%'
      then 'OK: unique + parcial'
    else 'FALHOU: ' || indexdef
  end
  from pg_indexes where indexname='crm_pipelines_one_default_per_org';
" | sed 's/^/      /'

echo
echo "== invariantes da 0074 =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select 'tabela: '   || count(*) from pg_tables  where schemaname='public' and tablename='user_trusted_devices';
  select 'rls: '      || relrowsecurity from pg_class where relname='user_trusted_devices';
  select 'policies: ' || count(*) from pg_policies where tablename='user_trusted_devices';
  select 'check: '    || count(*) from pg_constraint where conname='user_trusted_devices_status_check';
  select 'indices: '  || count(*) from pg_indexes where tablename='user_trusted_devices';
" || exit 1

echo
echo "== 0083: guarda de tenant nas RPCs (comportamento, nao so existencia) =="
# Tudo dentro de uma transacao desfeita no fim: o stub de auth.uid() e trocado
# por um que le o `sub` do JWT simulado, e os dados de teste somem no rollback.
psql_run -v ON_ERROR_STOP=1 -q -f - <<'SQL' || exit 1
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@teste'),
  ('00000000-0000-0000-0000-0000000000b1', 'b@teste');
insert into public.organizations (id, slug, legal_name, display_name) values
  ('00000000-0000-0000-0000-00000000000a', 'org-a-0083', 'A', 'A'),
  ('00000000-0000-0000-0000-00000000000b', 'org-b-0083', 'B', 'B');
insert into public.user_organizations (user_id, organization_id, role) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'admin');

-- membro de A grava na propria org
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000000a1"}';
select public.emit_event('t.ok', 'x', null, '{}'::jsonb, '{}'::jsonb, '00000000-0000-0000-0000-00000000000a') is not null as propria_org_ok;

-- membro de A NAO grava na fila de B
do $$
begin
  perform public.emit_event('t.cross', 'x', null, '{}'::jsonb, '{}'::jsonb, '00000000-0000-0000-0000-00000000000b');
  raise exception 'FALHOU: emit_event aceitou org alheia';
exception when sqlstate '42501' then
  raise notice 'OK: emit_event recusou org alheia';
end $$;

-- fn_log_event delega ao emit_event: tambem recusa
do $$
begin
  perform public.fn_log_event('00000000-0000-0000-0000-00000000000b', 'lead.created', '{}'::jsonb);
  raise exception 'FALHOU: fn_log_event aceitou org alheia';
exception when sqlstate '42501' then
  raise notice 'OK: fn_log_event recusou org alheia';
end $$;

-- service role e conexao sem JWT continuam passando (webhooks, cron, triggers)
set local request.jwt.claims = '{"role":"service_role"}';
select public.emit_event('t.sr', 'x', null, '{}'::jsonb, '{}'::jsonb, '00000000-0000-0000-0000-00000000000b') is not null as service_role_ok;
set local request.jwt.claims = '';
select public.emit_event('t.nojwt', 'x', null, '{}'::jsonb, '{}'::jsonb, '00000000-0000-0000-0000-00000000000b') is not null as sem_jwt_ok;

-- grants revogados
do $$
begin
  if has_function_privilege('anon', 'public.fn_publish_ai_agent_version(uuid,uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.fn_publish_ai_agent_version(uuid,uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.activate_kb_version(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.retrieve_top_k_chunks(uuid,uuid,public.vector,integer,real)', 'execute') then
    raise exception 'FALHOU: RPC sensivel ainda executavel por anon/authenticated';
  end if;
  raise notice 'OK: RPCs sensiveis so para service_role';
end $$;
rollback;
SQL

echo
echo "== 0084: DELETE por papel e org suspensa (comportamento, sob RLS de verdade) =="
# RLS so vale para quem nao e dono nem superusuario: os dados entram como
# postgres e as checagens rodam com `set local role authenticated`. DELETE sem
# policy que case NAO da erro — apaga 0 linhas em silencio —, por isso cada
# checagem conta as linhas apagadas em vez de esperar excecao.
psql_run -v ON_ERROR_STOP=1 -q -f - <<'SQL' || exit 1
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema public, auth to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000084a2', 'agent@teste'),
  ('00000000-0000-0000-0000-0000000084a3', 'manager@teste'),
  ('00000000-0000-0000-0000-0000000084a4', 'admin@teste');
insert into public.organizations (id, slug, legal_name, display_name, status) values
  ('00000000-0000-0000-0000-00000000084a', 'org-a-0084', 'A', 'A', 'active'),
  ('00000000-0000-0000-0000-00000000084c', 'org-s-0084', 'S', 'S', 'suspended');
insert into public.user_organizations (user_id, organization_id, role) values
  ('00000000-0000-0000-0000-0000000084a2', '00000000-0000-0000-0000-00000000084a', 'agent'),
  ('00000000-0000-0000-0000-0000000084a3', '00000000-0000-0000-0000-00000000084a', 'manager'),
  ('00000000-0000-0000-0000-0000000084a4', '00000000-0000-0000-0000-00000000084a', 'admin'),
  ('00000000-0000-0000-0000-0000000084a4', '00000000-0000-0000-0000-00000000084c', 'admin');
insert into public.contacts (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000084c01', '00000000-0000-0000-0000-00000000084a', 'Contato A');
insert into public.products (id, organization_id, name) values
  ('00000000-0000-0000-0000-000000084d01', '00000000-0000-0000-0000-00000000084a', 'Peca A');
insert into public.financial_records (id, organization_id, month, description, type, category) values
  ('00000000-0000-0000-0000-000000084f01', '00000000-0000-0000-0000-00000000084a', 'JAN.', 'x', 'Despesa', 'Outros');

-- nenhuma tabela da lista ficou com a policy FOR ALL, e todas tem DELETE proprio
do $$
declare v_missing text;
begin
  select string_agg(t, ', ') into v_missing
    from unnest(array['contacts','financial_records','crm_leads','conversations','messages','print_jobs',
                      'service_orders','products','inventory_assets','projects','suppliers',
                      'supplier_purchases','calendar_events','marketplace_orders',
                      'service_order_documents','filaments','printers','service_order_items']) t
   where exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='ALL')
      or not exists (select 1 from pg_policies p where p.schemaname='public' and p.tablename=t and p.cmd='DELETE');
  if v_missing is not null then
    raise exception 'FALHOU: policy FOR ALL remanescente ou DELETE ausente em: %', v_missing;
  end if;
  raise notice 'OK: 18 tabelas com SELECT/INSERT/UPDATE + DELETE separados';
end $$;

set local role authenticated;

-- agent ve o contato, mas NAO apaga
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000084a2"}';
do $$
declare v_seen int; v_deleted int;
begin
  select count(*) into v_seen from public.contacts where id = '00000000-0000-0000-0000-000000084c01';
  with d as (delete from public.contacts where id = '00000000-0000-0000-0000-000000084c01' returning 1)
  select count(*) into v_deleted from d;
  if v_seen <> 1 then raise exception 'FALHOU: agent deveria VER o contato (viu %)', v_seen; end if;
  if v_deleted <> 0 then raise exception 'FALHOU: agent apagou contato'; end if;
  raise notice 'OK: agent nao apaga contato (0 linhas)';
end $$;

-- manager apaga produto
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000084a3"}';
do $$
declare v_deleted int;
begin
  with d as (delete from public.products where id = '00000000-0000-0000-0000-000000084d01' returning 1)
  select count(*) into v_deleted from d;
  if v_deleted <> 1 then raise exception 'FALHOU: manager nao apagou produto (% linhas)', v_deleted; end if;
  raise notice 'OK: manager apaga produto';
end $$;

-- manager NAO apaga lancamento financeiro
do $$
declare v_deleted int;
begin
  with d as (delete from public.financial_records where id = '00000000-0000-0000-0000-000000084f01' returning 1)
  select count(*) into v_deleted from d;
  if v_deleted <> 0 then raise exception 'FALHOU: manager apagou lancamento financeiro'; end if;
  raise notice 'OK: manager nao apaga financial_records (0 linhas)';
end $$;

-- admin apaga lancamento financeiro
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000084a4"}';
do $$
declare v_deleted int;
begin
  with d as (delete from public.financial_records where id = '00000000-0000-0000-0000-000000084f01' returning 1)
  select count(*) into v_deleted from d;
  if v_deleted <> 1 then raise exception 'FALHOU: admin nao apagou lancamento (% linhas)', v_deleted; end if;
  raise notice 'OK: admin apaga financial_records';
end $$;

-- org suspensa some de fn_user_org_ids() e de fn_role_at_least(); a ativa continua
do $$
begin
  if exists (select 1 from public.fn_user_org_ids() o where o = '00000000-0000-0000-0000-00000000084c') then
    raise exception 'FALHOU: org suspensa ainda aparece em fn_user_org_ids()';
  end if;
  if not exists (select 1 from public.fn_user_org_ids() o where o = '00000000-0000-0000-0000-00000000084a') then
    raise exception 'FALHOU: org ativa sumiu de fn_user_org_ids()';
  end if;
  if public.fn_role_at_least('00000000-0000-0000-0000-00000000084c', 'viewer') then
    raise exception 'FALHOU: fn_role_at_least ainda reconhece papel em org suspensa';
  end if;
  raise notice 'OK: org suspensa fora de fn_user_org_ids() e fn_role_at_least()';
end $$;
rollback;
SQL

echo
echo "== 0085: bucket privado orcamentos =="
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  select case when count(*) = 1 then 'OK: bucket orcamentos existe e e privado' else 'FALHOU: bucket ausente ou publico' end
    from storage.buckets where id = 'orcamentos' and public = false and file_size_limit = 52428800;
  select 'policies do bucket: ' || count(*) from pg_policies
    where schemaname = 'storage' and policyname = 'platform_admin_read_orcamentos';
" | sed 's/^/      /'
psql_run -v ON_ERROR_STOP=1 -q -t -c "
  do \$\$ begin
    if not exists (select 1 from storage.buckets where id = 'orcamentos' and public = false) then
      raise exception 'FALHOU: bucket orcamentos ausente ou publico';
    end if;
    if exists (select 1 from storage.buckets
                where id = 'orcamentos' and 'application/octet-stream' = any(allowed_mime_types)) then
      raise exception 'FALHOU: bucket orcamentos aceita application/octet-stream (qualquer arquivo)';
    end if;
    raise notice 'OK: orcamentos so aceita MIME explicito (sem octet-stream)';
  end \$\$;
" || exit 1

echo
echo "== 0086: control_sheets (RLS e isolamento entre tenants) =="
psql_run -v ON_ERROR_STOP=1 -q -f - <<'SQL' || exit 1
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema public, auth to authenticated;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.control_sheets'::regclass) then
    raise exception 'FALHOU: RLS desligado em control_sheets';
  end if;
  raise notice 'OK: RLS ligado em control_sheets';
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000086a1', 'a@teste'),
  ('00000000-0000-0000-0000-0000000086b1', 'b@teste');
insert into public.organizations (id, slug, legal_name, display_name) values
  ('00000000-0000-0000-0000-00000000086a', 'org-a-0086', 'A', 'A'),
  ('00000000-0000-0000-0000-00000000086b', 'org-b-0086', 'B', 'B');
insert into public.user_organizations (user_id, organization_id, role) values
  ('00000000-0000-0000-0000-0000000086a1', '00000000-0000-0000-0000-00000000086a', 'agent'),
  ('00000000-0000-0000-0000-0000000086b1', '00000000-0000-0000-0000-00000000086b', 'agent');
insert into public.control_sheets (id, organization_id, name, cells) values
  ('00000000-0000-0000-0000-000000086501', '00000000-0000-0000-0000-00000000086b', 'Planilha B', '[["x"]]');

do $$
begin
  insert into public.control_sheets (organization_id, name, cells)
  values ('00000000-0000-0000-0000-00000000086a', 'Grande', jsonb_build_array(repeat('x', 1000001)));
  raise exception 'FALHOU: CHECK de tamanho aceitou cells > 1 MB';
exception when check_violation then
  raise notice 'OK: CHECK recusa cells acima de 1 MB';
end $$;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000086a1"}';

do $$
declare v_seen int; v_changed int;
begin
  select count(*) into v_seen from public.control_sheets where id = '00000000-0000-0000-0000-000000086501';
  if v_seen <> 0 then raise exception 'FALHOU: membro de A le planilha de B'; end if;
  with u as (update public.control_sheets set name = 'hack' where id = '00000000-0000-0000-0000-000000086501' returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 0 then raise exception 'FALHOU: membro de A alterou planilha de B'; end if;
  raise notice 'OK: membro de A nao le nem altera planilha de B';
end $$;

do $$
begin
  insert into public.control_sheets (organization_id, name) values ('00000000-0000-0000-0000-00000000086b', 'intrusa');
  raise exception 'FALHOU: membro de A criou planilha na org B';
exception when insufficient_privilege then
  raise notice 'OK: membro de A nao cria planilha na org B';
end $$;

do $$
declare v_id uuid; v_deleted int;
begin
  insert into public.control_sheets (organization_id, name) values ('00000000-0000-0000-0000-00000000086a', 'Minha')
  returning id into v_id;
  with d as (delete from public.control_sheets where id = v_id returning 1)
  select count(*) into v_deleted from d;
  if v_deleted <> 1 then raise exception 'FALHOU: membro nao apagou a propria planilha'; end if;
  raise notice 'OK: membro cria e apaga planilha da propria org';
end $$;

-- created_by: default = quem chamou; id de outro usuario e recusado
do $$
declare v_by uuid;
begin
  insert into public.control_sheets (organization_id, name) values ('00000000-0000-0000-0000-00000000086a', 'Autoria')
  returning created_by into v_by;
  if v_by is distinct from '00000000-0000-0000-0000-0000000086a1'::uuid then
    raise exception 'FALHOU: created_by nao assumiu o usuario da sessao (%)', v_by;
  end if;
  raise notice 'OK: created_by assume o usuario da sessao';
end $$;

do $$
begin
  insert into public.control_sheets (organization_id, name, created_by)
  values ('00000000-0000-0000-0000-00000000086a', 'Forjada', '00000000-0000-0000-0000-0000000086b1');
  raise exception 'FALHOU: aceitou created_by de outro usuario';
exception when insufficient_privilege then
  raise notice 'OK: created_by forjado recusado';
end $$;

-- update de outro agent mantem o autor original, mesmo tentando trocar
reset role;
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000086a2', 'a2@teste'),
  ('00000000-0000-0000-0000-0000000086a9', 'viewer@teste');
insert into public.user_organizations (user_id, organization_id, role) values
  ('00000000-0000-0000-0000-0000000086a2', '00000000-0000-0000-0000-00000000086a', 'agent'),
  ('00000000-0000-0000-0000-0000000086a9', '00000000-0000-0000-0000-00000000086a', 'viewer');
insert into public.control_sheets (id, organization_id, name, created_by) values
  ('00000000-0000-0000-0000-000000086502', '00000000-0000-0000-0000-00000000086a', 'Planilha A', '00000000-0000-0000-0000-0000000086a1');
set local role authenticated;

set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000086a2"}';
do $$
declare v_by uuid;
begin
  update public.control_sheets
     set cells = '[["editado"]]', created_by = '00000000-0000-0000-0000-0000000086a2'
   where id = '00000000-0000-0000-0000-000000086502'
  returning created_by into v_by;
  if v_by is distinct from '00000000-0000-0000-0000-0000000086a1'::uuid then
    raise exception 'FALHOU: update trocou o autor da planilha (%)', v_by;
  end if;
  raise notice 'OK: outro agent edita, mas created_by fica com o autor original';
end $$;

-- viewer: le, mas nao cria, nao altera, nao apaga
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000086a9"}';
do $$
declare v_seen int; v_changed int; v_deleted int; v_insert_refused boolean := false;
begin
  select count(*) into v_seen from public.control_sheets where id = '00000000-0000-0000-0000-000000086502';
  if v_seen <> 1 then raise exception 'FALHOU: viewer deveria ler a planilha da org'; end if;

  with u as (update public.control_sheets set name = 'viewer' where id = '00000000-0000-0000-0000-000000086502' returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 0 then raise exception 'FALHOU: viewer alterou planilha'; end if;

  with d as (delete from public.control_sheets where id = '00000000-0000-0000-0000-000000086502' returning 1)
  select count(*) into v_deleted from d;
  if v_deleted <> 0 then raise exception 'FALHOU: viewer apagou planilha'; end if;

  begin
    insert into public.control_sheets (organization_id, name) values ('00000000-0000-0000-0000-00000000086a', 'viewer');
  exception when insufficient_privilege then
    v_insert_refused := true;
  end;
  if not v_insert_refused then raise exception 'FALHOU: viewer criou planilha'; end if;
  raise notice 'OK: viewer le, mas nao cria, altera nem apaga planilha';
end $$;
rollback;
SQL

echo
echo "== 0087: catalogo de filamentos, pedidos do site e platform_settings (RLS e integridade) =="
# Mesma tecnica da 0084/0086: dados entram como postgres, checagens sob
# `set local role authenticated|anon|service_role` com JWT simulado, tudo
# desfeito no rollback. UPDATE/DELETE barrado por RLS apaga 0 linhas em
# silencio (conta-se); INSERT sem GRANT/policy da 42501.
psql_run -v ON_ERROR_STOP=1 -q -f - <<'SQL' || exit 1
begin;
create or replace function auth.uid() returns uuid language sql stable as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
grant usage on schema public, auth to authenticated, anon, service_role;

do $$
declare v_missing text;
begin
  select string_agg(t, ', ') into v_missing
    from unnest(array['product_filament_specs','site_orders','site_order_items','platform_settings']) t
   where not coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.' || t)), false);
  if v_missing is not null then raise exception 'FALHOU: RLS desligado/ausente em: %', v_missing; end if;
  if (select count(*) from public.platform_settings) <> 1 then
    raise exception 'FALHOU: platform_settings deveria ter exatamente 1 linha (seed)';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public'
              and tablename in ('site_orders','site_order_items') and cmd in ('INSERT','ALL')) then
    raise exception 'FALHOU: site_orders/site_order_items tem policy de INSERT';
  end if;
  raise notice 'OK: RLS ligado nas 4 tabelas, seed unico, sem policy de INSERT nos pedidos do site';
end $$;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000087a1', 'a@teste'),
  ('00000000-0000-0000-0000-0000000087b1', 'b@teste'),
  ('00000000-0000-0000-0000-0000000087f1', 'pa@teste');
insert into public.organizations (id, slug, legal_name, display_name) values
  ('00000000-0000-0000-0000-00000000087a', 'org-a-0087', 'A', 'A'),
  ('00000000-0000-0000-0000-00000000087b', 'org-b-0087', 'B', 'B');
insert into public.user_organizations (user_id, organization_id, role) values
  ('00000000-0000-0000-0000-0000000087a1', '00000000-0000-0000-0000-00000000087a', 'agent'),
  ('00000000-0000-0000-0000-0000000087b1', '00000000-0000-0000-0000-00000000087b', 'agent');
insert into public.platform_admins (user_id, granted_by, reason) values
  ('00000000-0000-0000-0000-0000000087f1', '00000000-0000-0000-0000-0000000087f1', 'teste 0087');
insert into public.products (id, organization_id, name, kind) values
  ('00000000-0000-0000-0000-000000087d01', '00000000-0000-0000-0000-00000000087a', 'PLA A',  'filamento'),
  ('00000000-0000-0000-0000-000000087d02', '00000000-0000-0000-0000-00000000087a', 'Peca A', 'peca'),
  ('00000000-0000-0000-0000-000000087d03', '00000000-0000-0000-0000-00000000087b', 'PLA B',  'filamento');
insert into public.materials (id, organization_id, name, slug) values
  ('00000000-0000-0000-0000-000000087e01', '00000000-0000-0000-0000-00000000087b', 'PLA', 'pla');
insert into public.product_filament_specs (product_id, organization_id, color_hex, availability) values
  ('00000000-0000-0000-0000-000000087d03', '00000000-0000-0000-0000-00000000087b', '#FF00aa', 'esgotado');
insert into public.site_orders (id, organization_id, customer_name, customer_whatsapp, total_cents) values
  ('00000000-0000-0000-0000-000000087501', '00000000-0000-0000-0000-00000000087b', 'Cliente B', '5511999998888', 5000),
  ('00000000-0000-0000-0000-000000087502', '00000000-0000-0000-0000-00000000087a', 'Cliente A', '11999998888',   2500);
insert into public.site_orders (id, organization_id, customer_name, customer_whatsapp, total_cents, status, converted_at) values
  ('00000000-0000-0000-0000-000000087503', '00000000-0000-0000-0000-00000000087a', 'Convertido A', '11977776666', 3000, 'confirmado', now());
insert into public.site_order_items (organization_id, site_order_id, product_id, product_name, qty, unit_price_cents) values
  ('00000000-0000-0000-0000-00000000087b', '00000000-0000-0000-0000-000000087501', '00000000-0000-0000-0000-000000087d03', 'PLA B', 2, 2500);

-- default de products.kind e a CHECK
do $$
begin
  if (select kind from public.products where id = '00000000-0000-0000-0000-000000087d02') <> 'peca' then
    raise exception 'FALHOU: products.kind';
  end if;
  begin
    insert into public.products (organization_id, name, kind) values ('00000000-0000-0000-0000-00000000087a', 'x', 'resina');
    raise exception 'FALHOU: products.kind aceitou valor fora da lista';
  exception when check_violation then null;
  end;
  raise notice 'OK: products.kind so aceita peca/filamento';
end $$;

-- products.kind imutavel para todos (aqui como dono da tabela, sem RLS)
do $$
begin
  update public.products set kind = 'peca' where id = '00000000-0000-0000-0000-000000087d02';  -- mesmo valor: ok
  begin
    update public.products set kind = 'filamento' where id = '00000000-0000-0000-0000-000000087d02';
    raise exception 'FALHOU: products.kind mudou de peca para filamento';
  exception when check_violation then null;
  end;
  begin
    update public.products set kind = 'peca' where id = '00000000-0000-0000-0000-000000087d01';
    raise exception 'FALHOU: products.kind mudou de filamento para peca';
  exception when check_violation then null;
  end;
  raise notice 'OK: products.kind imutavel depois de criado (23514)';
end $$;

-- integridade das fichas e itens (como dono da tabela, sem RLS: vale tambem para o service role)
do $$
begin
  begin
    insert into public.product_filament_specs (product_id, organization_id)
    values ('00000000-0000-0000-0000-000000087d02', '00000000-0000-0000-0000-00000000087a');
    raise exception 'FALHOU: ficha aceita em produto kind=peca';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_filament_specs (product_id, organization_id)
    values ('00000000-0000-0000-0000-000000087d03', '00000000-0000-0000-0000-00000000087a');
    raise exception 'FALHOU: ficha aceita com org diferente da do produto';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_filament_specs (product_id, organization_id, material_id)
    values ('00000000-0000-0000-0000-000000087d01', '00000000-0000-0000-0000-00000000087a', '00000000-0000-0000-0000-000000087e01');
    raise exception 'FALHOU: ficha aceita material de outra org';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_filament_specs (product_id, organization_id, color_hex)
    values ('00000000-0000-0000-0000-000000087d01', '00000000-0000-0000-0000-00000000087a', 'red');
    raise exception 'FALHOU: color_hex aceitou valor invalido';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_filament_specs (product_id, organization_id, availability)
    values ('00000000-0000-0000-0000-000000087d01', '00000000-0000-0000-0000-00000000087a', 'disponivel');
    raise exception 'FALHOU: availability aceitou valor invalido';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_filament_specs (product_id, organization_id, nozzle_temp_min, nozzle_temp_max)
    values ('00000000-0000-0000-0000-000000087d01', '00000000-0000-0000-0000-00000000087a', 230, 190);
    raise exception 'FALHOU: aceitou temperatura minima > maxima';
  exception when check_violation then null;
  end;
  begin
    insert into public.site_order_items (organization_id, site_order_id, product_name, qty, unit_price_cents)
    values ('00000000-0000-0000-0000-00000000087a', '00000000-0000-0000-0000-000000087501', 'x', 1, 100);
    raise exception 'FALHOU: item com org diferente da do pedido';
  exception when check_violation then null;
  end;
  begin
    insert into public.site_order_items (organization_id, site_order_id, product_id, product_name, qty, unit_price_cents)
    values ('00000000-0000-0000-0000-00000000087b', '00000000-0000-0000-0000-000000087501',
            '00000000-0000-0000-0000-000000087d01', 'x', 1, 100);
    raise exception 'FALHOU: item aceitou produto de outra org';
  exception when check_violation then null;
  end;
  begin
    insert into public.site_orders (organization_id, customer_name, customer_whatsapp)
    values ('00000000-0000-0000-0000-00000000087a', 'Cliente', '+55 11 99999-8888');
    raise exception 'FALHOU: customer_whatsapp aceitou formatacao';
  exception when check_violation then null;
  end;
  raise notice 'OK: fichas/itens recusam kind=peca, org cruzada, material/produto alheio, hex/availability/temperatura/whatsapp invalidos';
end $$;

-- service role grava pedido do site (caminho da API publica)
set local role service_role;
insert into public.site_orders (organization_id, customer_name, customer_whatsapp, source)
values ('00000000-0000-0000-0000-00000000087a', 'Via API', '11988887777', 'site_produtos');
reset role;

set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000087a1"}';

do $$
declare v_specs int; v_orders int; v_items int;
begin
  select count(*) into v_specs  from public.product_filament_specs where organization_id = '00000000-0000-0000-0000-00000000087b';
  select count(*) into v_orders from public.site_orders            where organization_id = '00000000-0000-0000-0000-00000000087b';
  select count(*) into v_items  from public.site_order_items       where organization_id = '00000000-0000-0000-0000-00000000087b';
  if v_specs + v_orders + v_items <> 0 then
    raise exception 'FALHOU: membro de A le dados de B (specs %, pedidos %, itens %)', v_specs, v_orders, v_items;
  end if;
  if (select count(*) from public.site_orders where organization_id = '00000000-0000-0000-0000-00000000087a') <> 3 then
    raise exception 'FALHOU: membro de A deveria ver os 3 pedidos da propria org';
  end if;
  raise notice 'OK: membro de A nao le fichas, pedidos nem itens de B';
end $$;

do $$
begin
  insert into public.site_orders (organization_id, customer_name, customer_whatsapp)
  values ('00000000-0000-0000-0000-00000000087a', 'Forjado', '11999998888');
  raise exception 'FALHOU: authenticated inseriu site_orders';
exception when insufficient_privilege then
  raise notice 'OK: authenticated nao insere site_orders (so a API com service role)';
end $$;

do $$
begin
  insert into public.site_order_items (organization_id, site_order_id, product_name, qty, unit_price_cents)
  values ('00000000-0000-0000-0000-00000000087a', '00000000-0000-0000-0000-000000087502', 'x', 1, 100);
  raise exception 'FALHOU: authenticated inseriu site_order_items';
exception when insufficient_privilege then
  raise notice 'OK: authenticated nao insere site_order_items';
end $$;

do $$
declare v_changed int; v_deleted int;
begin
  with u as (update public.site_orders set status = 'confirmado' where id = '00000000-0000-0000-0000-000000087502' returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 1 then raise exception 'FALHOU: agent nao confirmou pedido da propria org'; end if;
  with u as (update public.site_orders set status = 'cancelado' where id = '00000000-0000-0000-0000-000000087501' returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 0 then raise exception 'FALHOU: agent de A alterou pedido de B'; end if;
  with d as (delete from public.site_orders where id = '00000000-0000-0000-0000-000000087502' returning 1)
  select count(*) into v_deleted from d;
  if v_deleted <> 0 then raise exception 'FALHOU: agent apagou pedido (DELETE e manager+)'; end if;
  raise notice 'OK: agent confirma pedido da propria org, nao toca o de B e nao apaga';
end $$;

-- UPDATE so em (status, notes): converted_at / total_cents / cliente fora do alcance do usuario
do $$
declare v_changed int;
begin
  with u as (update public.site_orders set notes = 'ligar amanha' where id = '00000000-0000-0000-0000-000000087503' returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 1 then raise exception 'FALHOU: agent nao editou notes'; end if;
  begin
    update public.site_orders set converted_at = null where id = '00000000-0000-0000-0000-000000087503';
    raise exception 'FALHOU: agent limpou converted_at (reconversao = venda duplicada)';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.site_orders set total_cents = 1 where id = '00000000-0000-0000-0000-000000087503';
    raise exception 'FALHOU: agent alterou total_cents';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.site_orders set customer_whatsapp = '11900000000' where id = '00000000-0000-0000-0000-000000087503';
    raise exception 'FALHOU: agent alterou customer_whatsapp';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.site_orders set converted_at = now() where id = '00000000-0000-0000-0000-000000087502';
    raise exception 'FALHOU: agent marcou converted_at pelo client do usuario';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: agent edita status/notes; converted_at, total_cents e cliente recusados (42501)';
end $$;

-- o gatilho segura mesmo sem depender do GRANT por coluna (JWT authenticated, sessao privilegiada)
reset role;
do $$
begin
  begin
    update public.site_orders set converted_at = null where id = '00000000-0000-0000-0000-000000087503';
    raise exception 'FALHOU: gatilho deixou JWT authenticated limpar converted_at';
  exception when check_violation then null;
  end;
  begin
    update public.site_orders set total_cents = 1 where id = '00000000-0000-0000-0000-000000087503';
    raise exception 'FALHOU: gatilho deixou JWT authenticated alterar total_cents';
  exception when check_violation then null;
  end;
  raise notice 'OK: gatilho de site_orders recusa converted_at/total com JWT authenticated (23514)';
end $$;

-- service role (servidor) desfaz e marca a conversao
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
do $$
declare v_changed int;
begin
  with u as (update public.site_orders set converted_at = null, status = 'novo'
              where id = '00000000-0000-0000-0000-000000087503' returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 1 then raise exception 'FALHOU: service role nao desfez a conversao'; end if;
  with u as (update public.site_orders set converted_at = now(), status = 'confirmado'
              where id = '00000000-0000-0000-0000-000000087503' and converted_at is null returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 1 then raise exception 'FALHOU: service role nao marcou a conversao'; end if;
  raise notice 'OK: service role marca e desfaz converted_at';
end $$;
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000087a1"}';

do $$
begin
  insert into public.product_filament_specs (product_id, organization_id, color_hex, availability, diameter_mm)
  values ('00000000-0000-0000-0000-000000087d01', '00000000-0000-0000-0000-00000000087a', '#112233', 'sob_encomenda', 2.85);
  begin
    insert into public.product_filament_specs (product_id, organization_id)
    values ('00000000-0000-0000-0000-000000087d02', '00000000-0000-0000-0000-00000000087a');
    raise exception 'FALHOU: membro pendurou ficha em produto kind=peca';
  exception when check_violation then null;
  end;
  begin
    insert into public.product_filament_specs (product_id, organization_id)
    values ('00000000-0000-0000-0000-000000087d03', '00000000-0000-0000-0000-00000000087a');
    raise exception 'FALHOU: membro de A pendurou ficha no produto de B';
  exception when check_violation then null;
  end;
  raise notice 'OK: membro cria ficha do proprio filamento; peca e produto de B recusados';
end $$;

do $$
begin
  update public.platform_settings set pro_price_cents = 100 where id = 1;
  raise exception 'FALHOU: authenticated comum alterou platform_settings';
exception when insufficient_privilege then
  raise notice 'OK: authenticated comum nao altera platform_settings (42501)';
end $$;

-- nem platform admin pelo PostgREST: fn_is_platform_admin() ignora MFA; quem grava e a rota admin (service role)
set local request.jwt.claims = '{"role":"authenticated","sub":"00000000-0000-0000-0000-0000000087f1"}';
do $$
begin
  if not public.fn_is_platform_admin() then raise exception 'FALHOU: stub de platform admin nao reconhecido'; end if;
  begin
    update public.platform_settings set pro_price_cents = 100 where id = 1;
    raise exception 'FALHOU: platform admin alterou platform_settings pelo client do usuario';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.platform_settings (id) values (1) on conflict (id) do nothing;
    raise exception 'FALHOU: platform admin inseriu em platform_settings pelo client do usuario';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: platform admin nao grava platform_settings pelo client do usuario (42501)';
end $$;

reset role;
set local role service_role;
set local request.jwt.claims = '{"role":"service_role"}';
do $$
declare v_changed int;
begin
  with u as (update public.platform_settings
                set pro_price_cents = 9900, updated_by = '00000000-0000-0000-0000-0000000087f1'
              where id = 1 returning 1)
  select count(*) into v_changed from u;
  if v_changed <> 1 then raise exception 'FALHOU: service role nao alterou platform_settings'; end if;
  begin
    insert into public.platform_settings (id) values (2);
    raise exception 'FALHOU: platform_settings aceitou segunda linha';
  exception when check_violation then null;
  end;
  raise notice 'OK: service role altera platform_settings; segunda linha recusada';
end $$;

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  if (select pro_price_cents from public.platform_settings where id = 1) is distinct from 9900 then
    raise exception 'FALHOU: anon nao le platform_settings';
  end if;
  begin
    update public.platform_settings set trial_days = 0 where id = 1;
    raise exception 'FALHOU: anon alterou platform_settings';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.site_orders limit 1;
    raise exception 'FALHOU: anon le site_orders';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.product_filament_specs limit 1;
    raise exception 'FALHOU: anon le product_filament_specs';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK: anon le platform_settings, nao altera; nao le fichas nem pedidos';
end $$;
rollback;
SQL

echo
echo "TUDO PASSOU"
