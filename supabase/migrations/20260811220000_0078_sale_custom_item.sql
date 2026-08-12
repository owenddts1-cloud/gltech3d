-- =============================================================================
-- Migration 0078 — "peça avulsa" vira fato, e não ausência de fato
-- =============================================================================
-- O PROBLEMA. Nenhuma das 26 vendas tem `product_id`, e por isso o gatilho da
-- 0072 nunca conta: `sold_qty` fica em zero para todas as pecas, o ranking de
-- mais vendidos vira curadoria manual e o COGS por venda nao existe — que e de
-- onde sai a "margem de 95,5%" da tela de Vendas.
--
-- A correcao na interface e tornar a peca obrigatoria. Mas nem toda venda e de
-- item do catalogo: encomenda sob medida, servico, frete cobrado a parte. Sem
-- uma saida explicita, o operador seria empurrado a escolher QUALQUER produto
-- so para conseguir salvar — e vinculo errado e pior que vinculo ausente,
-- porque contamina `sold_qty` e o custo de uma peca que nao foi vendida.
--
-- POR QUE UMA COLUNA, e nao apenas deixar `product_id` nulo: hoje nulo significa
-- "esqueci de preencher". Se "avulsa" tambem gravar nulo, os dois casos ficam
-- indistinguiveis, e daqui a seis meses a pergunta "quantas vendas estao sem
-- peca?" volta a nao ter resposta. Com a coluna, avulsa e uma afirmacao.

alter table public.marketplace_orders
  add column if not exists is_custom_item boolean not null default false;

-- Coerencia: avulsa e produto vinculado sao mutuamente exclusivos. Sem isto,
-- uma venda poderia afirmar as duas coisas e nenhum relatorio saberia qual vale.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'marketplace_orders_custom_xor_product'
  ) then
    -- Corrige o dado ANTES da constraint: linha que ja tenha as duas marcas
    -- perde a de avulsa, porque o vinculo com produto e a informacao mais forte.
    update public.marketplace_orders
       set is_custom_item = false
     where is_custom_item and product_id is not null;

    alter table public.marketplace_orders
      add constraint marketplace_orders_custom_xor_product
      check (not (is_custom_item and product_id is not null));
  end if;
end $$;

-- Diagnostico de cobertura: quantas vendas ainda estao sem classificacao.
create index if not exists marketplace_orders_unclassified_idx
  on public.marketplace_orders (organization_id)
  where product_id is null and not is_custom_item;

comment on column public.marketplace_orders.is_custom_item is
  'Venda de item FORA do catalogo (sob medida, servico). Exclusivo com product_id. '
  'Distingue "nao e do catalogo" de "faltou preencher".';
