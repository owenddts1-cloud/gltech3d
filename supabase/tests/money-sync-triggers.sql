-- ============================================================================
-- Sincronização de dinheiro: O.S. ↔ Venda ↔ Lançamento financeiro
--
-- Cobre as triggers das migrations 0063-0066 mais o recálculo por itens da 0068.
-- É a lógica mais crítica do sistema — bidirecional, recursiva e sobre dinheiro —
-- e não tinha nenhum teste. O próprio baseline.sql documenta em comentário a
-- análise de terminação da cascata; aqui ela é verificada de fato.
--
-- TUDO DENTRO DE UMA TRANSAÇÃO QUE TERMINA EM ROLLBACK — seguro em produção.
--
-- Como rodar:
--   npx supabase db query --file supabase/tests/money-sync-triggers.sql
--   ou psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/money-sync-triggers.sql
--
-- Sucesso = "SINCRONIZACAO OK". Falha = exception nomeando a invariante.
-- ============================================================================

begin;

do $$
declare
  org uuid := gen_random_uuid();
  so uuid; so2 uuid; mo uuid;
  v_total bigint; v_qty int; v_mo bigint;
  a1 bigint; a2 bigint; vendas int;
begin
  insert into public.organizations (id, display_name, legal_name, slug)
  values (org, 'Money Test', 'Money Test', 'money-test-' || left(org::text, 8));

  insert into public.service_orders (organization_id, title, total_cents, qty)
  values (org, 'O.S. de teste', 1000, 1) returning id into so;

  -- ── 1. Itens recalculam total_cents e qty da O.S. (0068) ──────────────────
  insert into public.service_order_items (organization_id, service_order_id, name, qty, unit_price_cents)
  values (org, so, 'Peca A', 2, 5000), (org, so, 'Peca B', 1, 3000);

  select total_cents, qty into v_total, v_qty from public.service_orders where id = so;
  if v_total <> 13000 then raise exception 'FALHOU 1: total_cents=% (esperado 13000)', v_total; end if;
  if v_qty <> 3 then raise exception 'FALHOU 1: qty=% (esperado 3)', v_qty; end if;

  -- ── 2. Concluir a O.S. gera Venda automaticamente (0063) ──────────────────
  update public.service_orders set status = 'concluido' where id = so;

  select count(*) into vendas from public.marketplace_orders where service_order_id = so;
  if vendas <> 1 then raise exception 'FALHOU 2: esperava 1 Venda, achei %', vendas; end if;

  select id, total_cents into mo, v_mo from public.marketplace_orders where service_order_id = so;
  if v_mo <> 13000 then raise exception 'FALHOU 2: Venda com total_cents=%', v_mo; end if;

  -- ── 3. Editar item propaga para a Venda (0065) ────────────────────────────
  update public.service_order_items set unit_price_cents = 10000
   where service_order_id = so and name = 'Peca A';

  select total_cents into v_total from public.service_orders where id = so;
  select total_cents into v_mo from public.marketplace_orders where service_order_id = so;
  if v_total <> 23000 then raise exception 'FALHOU 3: O.S.=% (esperado 23000)', v_total; end if;
  if v_mo <> 23000 then raise exception 'FALHOU 3: Venda nao acompanhou (%)', v_mo; end if;

  -- ── 4. Eco não amplifica ──────────────────────────────────────────────────
  -- Um UPDATE que não muda valor não pode gerar escrita em service_orders. É o
  -- guard `IS DISTINCT FROM` no WHERE de fn_service_orders_recalc_total. Sem ele,
  -- salvar itens dispararia a cascata 0065/0066 à toa a cada vez.
  -- Precisa rodar ANTES de qualquer divergência (ver 6), senão a reconciliação
  -- legítima seria confundida com amplificação.
  select count(*) into a1 from public.api_audit_log where resource_type = 'service_orders';
  update public.service_order_items set name = name where service_order_id = so;
  select count(*) into a2 from public.api_audit_log where resource_type = 'service_orders';
  if a2 <> a1 then raise exception 'FALHOU 4: eco gerou % escrita(s) em service_orders', a2 - a1; end if;

  -- ── 5. Bidirecional: editar a Venda volta para a O.S. (0065) ──────────────
  update public.marketplace_orders set total_cents = 31000 where id = mo;

  select total_cents into v_total from public.service_orders where id = so;
  if v_total <> 31000 then
    raise exception 'FALHOU 5: edicao na Venda nao voltou para a O.S. (%)', v_total;
  end if;

  -- Chegar aqui já prova a TERMINAÇÃO da cascata: houvesse ciclo, o UPDATE acima
  -- não retornaria (ou estouraria stack depth).

  -- ── 6. Divergência reconcilia pelos itens ─────────────────────────────────
  -- Comportamento conhecido e desejado, documentado aqui para não virar surpresa:
  -- editar o valor pela tela de Vendas ou do Controle grava direto em
  -- service_orders.total_cents e passa a divergir da soma dos itens. O próximo
  -- toque em qualquer item reconcilia para a soma, que é a fonte da verdade
  -- quando existem itens. O gerador de documentos avisa dessa divergência com a
  -- faixa âmbar e o botão "Recalcular pelos itens".
  update public.service_order_items set name = name where service_order_id = so;
  select total_cents into v_total from public.service_orders where id = so;
  if v_total <> 23000 then
    raise exception 'FALHOU 6: reconciliacao deu % (esperado a soma dos itens, 23000)', v_total;
  end if;

  -- ── 7. Apagar todos os itens PRESERVA o total ─────────────────────────────
  -- Regra de produto: O.S. sem item mantém o valor digitado à mão, senão toda
  -- O.S. legada (que nunca teve itens) seria zerada pela migration.
  delete from public.service_order_items where service_order_id = so;
  select total_cents into v_total from public.service_orders where id = so;
  if v_total <> 23000 then raise exception 'FALHOU 7: apagar itens mudou o total (%)', v_total; end if;

  -- ── 8. O.S. sem itens mantém o total manual ───────────────────────────────
  insert into public.service_orders (organization_id, title, total_cents, qty)
  values (org, 'O.S. sem itens', 7700, 1) returning id into so2;
  select total_cents into v_total from public.service_orders where id = so2;
  if v_total <> 7700 then raise exception 'FALHOU 8: O.S. sem itens virou %', v_total; end if;

  raise notice 'SINCRONIZACAO OK — 8 invariantes verificadas.';
end $$;

rollback;
