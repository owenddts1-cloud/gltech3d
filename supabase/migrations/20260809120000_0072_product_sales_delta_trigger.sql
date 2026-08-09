-- 0072_product_sales_delta_trigger
--
-- DEFEITO CORRIGIDO: `fn_bump_product_sales` (0055) só reagia a TRANSIÇÃO DE
-- STATUS — era `after insert or update OF STATUS` e exigia
-- `old.status is distinct from new.status`.
--
-- Consequência prática: vincular um produto a uma venda que JÁ estava paga não
-- disparava nada. Como o fluxo normal é "lançar a venda, depois escolher a peça",
-- e como as vendas históricas já nascem `concluido`, o contador `sold_qty`
-- simplesmente nunca subia. O ranking de mais vendidos ficava preso na curadoria
-- manual, sem ninguém perceber que o número não vinha de venda nenhuma.
--
-- Outros três buracos do mesmo desenho:
--   * venda paga CANCELADA nunca devolvia a quantidade (contador inflava para
--     sempre, estoque ficava furado);
--   * mudar a QUANTIDADE de uma venda paga não ajustava nada;
--   * APAGAR uma venda paga deixava o contador inflado.
--
-- SOLUÇÃO — pensar em CONTRIBUIÇÃO, não em transição:
--
--   contribuicao(linha) = qty  quando product_id não é nulo
--                              E status ∈ ('pago','concluido')
--                       = 0    caso contrário
--
--   INSERT → +contribuicao(new) em new.product_id
--   UPDATE → −contribuicao(old) em old.product_id
--            +contribuicao(new) em new.product_id
--   DELETE → −contribuicao(old) em old.product_id
--
-- Os seis casos (vincular, desvincular, trocar de peça, mudar quantidade,
-- cancelar, apagar) caem todos fora de UM conceito, em vez de seis ramos.
-- Quando nada relevante muda, o delta é zero e nenhum UPDATE é emitido.
--
-- `sold_qty` é EXATO. `stock_qty` é best-effort: o decremento usa
-- `greatest(0, ...)` porque existe CHECK de não-negativo, então uma baixa
-- clampada não é "lembrada" e o estorno pode devolver mais do que tirou. Trocar
-- isso exigiria uma tabela de movimentação de estoque — fora de escopo aqui, e
-- registrado no runbook.
--
-- NOTA DE PL/pgSQL: os campos de OLD só são lidos dentro do ramo
-- UPDATE/DELETE, e os de NEW dentro do ramo INSERT/UPDATE. Em gatilho de DELETE
-- o registro NEW não é atribuído, e tocá-lo levanta "record new is not assigned
-- yet" — o SQL não garante curto-circuito em `AND`, então não dá para confiar
-- numa guarda do tipo `tg_op <> 'DELETE' and new.x ...` dentro da MESMA
-- expressão.
--
-- Idempotente: `create or replace function` + `drop trigger if exists`.

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) Aplicador de delta — uma peça, uma quantidade (pode ser negativa)
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.fn_apply_product_sale_delta(
  p_product_id uuid,
  p_organization_id uuid,
  p_delta integer
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if p_product_id is null or p_organization_id is null or coalesce(p_delta, 0) = 0 then
    return;
  end if;

  update public.products
     set sold_qty  = greatest(0, sold_qty + p_delta),
         -- Venda consome estoque: delta positivo baixa, negativo devolve.
         stock_qty = greatest(0, stock_qty - p_delta),
         updated_at = now()
   where id = p_product_id
     and organization_id = p_organization_id;
end $$;

comment on function public.fn_apply_product_sale_delta(uuid, uuid, integer) is
  'Aplica um delta de unidades vendidas a uma peca. Delta positivo = vendeu; '
  'negativo = estorno/desvinculo. Usado por fn_bump_product_sales.';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) Gatilho por delta
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.fn_bump_product_sales() returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_old_product uuid    := null;
  v_old_org     uuid    := null;
  v_old_qty     integer := 0;
  v_new_product uuid    := null;
  v_new_org     uuid    := null;
  v_new_qty     integer := 0;
begin
  -- Contribuição ANTES da mudança (OLD só existe em UPDATE/DELETE).
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_product := old.product_id;
    v_old_org     := old.organization_id;
    if old.product_id is not null and old.status in ('pago', 'concluido') then
      v_old_qty := coalesce(old.qty, 1);
    end if;
  end if;

  -- Contribuição DEPOIS da mudança (NEW só existe em INSERT/UPDATE).
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_product := new.product_id;
    v_new_org     := new.organization_id;
    if new.product_id is not null and new.status in ('pago', 'concluido') then
      v_new_qty := coalesce(new.qty, 1);
    end if;
  end if;

  -- Nada contribuía e nada passa a contribuir: sai sem tocar em produto nenhum.
  if v_old_qty = 0 and v_new_qty = 0 then
    return null;
  end if;

  if v_old_product is distinct from v_new_product then
    -- Trocou de peça (inclui vincular e desvincular): tira de uma, põe na outra.
    perform public.fn_apply_product_sale_delta(v_old_product, v_old_org, -v_old_qty);
    perform public.fn_apply_product_sale_delta(v_new_product, v_new_org, v_new_qty);
  else
    -- Mesma peça: só a diferença (mudou status ou quantidade).
    perform public.fn_apply_product_sale_delta(
      coalesce(v_new_product, v_old_product),
      coalesce(v_new_org, v_old_org),
      v_new_qty - v_old_qty
    );
  end if;

  -- Evento só quando houve venda NOVA (padrão do repo: trigger emite, worker
  -- consome). Estorno e desvínculo não emitem `product.sold`.
  if tg_op in ('INSERT', 'UPDATE') and v_new_qty > v_old_qty then
    perform public.emit_event(
      'product.sold',
      'product',
      new.product_id,
      jsonb_build_object(
        'marketplace_order_id', new.id,
        'qty', v_new_qty - v_old_qty,
        'total_cents', new.total_cents
      ),
      '{}'::jsonb,
      new.organization_id
    );
  end if;

  -- Gatilho AFTER: o valor de retorno é ignorado.
  return null;
end $$;

-- O gatilho antigo só observava `status`; agora precisa observar também
-- `product_id` (vincular) e `qty` (corrigir quantidade), e reagir a DELETE.
drop trigger if exists trg_bump_sales on public.marketplace_orders;
create trigger trg_bump_sales
  after insert or delete or update of status, product_id, qty
  on public.marketplace_orders
  for each row execute function public.fn_bump_product_sales();

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) Reconciliação — recalcula sold_qty a partir das vendas
-- ═══════════════════════════════════════════════════════════════════════════
-- Rede de segurança contra desvio acumulado pelo gatilho antigo.
--
-- CUIDADO DELIBERADO: só toca peças que têm AO MENOS UMA venda vinculada.
-- `sold_qty` é editável à mão no CRM; zerar a peça sem venda vinculada
-- destruiria um número que o usuário digitou de propósito.
--
-- NÃO mexe em `stock_qty`: sem histórico de movimentação, não há como recalcular
-- estoque a partir das vendas sem inventar o saldo inicial.
create or replace function public.fn_reconcile_product_sales(
  p_organization_id uuid default null
) returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_touched integer := 0;
begin
  with truth as (
    select
      o.product_id,
      o.organization_id,
      sum(
        case when o.status in ('pago', 'concluido') then coalesce(o.qty, 1) else 0 end
      )::integer as real_sold
    from public.marketplace_orders o
    where o.product_id is not null
      and (p_organization_id is null or o.organization_id = p_organization_id)
    group by o.product_id, o.organization_id
  ),
  fixed as (
    update public.products p
       set sold_qty = t.real_sold,
           updated_at = now()
      from truth t
     where p.id = t.product_id
       and p.organization_id = t.organization_id
       and p.sold_qty is distinct from t.real_sold
    returning 1 as touched
  )
  select count(*)::integer into v_touched from fixed;

  return v_touched;
end $$;

comment on function public.fn_reconcile_product_sales(uuid) is
  'Recalcula products.sold_qty a partir de marketplace_orders. So toca pecas com '
  'ao menos uma venda vinculada (sold_qty tambem e editavel a mao). Nao mexe em '
  'stock_qty: nao ha historico de movimentacao para reconstruir o saldo.';

-- Corrige o desvio que o gatilho antigo possa ter deixado. Em banco onde nenhuma
-- venda tem produto vinculado, isto é no-op — nenhuma linha entra em `truth`.
select public.fn_reconcile_product_sales(null);
