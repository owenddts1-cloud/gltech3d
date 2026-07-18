-- 0057_analytics_rollups
-- Materialized view de vendas diárias + pg_cron para refresh noturno + views de
-- agregação por período (semana/mês/trimestre/ano). Elimina query overhead nos
-- relatórios do dashboard (lê ~365 linhas/ano em vez de milhares de pedidos).
-- Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) MATERIALIZED VIEW — vendas diárias por organização
-- ═══════════════════════════════════════════════════════════════════════════════
create materialized view if not exists public.mv_sales_daily as
select
  organization_id,
  date_trunc('day', sold_at)::date as day,
  count(*)                         as orders,
  sum(total_cents)                 as revenue_cents,
  sum(commission_cents)            as commission_cents
from public.marketplace_orders
group by 1, 2;

-- Unique index permite REFRESH CONCURRENTLY (sem lock exclusivo)
create unique index if not exists mv_sales_daily_pk
  on public.mv_sales_daily (organization_id, day);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) PG_CRON — refresh noturno (03:17 UTC, fora do minuto cheio)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Idempotente: remove job anterior se existir, depois recria
do $cron$
begin
  if to_regnamespace('cron') is not null then
    begin
      execute 'select cron.unschedule(''refresh_sales_daily'')';
    exception when others then
      null;
    end;
    begin
      execute 'select cron.schedule(''refresh_sales_daily'', ''17 3 * * *'', ''refresh materialized view concurrently public.mv_sales_daily'')';
    exception when others then
      null;
    end;
  end if;
end
$cron$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) VIEWS de agregação por período — leem da matview (barato)
-- ═══════════════════════════════════════════════════════════════════════════════
-- Dashboard chama: SELECT * FROM v_sales_by_period WHERE organization_id = $1 AND grain = 'month'
-- Semestre: PG não tem date_trunc('semester'), faço na view com lógica de semestre.

create or replace view public.v_sales_by_period as
-- Semanal
select organization_id,
       'week'::text as grain,
       date_trunc('week', day)::date as bucket,
       sum(orders) as orders,
       sum(revenue_cents) as revenue_cents,
       sum(commission_cents) as commission_cents
from public.mv_sales_daily group by 1, 3

union all
-- Mensal
select organization_id,
       'month'::text,
       date_trunc('month', day)::date,
       sum(orders), sum(revenue_cents), sum(commission_cents)
from public.mv_sales_daily group by 1, 3

union all
-- Trimestral
select organization_id,
       'quarter'::text,
       date_trunc('quarter', day)::date,
       sum(orders), sum(revenue_cents), sum(commission_cents)
from public.mv_sales_daily group by 1, 3

union all
-- Semestral (date_trunc('year') + offset se mês > 6)
select organization_id,
       'semester'::text,
       (date_trunc('year', day) + interval '6 months' * floor((extract(month from day) - 1) / 6))::date,
       sum(orders), sum(revenue_cents), sum(commission_cents)
from public.mv_sales_daily group by 1, 3

union all
-- Anual
select organization_id,
       'year'::text,
       date_trunc('year', day)::date,
       sum(orders), sum(revenue_cents), sum(commission_cents)
from public.mv_sales_daily group by 1, 3;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) MATERIALIZED VIEW — custos de print jobs diários (para dashboards de manufatura)
-- ═══════════════════════════════════════════════════════════════════════════════
create materialized view if not exists public.mv_print_costs_daily as
select
  organization_id,
  date_trunc('day', completed_at)::date as day,
  count(*)                              as jobs,
  sum(print_time_seconds)               as total_print_seconds,
  sum(weight_grams)                     as total_weight_grams,
  sum(material_cost)                    as total_material_cost,
  sum(energy_cost)                      as total_energy_cost,
  sum(total_cost)                       as total_cost
from public.print_jobs
where completed_at is not null
group by 1, 2;

create unique index if not exists mv_print_costs_daily_pk
  on public.mv_print_costs_daily (organization_id, day);

-- Refresh noturno (03:22 UTC, 5 min após vendas)
do $cron$
begin
  if to_regnamespace('cron') is not null then
    begin
      execute 'select cron.unschedule(''refresh_print_costs_daily'')';
    exception when others then
      null;
    end;
    begin
      execute 'select cron.schedule(''refresh_print_costs_daily'', ''22 3 * * *'', ''refresh materialized view concurrently public.mv_print_costs_daily'')';
    exception when others then
      null;
    end;
  end if;
end
$cron$;
