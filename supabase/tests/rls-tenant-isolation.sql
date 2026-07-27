-- ============================================================================
-- GATE OBRIGATÓRIO: isolamento entre tenants
--
-- O CLAUDE.md exige este teste em dois lugares ("cria 2 tenants, verifica
-- não-vazamento", "gate obrigatório no CI antes de merge") e ele nunca existiu —
-- constava apenas como pendência em tests/e2e/README.md.
--
-- Cria duas organizações com dois usuários, popula dados só na org A, e verifica
-- que o usuário de B não enxerga nem consegue escrever nada de A. As políticas
-- `tenant_isolation_*` dependem de `fn_user_org_ids()`, que lê `auth.uid()`;
-- por isso o teste troca de papel para `authenticated` e injeta as claims do JWT,
-- em vez de rodar como `postgres` (que ignora RLS).
--
-- TUDO ROLA DENTRO DE UMA TRANSAÇÃO QUE TERMINA EM ROLLBACK. Nenhuma linha
-- sobrevive, então é seguro rodar contra o banco de produção.
--
-- Como rodar:
--   npx supabase db query --file supabase/tests/rls-tenant-isolation.sql
--   ou psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls-tenant-isolation.sql
--
-- Sucesso = a mensagem final "ISOLAMENTO OK". Falha = exception com o caso.
-- ============================================================================

begin;

do $$
declare
  org_a uuid := gen_random_uuid();
  org_b uuid := gen_random_uuid();
  usr_a uuid := gen_random_uuid();
  usr_b uuid := gen_random_uuid();
  so_a  uuid;
  ct_a  uuid;
  visto int;
  falhou boolean;
begin
  -- ── Cenário ───────────────────────────────────────────────────────────────
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                          email_confirmed_at, created_at, updated_at)
  values
    (usr_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-a@test.invalid', '', now(), now(), now()),
    (usr_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'rls-b@test.invalid', '', now(), now(), now());

  insert into public.organizations (id, display_name, legal_name, slug)
  values (org_a, 'RLS Org A', 'RLS Org A', 'rls-org-a-' || left(org_a::text, 8)),
         (org_b, 'RLS Org B', 'RLS Org B', 'rls-org-b-' || left(org_b::text, 8));

  insert into public.user_organizations (user_id, organization_id, role)
  values (usr_a, org_a, 'admin'), (usr_b, org_b, 'admin');

  -- Dados exclusivamente da org A.
  insert into public.contacts (organization_id, name)
  values (org_a, 'Contato Secreto de A') returning id into ct_a;

  insert into public.service_orders (organization_id, title, total_cents, qty)
  values (org_a, 'O.S. Secreta de A', 50000, 1) returning id into so_a;

  insert into public.service_order_items (organization_id, service_order_id, name, qty, unit_price_cents)
  values (org_a, so_a, 'Item de A', 1, 50000);

  insert into public.service_order_documents (organization_id, service_order_id, doc_type, snapshot, total_cents)
  values (org_a, so_a, 'orcamento', '{"version":1}'::jsonb, 50000);

  -- ── Vira o usuário de B ───────────────────────────────────────────────────
  -- `postgres` ignora RLS; sem trocar de papel o teste passaria sempre.
  set local role authenticated;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', usr_b, 'role', 'authenticated')::text,
                     true);

  if auth.uid() <> usr_b then
    raise exception 'FALHOU: auth.uid() não refletiu o usuário B (teste inválido)';
  end if;

  -- ── Leitura: B não pode ver nada de A ─────────────────────────────────────
  select count(*) into visto from public.contacts where organization_id = org_a;
  if visto <> 0 then raise exception 'VAZOU: B enxerga % contato(s) de A', visto; end if;

  select count(*) into visto from public.service_orders where organization_id = org_a;
  if visto <> 0 then raise exception 'VAZOU: B enxerga % O.S. de A', visto; end if;

  select count(*) into visto from public.service_order_items where organization_id = org_a;
  if visto <> 0 then raise exception 'VAZOU: B enxerga % item(ns) de O.S. de A', visto; end if;

  select count(*) into visto from public.service_order_documents where organization_id = org_a;
  if visto <> 0 then raise exception 'VAZOU: B enxerga % documento(s) de A', visto; end if;

  select count(*) into visto from public.financial_records where organization_id = org_a;
  if visto <> 0 then raise exception 'VAZOU: B enxerga % lançamento(s) de A', visto; end if;

  select count(*) into visto from public.marketplace_orders where organization_id = org_a;
  if visto <> 0 then raise exception 'VAZOU: B enxerga % venda(s) de A', visto; end if;

  -- Consulta sem filtro de org: a RLS é a única defesa aqui.
  select count(*) into visto from public.service_orders;
  if visto <> 0 then
    raise exception 'VAZOU: select sem filtro devolveu % O.S. para B (deveria ser 0)', visto;
  end if;

  -- ── Escrita: B não pode gravar na org de A ────────────────────────────────
  falhou := false;
  begin
    insert into public.contacts (organization_id, name) values (org_a, 'Injetado por B');
  exception when others then falhou := true;
  end;
  if not falhou then
    raise exception 'VAZOU: B conseguiu inserir contato na org de A';
  end if;

  -- Vínculo cruzado: item de B apontando para a O.S. de A. Barrado pelo
  -- WITH CHECK da policy E pela FK composta (id, organization_id) da 0068.
  falhou := false;
  begin
    insert into public.service_order_items (organization_id, service_order_id, name, qty, unit_price_cents)
    values (org_b, so_a, 'Item cruzado', 1, 100);
  exception when others then falhou := true;
  end;
  if not falhou then
    raise exception 'VAZOU: B conseguiu pendurar item na O.S. de A';
  end if;

  -- ── B enxerga o que é dele ────────────────────────────────────────────────
  -- Sem esta checagem, uma RLS quebrada que negasse tudo passaria no teste.
  insert into public.service_orders (organization_id, title, total_cents, qty)
  values (org_b, 'O.S. de B', 100, 1);

  select count(*) into visto from public.service_orders where organization_id = org_b;
  if visto <> 1 then
    raise exception 'FALHOU: B deveria ver a própria O.S., viu %', visto;
  end if;

  reset role;
  raise notice 'ISOLAMENTO OK — leitura e escrita cruzadas bloqueadas nas 6 tabelas.';
end $$;

-- Nada aqui persiste.
rollback;
