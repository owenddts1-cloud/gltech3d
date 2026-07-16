-- 0039_printers_hours_used
-- Horímetro da impressora: horas já rodadas pela máquina.
--
-- Motivo: o cadastro de impressoras não tinha onde guardar o uso acumulado ("a Bambulab A1
-- está com 1217H"). Não dá pra derivar de print_jobs.print_time_seconds — aquilo só soma o
-- que o CRM registrou, e uma máquina chega usada, com horas anteriores ao sistema.
--
-- Fica separado de printers.depreciation_per_hour (custo por hora, já existente) e do
-- vidaUtil da calculadora (vida útil total esperada). Este campo é o odômetro.
--
-- Idempotente — safe to re-apply.

alter table public.printers
  add column if not exists hours_used numeric not null default 0
  check (hours_used >= 0);

comment on column public.printers.hours_used is
  'Horas acumuladas de impressão da máquina, incluindo uso anterior ao cadastro no CRM.';
