-- =============================================================================
-- APLICAR PENDÊNCIA — migration 0048_marketplace_orders
-- =============================================================================
-- Cole no Supabase SQL Editor e clique em "Run". Idempotente, numa transação.
-- =============================================================================

begin;

-- 0048_marketplace_orders
-- Pedidos de marketplace (Vendas) — lançamento manual por plataforma, saindo
-- dos placeholders "Prévia" das abas de Vendas. Sem OAuth: o lojista lança o
-- pedido à mão. A integração automática (webhook Shopee) vem depois e grava
-- nesta mesma tabela.
--
-- `platform` espelha o check de financial_records.platform (migration 0037)
-- para os dois módulos falarem a mesma língua.
--
-- Idempotent — safe to re-apply.

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null
    check (platform in ('B2B', 'Shopee', 'Facebook', 'Mercado Livre', 'TikTok Shop', 'Olx', 'Outro')),
  external_order_id text,                        -- id do pedido no marketplace (nullable no manual)
  customer_name text,
  status text not null default 'pago'
    check (status in ('pendente', 'pago', 'enviado', 'concluido', 'cancelado')),
  total_cents bigint not null default 0 check (total_cents >= 0),
  commission_cents bigint not null default 0 check (commission_cents >= 0),
  sold_at date not null default current_date,
  -- Liga ao fluxo de produção quando o pedido vira uma OS (opcional).
  service_order_id uuid references public.service_orders(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists marketplace_orders_org_idx
  on public.marketplace_orders (organization_id, platform, sold_at desc);

-- Idempotência da integração automática: um pedido externo entra uma vez só.
-- Parcial porque no manual external_order_id é nulo (e nulos não colidem).
create unique index if not exists marketplace_orders_ext_unique
  on public.marketplace_orders (organization_id, platform, external_order_id)
  where external_order_id is not null;

alter table public.marketplace_orders enable row level security;
drop policy if exists tenant_isolation_marketplace_orders_all on public.marketplace_orders;
create policy tenant_isolation_marketplace_orders_all on public.marketplace_orders
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.marketplace_orders from anon;

drop trigger if exists trg_marketplace_orders_audit on public.marketplace_orders;
create trigger trg_marketplace_orders_audit
  after insert or update or delete on public.marketplace_orders
  for each row execute function public.fn_audit_log_row();

commit;

-- CONFERÊNCIA:
--   select relrowsecurity from pg_class where relname = 'marketplace_orders'; -- t
--   select count(*) from pg_trigger where tgname = 'trg_marketplace_orders_audit'; -- 1
