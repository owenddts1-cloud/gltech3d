-- 0058_sales_fulfillment_payment
-- Vendas (marketplace_orders) ganham DOIS eixos separados, espelhando o board de
-- produção do CRM de referência: `fulfillment_status` (esteira Confirmada →
-- Produzindo → Pronta → Enviada → Entregue) e `payment_status` (Pendente / Pago /
-- Estornado). O `status` legado (0048) continua intacto para backward-compat e é a
-- FONTE do backfill — nenhum dado é perdido nem sobrescrito em re-aplicação.
-- `board_position` (numeric, fractional indexing) ordena os cards dentro da coluna
-- do Kanban.
--
-- Aditivo e idempotente — safe to re-apply.

alter table public.marketplace_orders
  add column if not exists fulfillment_status text not null default 'confirmada',
  add column if not exists payment_status     text not null default 'pendente',
  add column if not exists board_position     numeric;

-- Backfill a partir do status legado. Só toca linhas ainda nos defaults, para ser
-- re-aplicável sem clobberar edições manuais feitas depois da 1ª aplicação.
update public.marketplace_orders set
  fulfillment_status = case status
    when 'cancelado' then 'cancelada'
    when 'enviado'   then 'enviada'
    when 'concluido' then 'entregue'
    else 'confirmada' end,
  payment_status = case status
    when 'pago'      then 'pago'
    when 'enviado'   then 'pago'
    when 'concluido' then 'pago'
    else 'pendente' end
where fulfillment_status = 'confirmada' and payment_status = 'pendente';

-- Checks criados DEPOIS do backfill (auto-cura clones com dados legados).
alter table public.marketplace_orders drop constraint if exists marketplace_orders_fulfillment_check;
alter table public.marketplace_orders add constraint marketplace_orders_fulfillment_check
  check (fulfillment_status in ('confirmada', 'produzindo', 'pronta', 'enviada', 'entregue', 'cancelada'));

alter table public.marketplace_orders drop constraint if exists marketplace_orders_payment_check;
alter table public.marketplace_orders add constraint marketplace_orders_payment_check
  check (payment_status in ('pendente', 'pago', 'estornado'));

-- Índices para o Kanban (agrupar por estágio) e o alerta de pagamentos pendentes.
create index if not exists marketplace_orders_org_fulfillment_idx
  on public.marketplace_orders (organization_id, fulfillment_status, sold_at desc);
create index if not exists marketplace_orders_org_payment_pending_idx
  on public.marketplace_orders (organization_id, payment_status) where payment_status <> 'pago';
