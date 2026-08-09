-- ============================================================================
-- Contador de vendas por peça: products.sold_qty / stock_qty
--
-- Cobre o gatilho `fn_bump_product_sales` reescrito na migration 0072.
--
-- POR QUE ESTE TESTE EXISTE: o gatilho original (0055) só reagia a TRANSIÇÃO de
-- status. Vincular uma peça a uma venda que já estava paga — que é o fluxo
-- normal, e o único possível para venda histórica — não disparava nada. O
-- contador ficava em zero para sempre e ninguém percebia, porque não havia
-- nenhum teste e o número parecia plausível.
--
-- Os seis casos abaixo são exatamente os seis que o desenho antigo errava ou
-- ignorava.
--
-- TUDO DENTRO DE UMA TRANSAÇÃO QUE TERMINA EM ROLLBACK — seguro em produção.
--
-- Como rodar:
--   npx supabase db query --file supabase/tests/product-sales-delta.sql
--   ou psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/product-sales-delta.sql
--
-- Sucesso = "CONTADOR DE VENDAS OK". Falha = exception nomeando a invariante.
-- ============================================================================

begin;

do $$
declare
  org uuid := gen_random_uuid();
  pa uuid; pb uuid; venda uuid;
  v_sold int; v_stock int; v_sold_b int; v_touched int;
begin
  insert into public.organizations (id, display_name, legal_name, slug)
  values (org, 'Sales Delta Test', 'Sales Delta Test', 'sales-delta-' || left(org::text, 8));

  insert into public.products (organization_id, name, stock_qty, sold_qty, sale_price_cents)
  values (org, 'Peca A', 10, 0, 5000) returning id into pa;
  insert into public.products (organization_id, name, stock_qty, sold_qty, sale_price_cents)
  values (org, 'Peca B', 10, 0, 5000) returning id into pb;

  -- ── 1. VINCULAR peça a venda JÁ paga ──────────────────────────────────────
  -- O bug original: o gatilho era `update OF status` e exigia mudança de status,
  -- então este UPDATE não disparava NADA. É o caso das 24 vendas históricas.
  insert into public.marketplace_orders
    (organization_id, platform, customer_name, status, total_cents, qty, product_id)
  values (org, 'Outro', 'Cliente', 'concluido', 5000, 1, null)
  returning id into venda;

  select sold_qty, stock_qty into v_sold, v_stock from public.products where id = pa;
  if v_sold <> 0 then raise exception 'FALHOU 1a: venda sem peca ja contou (sold=%)', v_sold; end if;

  update public.marketplace_orders set product_id = pa where id = venda;

  select sold_qty, stock_qty into v_sold, v_stock from public.products where id = pa;
  if v_sold <> 1 then raise exception 'FALHOU 1: vincular peca a venda paga nao contou (sold=%, esperado 1)', v_sold; end if;
  if v_stock <> 9 then raise exception 'FALHOU 1: estoque nao baixou (stock=%, esperado 9)', v_stock; end if;

  -- ── 2. MUDAR A QUANTIDADE de uma venda paga e vinculada ───────────────────
  update public.marketplace_orders set qty = 3 where id = venda;

  select sold_qty, stock_qty into v_sold, v_stock from public.products where id = pa;
  if v_sold <> 3 then raise exception 'FALHOU 2: qty 1->3 nao ajustou (sold=%, esperado 3)', v_sold; end if;
  if v_stock <> 7 then raise exception 'FALHOU 2: estoque nao acompanhou (stock=%, esperado 7)', v_stock; end if;

  -- ── 3. TROCAR de peça ─────────────────────────────────────────────────────
  -- Tem de tirar de A e pôr em B na mesma operação.
  update public.marketplace_orders set product_id = pb where id = venda;

  select sold_qty into v_sold from public.products where id = pa;
  select sold_qty into v_sold_b from public.products where id = pb;
  if v_sold <> 0 then raise exception 'FALHOU 3: peca antiga nao devolveu (A sold=%, esperado 0)', v_sold; end if;
  if v_sold_b <> 3 then raise exception 'FALHOU 3: peca nova nao recebeu (B sold=%, esperado 3)', v_sold_b; end if;

  select stock_qty into v_stock from public.products where id = pa;
  if v_stock <> 10 then raise exception 'FALHOU 3: estoque de A nao voltou (stock=%, esperado 10)', v_stock; end if;

  -- ── 4. CANCELAR uma venda paga ────────────────────────────────────────────
  -- O gatilho antigo nunca descontava: o contador inflava para sempre.
  update public.marketplace_orders set status = 'cancelado' where id = venda;

  select sold_qty, stock_qty into v_sold_b, v_stock from public.products where id = pb;
  if v_sold_b <> 0 then raise exception 'FALHOU 4: cancelar nao descontou (B sold=%, esperado 0)', v_sold_b; end if;
  if v_stock <> 10 then raise exception 'FALHOU 4: cancelar nao devolveu estoque (stock=%, esperado 10)', v_stock; end if;

  -- ── 5. REATIVAR (cancelado -> pago) ───────────────────────────────────────
  update public.marketplace_orders set status = 'pago' where id = venda;

  select sold_qty into v_sold_b from public.products where id = pb;
  if v_sold_b <> 3 then raise exception 'FALHOU 5: reativar nao recontou (B sold=%, esperado 3)', v_sold_b; end if;

  -- ── 6. APAGAR a venda ─────────────────────────────────────────────────────
  -- O gatilho antigo nem observava DELETE.
  delete from public.marketplace_orders where id = venda;

  select sold_qty, stock_qty into v_sold_b, v_stock from public.products where id = pb;
  if v_sold_b <> 0 then raise exception 'FALHOU 6: apagar venda paga nao descontou (B sold=%, esperado 0)', v_sold_b; end if;
  if v_stock <> 10 then raise exception 'FALHOU 6: apagar nao devolveu estoque (stock=%, esperado 10)', v_stock; end if;

  -- ── 7. INSERT já pago e vinculado conta de uma vez ────────────────────────
  insert into public.marketplace_orders
    (organization_id, platform, customer_name, status, total_cents, qty, product_id)
  values (org, 'Outro', 'Cliente 2', 'pago', 10000, 2, pa)
  returning id into venda;

  select sold_qty into v_sold from public.products where id = pa;
  if v_sold <> 2 then raise exception 'FALHOU 7: insert pago+vinculado nao contou (sold=%, esperado 2)', v_sold; end if;

  -- ── 8. Venda PENDENTE nao conta ───────────────────────────────────────────
  insert into public.marketplace_orders
    (organization_id, platform, customer_name, status, total_cents, qty, product_id)
  values (org, 'Outro', 'Cliente 3', 'pendente', 5000, 5, pa);

  select sold_qty into v_sold from public.products where id = pa;
  if v_sold <> 2 then raise exception 'FALHOU 8: venda pendente contou (sold=%, esperado 2)', v_sold; end if;

  -- ── 9. DESVINCULAR devolve ────────────────────────────────────────────────
  update public.marketplace_orders set product_id = null where id = venda;

  select sold_qty into v_sold from public.products where id = pa;
  if v_sold <> 0 then raise exception 'FALHOU 9: desvincular nao devolveu (sold=%, esperado 0)', v_sold; end if;

  -- ── 10. RECONCILIAÇÃO ─────────────────────────────────────────────────────
  -- Simula desvio: mexe no contador por fora e manda reconciliar.
  update public.marketplace_orders set product_id = pa where id = venda;   -- volta a 2
  update public.products set sold_qty = 99 where id = pa;                  -- desvio artificial

  v_touched := public.fn_reconcile_product_sales(org);
  select sold_qty into v_sold from public.products where id = pa;
  if v_sold <> 2 then raise exception 'FALHOU 10: reconciliacao nao corrigiu (sold=%, esperado 2)', v_sold; end if;
  if v_touched < 1 then raise exception 'FALHOU 10: reconciliacao nao reportou linha tocada (%)', v_touched; end if;

  -- ── 11. Reconciliação NÃO zera peça sem venda vinculada ───────────────────
  -- `sold_qty` também é editável à mão no CRM; reconciliar não pode apagar isso.
  update public.products set sold_qty = 42 where id = pb;  -- pb nao tem venda vinculada
  perform public.fn_reconcile_product_sales(org);

  select sold_qty into v_sold_b from public.products where id = pb;
  if v_sold_b <> 42 then
    raise exception 'FALHOU 11: reconciliacao zerou peca sem venda vinculada (B sold=%, esperado 42)', v_sold_b;
  end if;

  raise notice 'CONTADOR DE VENDAS OK — 11 invariantes verificadas';
end $$;

rollback;
