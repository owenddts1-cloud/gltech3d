-- 0067_service_orders_remove_pos_processamento
-- Remove a etapa "Pós-Processo" do funil de O.S. Reatribui defensivamente qualquer
-- O.S. nesse estágio para 'em_producao' ANTES de apertar o CHECK (0 O.S. em produção
-- estão nesse estágio hoje, mas a migration protege clones self-host com dados
-- diferentes).
-- Idempotent — safe to re-apply.

update public.service_orders
set status = 'em_producao'
where status = 'pos_processamento';

alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders add constraint service_orders_status_check
  check (status in (
    'orcamento', 'aprovado', 'em_producao', 'pronto_entrega', 'concluido'
  ));
