-- 0060_marketplace_orders_contact_id
-- Vendas ganham um FK real para contacts, espelhando service_orders.contact_id.
-- Antes só existia customer_name (texto livre) — anti-pattern #4 do CLAUDE.md
-- ("FK ausente que vira inferência por nome"). customer_name é mantido (snapshot
-- de exibição), mas o vínculo canônico passa a ser contact_id.
--
-- Aditivo e idempotente — safe to re-apply. Não altera dados existentes.

alter table public.marketplace_orders
  add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists marketplace_orders_org_contact_idx
  on public.marketplace_orders (organization_id, contact_id) where contact_id is not null;
