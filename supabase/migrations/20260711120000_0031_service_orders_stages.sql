-- 0031_service_orders_stages
-- Expande o funil de Ordens de Serviço para as etapas do laboratório 3D e
-- adiciona prioridade + material para os cards estilo Deals.
-- Idempotent — safe to re-apply.

-- 1. Novos estágios do funil (mantém 'concluido' — sustenta o faturamento no dashboard).
alter table public.service_orders drop constraint if exists service_orders_status_check;
alter table public.service_orders add constraint service_orders_status_check
  check (status in (
    'orcamento', 'aprovado', 'em_producao', 'pos_processamento', 'pronto_entrega', 'concluido'
  ));

-- 2. Prioridade da OS (badge no card).
alter table public.service_orders add column if not exists priority text not null default 'media';
alter table public.service_orders drop constraint if exists service_orders_priority_check;
alter table public.service_orders add constraint service_orders_priority_check
  check (priority in ('alta', 'media', 'baixa'));

-- 3. Material exigido (PLA/ABS/PETG/TPU/...), livre e nullable.
alter table public.service_orders add column if not exists material text;
