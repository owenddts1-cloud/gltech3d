-- 0032_print_jobs_service_order
-- Vincula uma impressão (print_jobs) à Ordem de Serviço que a originou.
-- FK nullable com on delete set null (apagar a OS não apaga o histórico de job).
-- Idempotent — safe to re-apply.

alter table public.print_jobs
  add column if not exists service_order_id uuid
  references public.service_orders(id) on delete set null;

create index if not exists print_jobs_org_service_order_idx
  on public.print_jobs (organization_id, service_order_id);
