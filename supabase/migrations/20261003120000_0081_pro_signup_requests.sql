-- 0081 — Fila de pedidos do Calc3D PRO (Pix manual) + bucket dos comprovantes.
--
-- O comprador paga o Pix na pagina publica, declara o pagamento num formulario e
-- o dono recebe um e-mail pedindo a liberacao. Esta tabela e essa fila.
--
-- POR QUE `organization_id` E NULLABLE (parece violar a doutrina de tenancy, nao
-- viola): o pedido nasce ANTES da organization existir — e justamente a aprovacao
-- que a cria. Nao e tabela tenant-aware, e fila de PLATAFORMA, mesmo desenho de
-- `incidents` (migration 0021), que tambem tem organization_id nullable e policy
-- unica de platform_admin. A coluna e preenchida no momento da aprovacao e serve
-- de ponteiro para o tenant provisionado.
--
-- DOUTRINA DIRC, campo a campo:
--   Duplicar  — `buyer_*` vive aqui mesmo: e a declaracao do comprador no instante
--               do pedido, nao copia de nenhuma linha existente.
--   Integrar  — nada de `plan_label`/`plan_price_display`: rotulo e preco sao copy
--               da pagina e vivem em `lib/pricing/pro-plans.ts`.
--   Referenciar — `receipt_storage_path` guarda o caminho, nunca os bytes.
--   Calcular  — nenhum booleano `is_paid`: `status` e a unica verdade.

create table if not exists public.pro_signup_requests (
  id uuid primary key default gen_random_uuid(),

  -- Preenchido so na aprovacao. `set null` e nao `cascade`: se o tenant for
  -- apagado, o registro do pedido (e do pagamento declarado) tem de sobreviver.
  organization_id uuid references public.organizations(id) on delete set null,

  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  plan text not null default 'pro' check (plan in ('pro')),

  buyer_name  text not null,
  -- NAO e FK para auth.users de proposito. Parece o anti-padrao "string que
  -- deveria ser FK", mas no instante do INSERT nao existe usuario para apontar:
  -- a conta so e criada na ativacao. As FKs reais aparecem depois, em
  -- organization_id e reviewed_by.
  buyer_email text not null,
  buyer_phone text,
  company_name text,

  -- Dinheiro em centavos + moeda ISO-4217. O valor e derivado no servidor a
  -- partir do plano, nunca aceito do corpo da requisicao.
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'BRL' check (currency = 'BRL'),
  pix_txid text,
  declared_paid_at timestamptz not null,
  receipt_storage_path text,

  request_ip text,
  user_agent text,

  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  invited_user_email text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pro_signup_requests_pending_idx
  on public.pro_signup_requests (created_at desc)
  where status = 'pending';

create index if not exists pro_signup_requests_email_idx
  on public.pro_signup_requests (lower(buyer_email), created_at desc);

-- Dedup ANTES da constraint: a tabela e nova aqui, mas o mesmo bloco vai para o
-- apendice do baseline, que o update.sh do kit re-aplica sobre bancos de clone
-- possivelmente ja sujos. Criar o indice unico com dados violando-o quebraria a
-- atualizacao desses clones.
update public.pro_signup_requests r
   set status = 'cancelled'
 where r.status = 'pending'
   and r.id <> (
     select r2.id
       from public.pro_signup_requests r2
      where r2.status = 'pending'
        and lower(r2.buyer_email) = lower(r.buyer_email)
      order by r2.created_at desc, r2.id desc
      limit 1
   );

-- Idempotencia e anti-spam: o segundo envio do mesmo e-mail com um pedido ainda
-- em aberto bate 23505, e a rota trata como sucesso SEM reenviar o e-mail ao
-- dono. Parcial porque pedidos ja resolvidos podem se repetir legitimamente
-- (renovacao no ano seguinte).
create unique index if not exists pro_signup_requests_one_pending_per_email
  on public.pro_signup_requests (lower(buyer_email))
  where status = 'pending';

alter table public.pro_signup_requests enable row level security;

-- Ninguem autenticado le, exceto platform admin — a linha carrega telefone e
-- comprovante de pagamento de terceiros. O INSERT publico NAO passa por aqui: a
-- rota usa service role (bypassa RLS) depois de Zod, rate limit e honeypot. Dar
-- insert ao `anon` abriria escrita direta via PostgREST com a anon key, sem
-- nenhuma dessas defesas.
drop policy if exists platform_admin_only_pro_signup_requests on public.pro_signup_requests;
create policy platform_admin_only_pro_signup_requests on public.pro_signup_requests for all
  using (public.fn_is_platform_admin()) with check (public.fn_is_platform_admin());

drop trigger if exists pro_signup_requests_updated_at on public.pro_signup_requests;
create trigger pro_signup_requests_updated_at before update on public.pro_signup_requests
  for each row execute function public.fn_set_updated_at();

comment on table public.pro_signup_requests is
  'Fila de pedidos de liberacao do Calc3D PRO (Pix manual). Tabela de plataforma, nao tenant-aware: organization_id so e preenchido na aprovacao.';
comment on column public.pro_signup_requests.organization_id is
  'Tenant provisionado na aprovacao. Nulo enquanto o pedido esta pendente — o pedido nasce antes da organizacao existir.';
comment on column public.pro_signup_requests.amount_cents is
  'Derivado de lib/pricing/pro-plans.ts no servidor. Nunca vem do corpo da requisicao.';

-- Bucket dos comprovantes. Privado e com MIME/tamanho impostos pelo proprio
-- Storage, nao so pelo Zod: o endpoint que emite a URL assinada e publico, e
-- validacao que mora so na aplicacao e validacao que da para contornar.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pro-receipts', 'pro-receipts', false, 5242880,
        array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Sem policy para anon/authenticated: nao ha organizacao nem usuario para casar
-- com o prefixo do caminho (o pedido e pre-tenant). Escrita acontece unicamente
-- por signed upload URL emitida no servidor — o token viaja na URL e nao depende
-- de sessao. Leitura, so platform admin ou service role.
drop policy if exists platform_admin_read_pro_receipts on storage.objects;
create policy platform_admin_read_pro_receipts on storage.objects for select
  using (bucket_id = 'pro-receipts' and public.fn_is_platform_admin());
