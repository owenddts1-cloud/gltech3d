-- 0056_ml_foundations
-- Estende print_jobs com colunas de estimativa (tempo/peso) para cálculo de drift,
-- e cria tabela de histórico de custo de filamento (append-only) para detecção de
-- anomalias financeiras. Views analíticas derivadas para pipeline de ML.
-- Tenant-scoped + RLS + audit. Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) PRINT JOBS — colunas de estimativa para Print Time Drift
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.print_jobs
  add column if not exists product_id uuid references public.products(id) on delete set null;

alter table public.print_jobs
  add column if not exists estimated_time_seconds integer;

alter table public.print_jobs
  add column if not exists estimated_weight_grams numeric;

create index if not exists print_jobs_org_product_idx
  on public.print_jobs (organization_id, product_id) where product_id is not null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) VIEW de drift — features calculadas para ML
-- ═══════════════════════════════════════════════════════════════════════════════
-- time_drift_ratio = t_real / t_estimado (>1 = imprimiu mais lento que esperado)
-- weight_err_pct = (peso_real - peso_estimado) / peso_estimado
-- Feature engineering para GradientBoosting:
--   label: is_anomalous = time_drift_ratio > μ + 2σ por (printer, material)
--   features: [filament_grams, material, printer_id, volume_cm3, print_hours_est]

create or replace view public.v_print_drift as
select
  pj.id,
  pj.organization_id,
  pj.product_id,
  pj.printer_client_id,
  pj.printer_name,
  pj.filament_client_id,
  pj.filament_name,
  pj.filename,
  pj.completed_at,
  pj.estimated_time_seconds,
  pj.print_time_seconds as actual_time_seconds,
  pj.estimated_weight_grams,
  pj.weight_grams as actual_weight_grams,
  -- Feature: drift ratio de tempo
  case when coalesce(pj.estimated_time_seconds, 0) > 0
       then round(pj.print_time_seconds::numeric / pj.estimated_time_seconds, 4)
  end as time_drift_ratio,
  -- Feature: erro relativo de peso/material
  case when coalesce(pj.estimated_weight_grams, 0) > 0
       then round(
         (pj.weight_grams - pj.estimated_weight_grams) / pj.estimated_weight_grams,
       4)
  end as weight_err_pct,
  -- Custos reais registrados no job
  pj.material_cost,
  pj.energy_cost,
  pj.depreciation_cost,
  pj.total_cost
from public.print_jobs pj;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) FILAMENT COST HISTORY — trilha append-only de custo por grama
-- ═══════════════════════════════════════════════════════════════════════════════
-- Resolve: filaments.cost_per_gram é mutável e não tinha histórico.
-- Permite detecção de anomalia via Z-score e EWMA:
--   z = (preço_t − μ_janela) / σ_janela; alerta se |z| > 3
--   EWMA: S_t = α·preço_t + (1−α)·S_{t−1}, α ≈ 0.3

create table if not exists public.filament_cost_history (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  filament_id     uuid not null references public.filaments(id) on delete cascade,
  cost_per_gram   numeric not null check (cost_per_gram >= 0),
  recorded_at     timestamptz not null default now()
);
create index if not exists filament_cost_hist_idx
  on public.filament_cost_history (organization_id, filament_id, recorded_at desc);

alter table public.filament_cost_history enable row level security;
drop policy if exists tenant_isolation_filament_cost_history_all on public.filament_cost_history;
create policy tenant_isolation_filament_cost_history_all on public.filament_cost_history
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.filament_cost_history from anon;

drop trigger if exists trg_filament_cost_history_audit on public.filament_cost_history;
create trigger trg_filament_cost_history_audit
  after insert or update or delete on public.filament_cost_history
  for each row execute function public.fn_audit_log_row();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) TRIGGER — snapshot automático a cada mudança de custo no filamento
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_snapshot_filament_cost() returns trigger
language plpgsql security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'INSERT' or old.cost_per_gram is distinct from new.cost_per_gram then
    insert into public.filament_cost_history (organization_id, filament_id, cost_per_gram)
    values (new.organization_id, new.id, new.cost_per_gram);
  end if;
  return new;
end $$;

drop trigger if exists trg_filament_cost_hist on public.filaments;
create trigger trg_filament_cost_hist
  after insert or update of cost_per_gram on public.filaments
  for each row execute function public.fn_snapshot_filament_cost();

-- Backfill: snapshot estado atual dos 5 filamentos existentes
insert into public.filament_cost_history (organization_id, filament_id, cost_per_gram)
select organization_id, id, cost_per_gram
from public.filaments
where cost_per_gram is not null and cost_per_gram > 0
on conflict do nothing;
