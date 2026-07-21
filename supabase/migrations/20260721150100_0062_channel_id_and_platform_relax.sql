-- 0062_channel_id_and_platform_relax
-- Liga service_orders e marketplace_orders a sale_channels (FK nullable, sem
-- backfill — DIRC: não há match confiável 1:1 sem heurística arriscada).
-- Relaxa o CHECK fechado de marketplace_orders.platform (7 valores hardcoded,
-- migration 0048): a validação de "quais canais existem" passa a ser feita por
-- sale_channels + a UI (Combobox com allowCreate), não por um enum fechado no
-- banco — mesma doutrina do repo (type é text, não enum, pra não travar extensão).
-- O texto snapshot `platform` continua existindo e sendo lido por todo o código
-- atual sem mudança de contrato.
-- Idempotent — safe to re-apply.

alter table public.service_orders
  add column if not exists channel_id uuid references public.sale_channels(id) on delete set null;
create index if not exists service_orders_org_channel_idx
  on public.service_orders (organization_id, channel_id) where channel_id is not null;

alter table public.marketplace_orders
  add column if not exists channel_id uuid references public.sale_channels(id) on delete set null;
create index if not exists marketplace_orders_org_channel_idx
  on public.marketplace_orders (organization_id, channel_id) where channel_id is not null;

-- Remove o CHECK fechado original de platform (migration 0048). Nome confirmado
-- por inspeção direta do catálogo (constraint criada inline, sem "constraint
-- <nome>" explícito -> nome auto-gerado pelo Postgres).
alter table public.marketplace_orders
  drop constraint if exists marketplace_orders_platform_check;

-- Fallback defensivo: qualquer outro CHECK fechado sobre platform que reste,
-- resolvido dinamicamente. Postgres normaliza "platform in (...)" para
-- "platform = ANY (ARRAY[...])" ao renderizar via pg_get_constraintdef — o
-- padrão busca por esse formato normalizado, não a sintaxe original.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.marketplace_orders'::regclass
      and contype = 'c'
      and conname <> 'mo_platform_len'
      and pg_get_constraintdef(oid) ilike '%platform%= any%'
  loop
    execute format('alter table public.marketplace_orders drop constraint %I', r.conname);
  end loop;
end $$;

-- Substitui o enum fechado por uma validação frouxa (não-vazio, tamanho razoável).
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'mo_platform_len') then
    alter table public.marketplace_orders
      add constraint mo_platform_len check (char_length(platform) between 1 and 80);
  end if;
end $$;
