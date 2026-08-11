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
echo "TUDO PASSOU"
