-- 0068_service_order_items_and_documents
--
-- Habilita a emissão de documentos imprimíveis (Orçamento, Ordem de Serviço e
-- Recibo) a partir de cada O.S. Três peças:
--
--   1) `service_order_items` — a O.S. deixa de ser uma linha única (title + qty +
--      total_cents) e passa a ter N itens, cada um opcionalmente ligado a um
--      produto e com foto própria. `service_orders.total_cents`/`qty` passam a
--      ser DERIVADOS da soma dos itens — mas somente quando existe pelo menos um
--      item, para não mexer no histórico de O.S. lançadas à mão.
--
--   2) `service_order_documents` — cada documento emitido vira uma linha com
--      numeração sequencial por (org, tipo, ano) e um `snapshot jsonb` IMUTÁVEL
--      do que foi impresso. É o snapshot que dá valor probatório ao recibo:
--      renomear a empresa ou apagar um produto não altera o que o cliente
--      recebeu.
--
--   3) `contacts` ganha endereço e documento fiscal, que o documento precisa
--      imprimir e que hoje não existem em lugar nenhum do schema.
--
-- Tenant-scoped + RLS + audit em tudo. Idempotent — safe to re-apply.

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1) Pré-requisito: chave composta (id, organization_id) em service_orders
--    As FKs compostas abaixo garantem que um item/documento nunca aponte para
--    uma O.S. de OUTRA organização — defesa de tenancy no próprio banco, além da
--    RLS. Não pode falhar: `id` já é PK, então o par é trivialmente único.
-- ═══════════════════════════════════════════════════════════════════════════════
create unique index if not exists service_orders_id_org_unique
  on public.service_orders (id, organization_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2) CONTACTS — endereço + documento fiscal
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.contacts
  add column if not exists document_number     text,
  add column if not exists address             text,
  add column if not exists address_number      text,
  add column if not exists address_complement  text,
  add column if not exists district            text,
  add column if not exists city                text,
  add column if not exists state               text,
  add column if not exists cep                 text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_state_uf_len') then
    alter table public.contacts
      add constraint contacts_state_uf_len
      check (state is null or char_length(btrim(state)) = 2);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_document_number_len') then
    alter table public.contacts
      add constraint contacts_document_number_len
      check (document_number is null or char_length(document_number) <= 32);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'contacts_cep_len') then
    alter table public.contacts
      add constraint contacts_cep_len
      check (cep is null or char_length(cep) <= 12);
  end if;
end $$;

comment on column public.contacts.document_number is
  'CPF ou CNPJ em texto plano, para imprimir em documento fiscal/comercial. '
  'DIFERENTE de cpf_encrypted (pgcrypto): este é legível por qualquer membro da '
  'org. Preencher apenas quando o cliente precisa constar no documento. '
  'Anulado na anonimização LGPD por trg_contacts_redact_address.';
comment on column public.contacts.state is 'UF com 2 letras (ex.: MG).';

-- ── LGPD: as colunas acima são dado pessoal e PRECISAM morrer na anonimização.
-- Em vez de reescrever as ~200 linhas de fn_lgpd_cascade_redact_contact (0019) e
-- correr o risco de divergir dela, um trigger BEFORE UPDATE cobre QUALQUER
-- caminho que marque o contato como anonimizado — a RPC de hoje e o que vier
-- depois.
create or replace function public.fn_contacts_redact_address() returns trigger
language plpgsql
as $$
begin
  new.document_number    := null;
  new.address            := null;
  new.address_number     := null;
  new.address_complement := null;
  new.district           := null;
  new.city               := null;
  new.state              := null;
  new.cep                := null;
  return new;
end $$;

drop trigger if exists trg_contacts_redact_address on public.contacts;
create trigger trg_contacts_redact_address
  before update on public.contacts
  for each row
  when (new.is_anonymized and not coalesce(old.is_anonymized, false))
  execute function public.fn_contacts_redact_address();

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3) SERVICE_ORDER_ITEMS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.service_order_items (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  service_order_id uuid not null,
  product_id       uuid references public.products(id) on delete set null,
  name             text not null,
  description      text,
  qty              numeric not null default 1,
  unit_price_cents bigint  not null default 0,
  image_url        text,
  sort_order       numeric not null default 0,
  created_by       uuid references auth.users(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint soi_name_len       check (char_length(btrim(name)) between 1 and 300),
  constraint soi_qty_pos        check (qty > 0),
  constraint soi_unit_nonneg    check (unit_price_cents >= 0),
  constraint soi_image_url_len  check (image_url is null or char_length(image_url) <= 2048)
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'service_order_items_so_org_fk') then
    alter table public.service_order_items
      add constraint service_order_items_so_org_fk
      foreign key (service_order_id, organization_id)
      references public.service_orders (id, organization_id) on delete cascade;
  end if;
end $$;

create index if not exists service_order_items_org_so_idx
  on public.service_order_items (organization_id, service_order_id, sort_order);
create index if not exists service_order_items_so_idx
  on public.service_order_items (service_order_id);
create index if not exists service_order_items_product_idx
  on public.service_order_items (organization_id, product_id)
  where product_id is not null;

alter table public.service_order_items enable row level security;
drop policy if exists tenant_isolation_service_order_items_all on public.service_order_items;
create policy tenant_isolation_service_order_items_all on public.service_order_items
  for all
  using      (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.service_order_items from anon;

drop trigger if exists trg_service_order_items_audit on public.service_order_items;
create trigger trg_service_order_items_audit
  after insert or update or delete on public.service_order_items
  for each row execute function public.fn_audit_log_row();

drop trigger if exists trg_service_order_items_updated_at on public.service_order_items;
create trigger trg_service_order_items_updated_at
  before update on public.service_order_items
  for each row execute function public.fn_set_updated_at();

comment on table public.service_order_items is
  'Itens (linhas) de uma O.S. Fonte da verdade de service_orders.total_cents/qty '
  'QUANDO existe ao menos 1 item — ver fn_service_orders_recalc_total. Uma O.S. '
  'com zero itens mantém o total digitado à mão (comportamento legado).';

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4) RECÁLCULO DE service_orders.total_cents A PARTIR DOS ITENS
--
--    Statement-level com transition tables (e não row-level): salvar 8 itens gera
--    UM update em service_orders, não oito. Isso importa porque cada update ali
--    aciona a cascata de sincronização das migrations 0065/0066 para
--    marketplace_orders e financial_records.
--
--    Terminação (analisada contra 0063–0066):
--      • trg_service_orders_concluded_at  (BEFORE UPDATE OF status) — NÃO dispara:
--        nosso SET não lista `status`, e `UPDATE OF col` só dispara se a coluna
--        está no SET.
--      • trg_service_order_auto_sale      (AFTER UPDATE OF status)  — idem, e
--        ainda exigiria new.status='concluido'. Duas barreiras.
--      • trg_service_orders_propagate_edits (AFTER UPDATE OF total_cents, qty…) —
--        DISPARA, e é exatamente o que se quer: o valor novo desce para a Venda e
--        para o Lançamento vinculados.
--      • O eco de volta (marketplace_orders → service_orders) chega com os MESMOS
--        valores, então os WHEN `IS DISTINCT FROM` das 0065/0066 ficam falsos e a
--        cascata morre. Profundidade máxima 3.
--      • Segunda barreira independente: o `IS DISTINCT FROM` no WHERE do nosso
--        próprio UPDATE — se nada mudou, zero linhas afetadas, zero fanout.
--
--    pg_trigger_depth() NÃO é usado como guarda de propósito: mascararia um ciclo
--    futuro em vez de impedi-lo. A asserção abaixo falha alto em vez de silenciar.
-- ═══════════════════════════════════════════════════════════════════════════════
create or replace function public.fn_service_orders_recalc_total() returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_ids uuid[] := '{}';
  v_tmp uuid[] := '{}';
  r     record;
begin
  if pg_trigger_depth() > 4 then
    raise exception 'fn_service_orders_recalc_total: profundidade de trigger inesperada (%)', pg_trigger_depth();
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    select coalesce(array_agg(distinct service_order_id), '{}'::uuid[]) into v_tmp from new_items;
    v_ids := v_ids || v_tmp;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    select coalesce(array_agg(distinct service_order_id), '{}'::uuid[]) into v_tmp from old_items;
    v_ids := v_ids || v_tmp;
  end if;
  if array_length(v_ids, 1) is null then
    return null;
  end if;

  -- Uma O.S. que ficou com ZERO itens simplesmente não aparece no group by →
  -- nenhum UPDATE → o total manual/legado é PRESERVADO. É regra de produto.
  for r in
    select i.service_order_id                                as so_id,
           i.organization_id                                 as org_id,
           coalesce(sum(i.qty * i.unit_price_cents), 0)::bigint as total_cents,
           greatest(coalesce(sum(i.qty), 0), 1)::int         as qty
      from public.service_order_items i
     where i.service_order_id = any (v_ids)
     group by 1, 2
  loop
    update public.service_orders so
       set total_cents = r.total_cents,
           qty         = r.qty,
           updated_at  = now()
     where so.id = r.so_id
       -- SECURITY DEFINER roda sem RLS: filtra a org explicitamente.
       and so.organization_id = r.org_id
       -- Corta o eco: se nada mudou, zero linhas → zero cascata.
       and (so.total_cents is distinct from r.total_cents
         or so.qty         is distinct from r.qty);
  end loop;

  return null;
end $$;

-- Três triggers separadas porque o Postgres recusa transition tables em trigger
-- com mais de um evento ("transition tables cannot be specified for triggers
-- with more than one event").
drop trigger if exists trg_service_order_items_recalc_ins on public.service_order_items;
create trigger trg_service_order_items_recalc_ins
  after insert on public.service_order_items
  referencing new table as new_items
  for each statement execute function public.fn_service_orders_recalc_total();

drop trigger if exists trg_service_order_items_recalc_upd on public.service_order_items;
create trigger trg_service_order_items_recalc_upd
  after update on public.service_order_items
  referencing old table as old_items new table as new_items
  for each statement execute function public.fn_service_orders_recalc_total();

drop trigger if exists trg_service_order_items_recalc_del on public.service_order_items;
create trigger trg_service_order_items_recalc_del
  after delete on public.service_order_items
  referencing old table as old_items
  for each statement execute function public.fn_service_orders_recalc_total();

-- ┌───────────────────────────────────────────────────────────────────────────┐
-- │ ATENÇÃO — NÃO FAZER BACKFILL DE ITENS AQUI.                               │
-- │                                                                           │
-- │ Um `insert into service_order_items select … from service_orders` (1 item  │
-- │ por O.S. legada) dispararia o recálculo acima em massa: um UPDATE em cada  │
-- │ linha de service_orders → cascata das migrations 0065/0066 mutando         │
-- │ marketplace_orders e financial_records HISTÓRICOS de todos os tenants, mais│
-- │ uma explosão de linhas em api_audit_log.                                   │
-- │                                                                           │
-- │ Não é necessário: a regra "O.S. sem itens mantém o total manual" já faz    │
-- │ toda O.S. antiga continuar correta. Os itens nascem quando o usuário abre  │
-- │ o gerador de documentos. BACKFILL = ZERO LINHAS.                           │
-- └───────────────────────────────────────────────────────────────────────────┘

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5) SERVICE_ORDER_DOCUMENTS
-- ═══════════════════════════════════════════════════════════════════════════════
create table if not exists public.service_order_documents (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  service_order_id uuid not null,
  doc_type         text not null,
  doc_year         integer not null default 0,
  seq              integer not null default 0,
  number           text    not null default '',
  snapshot         jsonb   not null,
  total_cents      bigint  not null default 0,
  issued_at        timestamptz not null default now(),
  issued_by        uuid references auth.users(id),
  voided_at        timestamptz,
  void_reason      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint sod_type_known    check (doc_type in ('orcamento', 'ordem_servico', 'recibo')),
  constraint sod_number_len    check (char_length(number) <= 40),
  constraint sod_seq_nonneg    check (seq >= 0),
  constraint sod_year_range    check (doc_year = 0 or doc_year between 2000 and 2999),
  constraint sod_total_nonneg  check (total_cents >= 0),
  constraint sod_snapshot_obj  check (jsonb_typeof(snapshot) = 'object'),
  constraint sod_void_reason   check (voided_at is null or coalesce(btrim(void_reason), '') <> '')
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'service_order_documents_so_org_fk') then
    alter table public.service_order_documents
      add constraint service_order_documents_so_org_fk
      foreign key (service_order_id, organization_id)
      references public.service_orders (id, organization_id) on delete cascade;
  end if;
end $$;

create unique index if not exists service_order_documents_org_type_number_unique
  on public.service_order_documents (organization_id, doc_type, number);
create unique index if not exists service_order_documents_org_type_year_seq_unique
  on public.service_order_documents (organization_id, doc_type, doc_year, seq);
create index if not exists service_order_documents_org_so_idx
  on public.service_order_documents (organization_id, service_order_id, issued_at desc);

alter table public.service_order_documents enable row level security;
drop policy if exists tenant_isolation_service_order_documents_all on public.service_order_documents;
create policy tenant_isolation_service_order_documents_all on public.service_order_documents
  for all
  using      (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.service_order_documents from anon;

drop trigger if exists trg_service_order_documents_audit on public.service_order_documents;
create trigger trg_service_order_documents_audit
  after insert or update or delete on public.service_order_documents
  for each row execute function public.fn_audit_log_row();

drop trigger if exists trg_service_order_documents_updated_at on public.service_order_documents;
create trigger trg_service_order_documents_updated_at
  before update on public.service_order_documents
  for each row execute function public.fn_set_updated_at();

comment on table public.service_order_documents is
  'Documentos emitidos a partir de uma O.S. (orçamento, ordem de serviço, recibo). '
  '`snapshot` é auto-suficiente e IMUTÁVEL: a impressão não faz nenhum join, então '
  'renomear a empresa, mudar o endereço do cliente ou apagar um produto NÃO altera '
  'um documento já entregue. Correção = emitir novo e cancelar o anterior.';

-- ── Numeração sequencial por (org, tipo, ano): ORC-2026-0001, OSV-2026-0001,
-- REC-2026-0001. Mesmo padrão de fn_assign_os_code (0055): advisory lock por
-- transação, volume de ateliê. Prefixo OSV- (e não OS-) para não confundir com
-- service_orders.code.
create or replace function public.fn_assign_document_number() returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_prefix text;
  v_year    integer;
  v_next    integer;
begin
  if new.number is not null and btrim(new.number) <> '' then
    return new;
  end if;

  v_prefix := case new.doc_type
                when 'orcamento'     then 'ORC'
                when 'ordem_servico' then 'OSV'
                when 'recibo'        then 'REC'
              end;
  if v_prefix is null then
    raise exception 'fn_assign_document_number: doc_type desconhecido (%)', new.doc_type;
  end if;

  v_year := extract(year from coalesce(new.issued_at, now()))::int;

  perform pg_advisory_xact_lock(
    hashtext(new.organization_id::text || ':doc:' || new.doc_type || ':' || v_year::text)
  );

  select coalesce(max(seq), 0) + 1
    into v_next
    from public.service_order_documents
   where organization_id = new.organization_id
     and doc_type        = new.doc_type
     and doc_year        = v_year;

  new.doc_year := v_year;
  new.seq      := v_next;
  new.number   := v_prefix || '-' || v_year::text || '-' || lpad(v_next::text, 4, '0');
  return new;
end $$;

drop trigger if exists trg_service_order_documents_number on public.service_order_documents;
create trigger trg_service_order_documents_number
  before insert on public.service_order_documents
  for each row execute function public.fn_assign_document_number();

-- ── Imutabilidade: só cancelamento é editável. É isso que dá valor probatório ao
-- recibo — o que foi entregue ao cliente não pode ser reescrito depois.
create or replace function public.fn_service_order_documents_freeze() returns trigger
language plpgsql
as $$
begin
  if new.snapshot         is distinct from old.snapshot
     or new.doc_type      is distinct from old.doc_type
     or new.number        is distinct from old.number
     or new.seq           is distinct from old.seq
     or new.doc_year      is distinct from old.doc_year
     or new.total_cents   is distinct from old.total_cents
     or new.service_order_id is distinct from old.service_order_id
     or new.organization_id  is distinct from old.organization_id
     or new.issued_at     is distinct from old.issued_at
  then
    raise exception
      'Documento % é imutável: só voided_at/void_reason podem mudar. Emita um novo documento.',
      old.number
      using errcode = 'check_violation';
  end if;
  return new;
end $$;

drop trigger if exists trg_service_order_documents_freeze on public.service_order_documents;
create trigger trg_service_order_documents_freeze
  before update on public.service_order_documents
  for each row execute function public.fn_service_order_documents_freeze();
