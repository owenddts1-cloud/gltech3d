-- 0043_service_orders_concluded_at
-- `service_orders.concluded_at`: quando a ordem foi de fato concluída.
--
-- POR QUÊ: o gráfico "Fluxo de ordens de serviço" do Dashboard precisa saber em
-- que dia cada O.S. fechou. Sem esta coluna ele usava `updated_at`, que muda a
-- cada edição — reabrir uma O.S. antiga para corrigir um telefone a fazia
-- reaparecer como "concluída hoje". O gráfico não quebrava: mostrava o número
-- errado com cara de certo, que é pior.
--
-- Mantida por trigger, não pela aplicação: qualquer caminho que mude o status
-- (UI, script, SQL manual) carimba a data sozinho.
--
-- Idempotent — safe to re-apply.

alter table public.service_orders
  add column if not exists concluded_at timestamptz;

comment on column public.service_orders.concluded_at is
  'Momento em que status virou "concluido". Null enquanto não concluída.
   Mantida por trg_service_orders_concluded_at — não escreva na mão.';

-- Backfill: para as já concluídas, `updated_at` é a melhor aproximação que
-- existe (o dado exato não foi guardado). Só onde ainda está nulo, para
-- re-aplicar não sobrescrever data já correta.
update public.service_orders
set concluded_at = updated_at
where status = 'concluido' and concluded_at is null;

create index if not exists service_orders_org_concluded_idx
  on public.service_orders (organization_id, concluded_at)
  where concluded_at is not null;

-- Carimba na transição para 'concluido' e limpa se a ordem for reaberta.
create or replace function public.fn_service_orders_stamp_concluded()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.status = 'concluido' and coalesce(old.status, '') is distinct from 'concluido' then
    new.concluded_at := coalesce(new.concluded_at, now());
  elsif new.status <> 'concluido' then
    -- Reabriu: a data anterior deixaria a O.S. contada como concluída no
    -- período em que não está mais.
    new.concluded_at := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_service_orders_concluded_at on public.service_orders;
create trigger trg_service_orders_concluded_at
  before insert or update of status on public.service_orders
  for each row execute function public.fn_service_orders_stamp_concluded();
