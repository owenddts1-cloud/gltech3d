-- 0087 — filament catalog on products, public site orders, platform settings
--
-- WHAT / WHY
--   1. `products.kind` ('peca' | 'filamento'). Filament spools FOR SALE are
--      products: they reuse what a product already has — photos, slug, publish
--      flag, manual sort order, price, stock and the sales-delta stock trigger
--      of migration 0072. DIRC: they do NOT go to `filaments`, which is the
--      print-farm STOCK consumed by the printer webhook and by the cost
--      calculator; mixing "what I sell" with "what my printers burn" would make
--      a sale decrement the calculator's inventory (and vice versa).
--      Default 'peca' = every existing row keeps meaning what it meant.
--      `kind` is IMMUTABLE after insert (BEFORE UPDATE OF kind trigger, 23514,
--      for every role): flipping a filament into a piece would orphan its specs.
--   2. `product_filament_specs`: 1:1 extension of a product of kind
--      'filamento' (material, line, brand, color, diameter, weight,
--      temperatures, TDS link, availability). A side table and not 14 nullable
--      columns on `products`, because only one kind uses them. A BEFORE trigger
--      refuses (23514) a row whose organization differs from the product's, a
--      product that is not 'filamento', or a material of another org. It is
--      SECURITY DEFINER so the lookup is authoritative (not narrowed by the
--      caller's RLS): a member of org A cannot attach specs to org B's product
--      by declaring organization_id = A.
--      RLS as in 0084: member SELECT/INSERT/UPDATE, DELETE manager+ or
--      platform admin. No anon policy — the public site reads with the service
--      role and an explicit column allowlist.
--   3. `site_orders` + `site_order_items`: the cart sent from the public site
--      (filament or product storefront). Separate from `marketplace_orders`
--      because a cart is ONE customer request with N items and a status of its
--      own (novo/confirmado/cancelado), while a marketplace order is one row
--      per product sold and drives the stock trigger. Converting a cart into
--      sales is an explicit step (`converted_at`). Items snapshot name and
--      unit price (the product can change or be deleted later: product_id
--      becomes NULL, history stays).
--      RLS: member SELECT; UPDATE agent+; DELETE manager+; platform admin
--      also updates/deletes. NO insert policy and NO insert grant for
--      anon/authenticated: rows come only from the public API using the
--      service role (rate limited, Zod-validated, price resolved on the
--      server). UPDATE is granted only on (status, notes), and a BEFORE UPDATE
--      trigger refuses (23514) any change to converted_at / total_cents /
--      customer_* / source / organization_id by a non-service-role JWT — so
--      nobody re-opens a converted cart and converts it twice (duplicate sales,
--      double stock decrement). Conversion runs on the server with the service
--      role. A trigger keeps item.organization_id = order.organization_id and
--      refuses a product of another org.
--   4. `platform_settings`: ONE row (id = 1, CHECK) with PRO price/period,
--      trial length, PRO benefits list and calculator defaults. Platform level,
--      not tenant: no organization_id. Readable by anon (public prices on the
--      landing/checkout). NO write grant/policy for anon/authenticated: the
--      only writer is the admin API route (service role) after it checks
--      platform admin + MFA. fn_is_platform_admin() ignores the AAL, so an RLS
--      write policy would let a platform-admin session without MFA edit prices
--      through PostgREST.
--
--   AUDIT: row audit (fn_audit_log_row) on site_orders and on DELETE of
--   site_order_items. NOT on product_filament_specs nor platform_settings:
--   fn_audit_log_row reads NEW.id / NEW.organization_id and those tables have
--   neither (specs is keyed by product_id; settings is platform level). Their
--   mutations are audited by the API route that performs them.
--
-- Idempotent: add column / create ... if not exists, drop ... if exists before
-- create, constraints via drop/add or DO block, seed with on conflict do
-- nothing. No BEGIN/COMMIT (the runner wraps it).

-- 1. products.kind -----------------------------------------------------------
alter table public.products
  add column if not exists kind text not null default 'peca';

-- Self-healing for a clone that already had a `kind` column with other values.
update public.products set kind = 'peca' where kind is null or kind not in ('peca', 'filamento');

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'products_kind_check' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_kind_check check (kind in ('peca', 'filamento'));
  end if;
end $$;

create index if not exists products_org_kind_published_idx
  on public.products (organization_id, kind, is_published, sort_order);

comment on column public.products.kind is
  'peca = 3D printed piece; filamento = filament spool for sale (specs in product_filament_specs). Immutable after insert. Migration 0087.';

-- `kind` is fixed at creation, for everyone (service role included): flipping a
-- filament into a piece would orphan its specs and move it between storefronts.
-- Created AFTER the self-healing update above, so that update still runs on a
-- dirty clone; once healed it matches 0 rows and the trigger never fires on it.
create or replace function public.fn_products_kind_immutable()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.kind is distinct from old.kind then
    raise exception 'products.kind is immutable (% -> %)', old.kind, new.kind
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_products_kind_immutable on public.products;
create trigger trg_products_kind_immutable
  before update of kind on public.products
  for each row execute function public.fn_products_kind_immutable();

-- 2. product_filament_specs --------------------------------------------------
create table if not exists public.product_filament_specs (
  product_id      uuid primary key references public.products(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  material_id     uuid references public.materials(id) on delete set null,
  line            text,
  brand           text,
  color_name      text,
  color_hex       text,
  diameter_mm     numeric(4,2) not null default 1.75,
  net_weight_g    integer,
  nozzle_temp_min integer,
  nozzle_temp_max integer,
  bed_temp_min    integer,
  bed_temp_max    integer,
  notes           text,
  tds_url         text,
  availability    text not null default 'em_estoque',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.product_filament_specs drop constraint if exists product_filament_specs_line_len;
alter table public.product_filament_specs add constraint product_filament_specs_line_len
  check (char_length(line) <= 40);
alter table public.product_filament_specs drop constraint if exists product_filament_specs_brand_len;
alter table public.product_filament_specs add constraint product_filament_specs_brand_len
  check (char_length(brand) <= 60);
alter table public.product_filament_specs drop constraint if exists product_filament_specs_color_name_len;
alter table public.product_filament_specs add constraint product_filament_specs_color_name_len
  check (char_length(color_name) <= 40);
alter table public.product_filament_specs drop constraint if exists product_filament_specs_color_hex_format;
alter table public.product_filament_specs add constraint product_filament_specs_color_hex_format
  check (color_hex ~ '^#[0-9A-Fa-f]{6}$');
alter table public.product_filament_specs drop constraint if exists product_filament_specs_diameter;
alter table public.product_filament_specs add constraint product_filament_specs_diameter
  check (diameter_mm in (1.75, 2.85));
alter table public.product_filament_specs drop constraint if exists product_filament_specs_net_weight;
alter table public.product_filament_specs add constraint product_filament_specs_net_weight
  check (net_weight_g between 1 and 100000);
alter table public.product_filament_specs drop constraint if exists product_filament_specs_temps_range;
alter table public.product_filament_specs add constraint product_filament_specs_temps_range
  check (
    (nozzle_temp_min is null or nozzle_temp_min between 0 and 500)
    and (nozzle_temp_max is null or nozzle_temp_max between 0 and 500)
    and (bed_temp_min is null or bed_temp_min between 0 and 500)
    and (bed_temp_max is null or bed_temp_max between 0 and 500)
  );
alter table public.product_filament_specs drop constraint if exists product_filament_specs_temps_order;
alter table public.product_filament_specs add constraint product_filament_specs_temps_order
  check (
    (nozzle_temp_min is null or nozzle_temp_max is null or nozzle_temp_min <= nozzle_temp_max)
    and (bed_temp_min is null or bed_temp_max is null or bed_temp_min <= bed_temp_max)
  );
alter table public.product_filament_specs drop constraint if exists product_filament_specs_notes_len;
alter table public.product_filament_specs add constraint product_filament_specs_notes_len
  check (char_length(notes) <= 2000);
alter table public.product_filament_specs drop constraint if exists product_filament_specs_tds_url_https;
alter table public.product_filament_specs add constraint product_filament_specs_tds_url_https
  check (tds_url ~ '^https://');
alter table public.product_filament_specs drop constraint if exists product_filament_specs_availability;
alter table public.product_filament_specs add constraint product_filament_specs_availability
  check (availability in ('em_estoque', 'ultimas_unidades', 'sob_encomenda', 'esgotado'));

create index if not exists product_filament_specs_org_idx
  on public.product_filament_specs (organization_id);
create index if not exists product_filament_specs_material_idx
  on public.product_filament_specs (material_id)
  where material_id is not null;

alter table public.product_filament_specs enable row level security;

drop policy if exists tenant_isolation_product_filament_specs_select on public.product_filament_specs;
create policy tenant_isolation_product_filament_specs_select on public.product_filament_specs
  for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_product_filament_specs_insert on public.product_filament_specs;
create policy tenant_isolation_product_filament_specs_insert on public.product_filament_specs
  for insert with check (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_product_filament_specs_update on public.product_filament_specs;
create policy tenant_isolation_product_filament_specs_update on public.product_filament_specs
  for update using (organization_id in (select public.fn_user_org_ids()))
  with check (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_product_filament_specs_delete on public.product_filament_specs;
create policy tenant_isolation_product_filament_specs_delete on public.product_filament_specs
  for delete using (public.fn_role_at_least(organization_id, 'manager') or public.fn_is_platform_admin());

revoke all on public.product_filament_specs from anon;
grant select, insert, update, delete on public.product_filament_specs to authenticated;
grant all on public.product_filament_specs to service_role;

drop trigger if exists trg_product_filament_specs_updated_at on public.product_filament_specs;
create trigger trg_product_filament_specs_updated_at
  before update on public.product_filament_specs
  for each row execute function public.fn_set_updated_at();

-- Integrity: the specs belong to a 'filamento' product of the SAME org, and the
-- material (if any) is of that org too. SECURITY DEFINER so the lookup sees the
-- real row, not what the caller's RLS lets it see. One message for "missing"
-- and "other org" so the error does not confirm another tenant's product id.
create or replace function public.fn_product_filament_specs_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org  uuid;
  v_kind text;
begin
  select p.organization_id, p.kind into v_org, v_kind
    from public.products p
   where p.id = new.product_id;

  if v_org is null or v_org <> new.organization_id then
    raise exception 'product_filament_specs: product % is not a product of organization %',
      new.product_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  if v_kind is distinct from 'filamento' then
    raise exception 'product_filament_specs: product % has kind %, expected filamento',
      new.product_id, v_kind
      using errcode = 'check_violation';
  end if;

  if new.material_id is not null and not exists (
    select 1 from public.materials m
     where m.id = new.material_id and m.organization_id = new.organization_id
  ) then
    raise exception 'product_filament_specs: material % is not a material of organization %',
      new.material_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

revoke all on function public.fn_product_filament_specs_guard() from public, anon, authenticated;

drop trigger if exists trg_product_filament_specs_guard on public.product_filament_specs;
create trigger trg_product_filament_specs_guard
  before insert or update of product_id, organization_id, material_id on public.product_filament_specs
  for each row execute function public.fn_product_filament_specs_guard();

comment on table public.product_filament_specs is
  '1:1 technical sheet of a product of kind filamento (filament for SALE). Print-farm stock stays in public.filaments. Migration 0087.';

-- 3. site_orders / site_order_items ------------------------------------------
create table if not exists public.site_orders (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  customer_name     text not null,
  customer_whatsapp text not null,
  status            text not null default 'novo',
  total_cents       bigint not null default 0,
  source            text not null default 'site_filamentos',
  notes             text,
  converted_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.site_orders drop constraint if exists site_orders_customer_name_len;
alter table public.site_orders add constraint site_orders_customer_name_len
  check (char_length(customer_name) between 2 and 120);
alter table public.site_orders drop constraint if exists site_orders_customer_whatsapp_digits;
alter table public.site_orders add constraint site_orders_customer_whatsapp_digits
  check (customer_whatsapp ~ '^[0-9]{10,13}$');
alter table public.site_orders drop constraint if exists site_orders_status_check;
alter table public.site_orders add constraint site_orders_status_check
  check (status in ('novo', 'confirmado', 'cancelado'));
alter table public.site_orders drop constraint if exists site_orders_total_nonneg;
alter table public.site_orders add constraint site_orders_total_nonneg
  check (total_cents >= 0);
alter table public.site_orders drop constraint if exists site_orders_source_check;
alter table public.site_orders add constraint site_orders_source_check
  check (source in ('site_filamentos', 'site_produtos'));
alter table public.site_orders drop constraint if exists site_orders_notes_len;
alter table public.site_orders add constraint site_orders_notes_len
  check (char_length(notes) <= 1000);

create index if not exists site_orders_org_status_created_idx
  on public.site_orders (organization_id, status, created_at desc);

create table if not exists public.site_order_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  site_order_id    uuid not null references public.site_orders(id) on delete cascade,
  product_id       uuid references public.products(id) on delete set null,
  product_name     text not null,
  qty              integer not null,
  unit_price_cents bigint not null
);

alter table public.site_order_items drop constraint if exists site_order_items_product_name_len;
alter table public.site_order_items add constraint site_order_items_product_name_len
  check (char_length(product_name) <= 200);
alter table public.site_order_items drop constraint if exists site_order_items_qty_range;
alter table public.site_order_items add constraint site_order_items_qty_range
  check (qty between 1 and 999);
alter table public.site_order_items drop constraint if exists site_order_items_unit_price_nonneg;
alter table public.site_order_items add constraint site_order_items_unit_price_nonneg
  check (unit_price_cents >= 0);

create index if not exists site_order_items_order_idx
  on public.site_order_items (site_order_id);
create index if not exists site_order_items_org_idx
  on public.site_order_items (organization_id);
create index if not exists site_order_items_product_idx
  on public.site_order_items (product_id)
  where product_id is not null;

alter table public.site_orders enable row level security;
alter table public.site_order_items enable row level security;

-- No INSERT policy on purpose: rows come only from the public API (service role).
drop policy if exists tenant_isolation_site_orders_select on public.site_orders;
create policy tenant_isolation_site_orders_select on public.site_orders
  for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_site_orders_update on public.site_orders;
create policy tenant_isolation_site_orders_update on public.site_orders
  for update using (public.fn_role_at_least(organization_id, 'agent') or public.fn_is_platform_admin())
  with check (public.fn_role_at_least(organization_id, 'agent') or public.fn_is_platform_admin());
drop policy if exists tenant_isolation_site_orders_delete on public.site_orders;
create policy tenant_isolation_site_orders_delete on public.site_orders
  for delete using (public.fn_role_at_least(organization_id, 'manager') or public.fn_is_platform_admin());

drop policy if exists tenant_isolation_site_order_items_select on public.site_order_items;
create policy tenant_isolation_site_order_items_select on public.site_order_items
  for select using (organization_id in (select public.fn_user_org_ids()));
drop policy if exists tenant_isolation_site_order_items_delete on public.site_order_items;
create policy tenant_isolation_site_order_items_delete on public.site_order_items
  for delete using (public.fn_role_at_least(organization_id, 'manager') or public.fn_is_platform_admin());

-- Privilege layer matches the policies: no INSERT for anon/authenticated even
-- if a permissive policy is added later by mistake. UPDATE is COLUMN-LEVEL
-- (status, notes): a table-wide grant would let an agent PATCH converted_at
-- back to null (or total_cents / customer_*) through PostgREST and convert the
-- cart again — duplicate sales and a double stock decrement. Converting
-- (setting converted_at) is a server step with the service role.
revoke all on public.site_orders from anon, authenticated;
grant select, delete on public.site_orders to authenticated;
grant update (status, notes) on public.site_orders to authenticated;
grant all on public.site_orders to service_role;
revoke all on public.site_order_items from anon, authenticated;
grant select, delete on public.site_order_items to authenticated;
grant all on public.site_order_items to service_role;

drop trigger if exists trg_site_orders_updated_at on public.site_orders;
create trigger trg_site_orders_updated_at
  before update on public.site_orders
  for each row execute function public.fn_set_updated_at();

-- Defense in depth behind the column grant (a future `grant update` on the
-- whole table must not reopen the hole). A PostgREST caller that is not the
-- service role cannot change converted_at (nor clear it), the total, the
-- customer, the source or the org. Trusted = same detection as
-- fn_assert_org_access (0083): no JWT (psql, pg_cron, migrations) or JWT role
-- service_role. The server's revert of a failed conversion (converted_at back
-- to null) runs with the service role and stays possible.
create or replace function public.fn_site_orders_guard_update()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
  v_role   text := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    case when v_claims is not null then v_claims::jsonb ->> 'role' end
  );
begin
  if v_role is null or v_role = 'service_role' then
    return new;
  end if;

  if old.converted_at is not null and new.converted_at is null then
    raise exception 'site_orders: converted_at cannot be cleared'
      using errcode = 'check_violation';
  end if;

  if new.converted_at is distinct from old.converted_at
     or new.total_cents is distinct from old.total_cents
     or new.customer_name is distinct from old.customer_name
     or new.customer_whatsapp is distinct from old.customer_whatsapp
     or new.organization_id is distinct from old.organization_id
     or new.source is distinct from old.source then
    raise exception 'site_orders: only status and notes are editable here'
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_site_orders_guard_update on public.site_orders;
create trigger trg_site_orders_guard_update
  before update on public.site_orders
  for each row execute function public.fn_site_orders_guard_update();

-- Integrity: item.organization_id = order.organization_id, and the product (if
-- any) belongs to that org. SECURITY DEFINER for an authoritative lookup.
create or replace function public.fn_site_order_items_guard()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_org uuid;
begin
  select o.organization_id into v_org
    from public.site_orders o
   where o.id = new.site_order_id;

  if v_org is null or v_org <> new.organization_id then
    raise exception 'site_order_items: order % is not an order of organization %',
      new.site_order_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  if new.product_id is not null and not exists (
    select 1 from public.products p
     where p.id = new.product_id and p.organization_id = new.organization_id
  ) then
    raise exception 'site_order_items: product % is not a product of organization %',
      new.product_id, new.organization_id
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

revoke all on function public.fn_site_order_items_guard() from public, anon, authenticated;

drop trigger if exists trg_site_order_items_guard on public.site_order_items;
create trigger trg_site_order_items_guard
  before insert or update of organization_id, site_order_id, product_id on public.site_order_items
  for each row execute function public.fn_site_order_items_guard();

drop trigger if exists trg_site_orders_audit on public.site_orders;
create trigger trg_site_orders_audit
  after insert or update or delete on public.site_orders
  for each row execute function public.fn_audit_log_row();

drop trigger if exists trg_site_order_items_audit on public.site_order_items;
create trigger trg_site_order_items_audit
  after delete on public.site_order_items
  for each row execute function public.fn_audit_log_row();

comment on table public.site_orders is
  'Cart sent from the public site (one customer request, N items). Inserted only by the public API (service role). Not a sale: see marketplace_orders. Migration 0087.';
comment on table public.site_order_items is
  'Items of a site_orders cart. product_name/unit_price_cents are snapshots; product_id becomes NULL if the product is deleted. Migration 0087.';

-- 4. platform_settings -------------------------------------------------------
create table if not exists public.platform_settings (
  id                  smallint primary key default 1,
  pro_price_cents     integer not null default 8900,
  pro_period_days     integer not null default 365,
  trial_days          integer not null default 7,
  pro_benefits        jsonb not null default '[]'::jsonb,
  calculator_defaults jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now(),
  updated_by          uuid references auth.users(id) on delete set null
);

alter table public.platform_settings drop constraint if exists platform_settings_single_row;
alter table public.platform_settings add constraint platform_settings_single_row
  check (id = 1);
alter table public.platform_settings drop constraint if exists platform_settings_pro_price_range;
alter table public.platform_settings add constraint platform_settings_pro_price_range
  check (pro_price_cents between 100 and 10000000);
alter table public.platform_settings drop constraint if exists platform_settings_pro_period_range;
alter table public.platform_settings add constraint platform_settings_pro_period_range
  check (pro_period_days between 1 and 3650);
alter table public.platform_settings drop constraint if exists platform_settings_trial_days_range;
alter table public.platform_settings add constraint platform_settings_trial_days_range
  check (trial_days between 0 and 90);
alter table public.platform_settings drop constraint if exists platform_settings_pro_benefits_array;
alter table public.platform_settings add constraint platform_settings_pro_benefits_array
  check (jsonb_typeof(pro_benefits) = 'array');
alter table public.platform_settings drop constraint if exists platform_settings_calculator_defaults_object;
alter table public.platform_settings add constraint platform_settings_calculator_defaults_object
  check (jsonb_typeof(calculator_defaults) = 'object');

insert into public.platform_settings (id) values (1) on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

drop policy if exists platform_settings_select on public.platform_settings;
create policy platform_settings_select on public.platform_settings
  for select to anon, authenticated using (true);
-- NO write policy and NO write grant for anon/authenticated. Writes happen only
-- in app/api/v1/admin/platform-settings (service role) AFTER that route checks
-- platform admin + MFA (aal2). fn_is_platform_admin() does not look at the AAL,
-- so a write policy here would let a platform-admin session WITHOUT MFA change
-- the PRO price straight through PostgREST. The drops clean up a database that
-- ran an earlier draft of this migration.
drop policy if exists platform_settings_insert on public.platform_settings;
drop policy if exists platform_settings_update on public.platform_settings;
drop policy if exists platform_settings_delete on public.platform_settings;

revoke all on public.platform_settings from anon, authenticated;
grant select on public.platform_settings to anon, authenticated;
grant all on public.platform_settings to service_role;

drop trigger if exists trg_platform_settings_updated_at on public.platform_settings;
create trigger trg_platform_settings_updated_at
  before update on public.platform_settings
  for each row execute function public.fn_set_updated_at();

comment on table public.platform_settings is
  'Single row (id = 1) of PLATFORM settings: PRO price/period, trial days, PRO benefits, calculator defaults. Public read; platform admin write. Migration 0087.';
