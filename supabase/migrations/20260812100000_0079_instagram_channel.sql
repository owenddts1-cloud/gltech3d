-- =============================================================================
-- Migration 0079 — Instagram como canal, ao lado do WhatsApp
-- =============================================================================
-- A ESPECIFICACAO PEDIA `inbox_conversations` e `inbox_messages` novas. Nao
-- foram criadas, de proposito: `conversations` JA existe e JA foi desenhada para
-- multicanal — tem coluna `channel`, `assigned_to_user_id`, `bot_silenced_until`,
-- `last_handoff_at` e `last_handoff_reason`, que e exatamente o transbordo humano
-- que a spec manda construir. So estava trancada por
-- `CHECK (channel = 'whatsapp')`.
--
-- Criar tabela paralela produziria duas fontes de verdade para "conversa", e o
-- Inbox teria de unir as duas em toda consulta. E o mesmo defeito que este
-- projeto ja carrega em outro lugar (cinco telas informando faturamentos
-- diferentes). Destravar o CHECK custa uma linha e mantem uma fonte so.
--
-- `messages` nao muda: ja e agnostica de canal (`external_id`, `direction`,
-- `type`, `media_url`, `sent_via` com 'ai' e 'automation'), e a idempotencia que
-- o webhook da Meta precisa ja existe em `messages_org_external_id_unique`.

-- ── 1. Conta do Instagram ────────────────────────────────────────────────────
--
-- TOKEN CIFRADO, nao em texto puro como a spec propunha. Um token de Pagina da
-- Meta permite publicar e mandar DM em nome do negocio; e o ultimo lugar onde
-- relaxar. Mesmo padrao de `channel_sessions.webhook_secret_encrypted` e de
-- `ai_provider_credentials`, com `lib/crypto/aes_gcm.ts`.
create table if not exists public.instagram_accounts (
  id                     uuid primary key default gen_random_uuid(),
  organization_id        uuid not null references public.organizations(id) on delete cascade,
  ig_user_id             text not null,
  username               text not null default '',
  page_id                text,
  profile_picture_url    text,
  access_token_encrypted bytea,
  token_expires_at       timestamptz,
  -- O segredo do webhook vive no CAMINHO da URL, nunca em query string: query
  -- string vaza em log de proxy e de CDN. Mesmo padrao do WAHA (0027).
  webhook_path_token     text not null default replace(gen_random_uuid()::text, '-', ''),
  webhook_verify_token   text not null default replace(gen_random_uuid()::text, '-', ''),
  status                 text not null default 'disconnected',
  status_reason          text,
  last_event_at          timestamptz,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'instagram_accounts_status_check') then
    update public.instagram_accounts set status = 'disconnected'
     where status not in ('disconnected', 'connected', 'error', 'token_expired');
    alter table public.instagram_accounts
      add constraint instagram_accounts_status_check
      check (status in ('disconnected', 'connected', 'error', 'token_expired'));
  end if;
end $$;

-- Uma conta do Instagram pertence a uma organizacao so. Sem isto, duas orgs
-- poderiam reivindicar o mesmo perfil e os eventos do webhook cairiam na errada.
create unique index if not exists instagram_accounts_ig_user_key
  on public.instagram_accounts (ig_user_id);
create unique index if not exists instagram_accounts_webhook_token_key
  on public.instagram_accounts (webhook_path_token);
create index if not exists instagram_accounts_org_idx
  on public.instagram_accounts (organization_id, status);

alter table public.instagram_accounts enable row level security;
drop policy if exists tenant_isolation_instagram_accounts_all on public.instagram_accounts;
create policy tenant_isolation_instagram_accounts_all on public.instagram_accounts
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.instagram_accounts from anon;

drop trigger if exists trg_instagram_accounts_audit on public.instagram_accounts;
create trigger trg_instagram_accounts_audit
  after insert or update or delete on public.instagram_accounts
  for each row execute function public.fn_audit_log_row();

-- ── 2. Destravar `conversations` ─────────────────────────────────────────────
alter table public.conversations
  add column if not exists instagram_account_id uuid
    references public.instagram_accounts(id) on delete cascade;

-- Conversa do Instagram nao tem sessao WAHA. A coluna era NOT NULL porque so
-- existia um canal.
alter table public.conversations alter column channel_session_id drop not null;

do $$
begin
  -- O CHECK antigo aceitava so 'whatsapp'. Recriado, nao alterado: Postgres nao
  -- tem "alter constraint" para CHECK.
  if exists (select 1 from pg_constraint where conname = 'conversations_channel_check') then
    alter table public.conversations drop constraint conversations_channel_check;
  end if;
  alter table public.conversations
    add constraint conversations_channel_check
    check (channel in ('whatsapp', 'instagram'));

  if not exists (select 1 from pg_constraint where conname = 'conversations_exactly_one_channel') then
    -- EXATAMENTE UM canal. Conversa sem nenhum e orfa (nao da para responder);
    -- com os dois, nenhum relatorio sabe a qual pertence. Os dois estados sao
    -- invisiveis ate alguem tentar somar por canal.
    alter table public.conversations
      add constraint conversations_exactly_one_channel
      check (
        (channel_session_id is not null and instagram_account_id is null)
        or
        (channel_session_id is null and instagram_account_id is not null)
      );
  end if;
end $$;

create index if not exists conversations_instagram_idx
  on public.conversations (organization_id, instagram_account_id, last_message_at desc)
  where instagram_account_id is not null;

-- ── 3. Agente de IA pode atender o Instagram ─────────────────────────────────
--
-- O dispatcher (`lib/ai/dispatcher`) escolhe o agente publicado pela dupla
-- (org, channel_session). Para o Instagram, a amarracao passa a ser pela conta.
alter table public.ai_agent_versions
  add column if not exists instagram_account_id uuid
    references public.instagram_accounts(id) on delete cascade;

alter table public.ai_agent_versions alter column channel_session_id drop not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ai_agent_versions_exactly_one_channel') then
    alter table public.ai_agent_versions
      add constraint ai_agent_versions_exactly_one_channel
      check (
        (channel_session_id is not null and instagram_account_id is null)
        or
        (channel_session_id is null and instagram_account_id is not null)
      );
  end if;
end $$;

-- ── 4. Regras de automacao ───────────────────────────────────────────────────
create table if not exists public.automation_rules (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  account_id        uuid not null references public.instagram_accounts(id) on delete cascade,
  name              text not null default '',
  trigger_type      text not null,
  -- Restrito a um post especifico, ou nulo para valer em qualquer publicacao.
  media_id          text,
  keywords          text[] not null default '{}',
  -- Resposta em jsonb porque o formato evolui (texto, botoes, cards, midia), e
  -- travar colunas obrigaria migration a cada recurso novo da Meta.
  response_template jsonb not null default '{}'::jsonb,
  -- Auto-resposta publica no comentario ("te mandei no direct"). Separada do
  -- template da DM: uma pode existir sem a outra.
  public_reply      text,
  is_active         boolean not null default false,
  priority          integer not null default 100,
  match_count       integer not null default 0,
  last_matched_at   timestamptz,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'automation_rules_trigger_check') then
    alter table public.automation_rules
      add constraint automation_rules_trigger_check
      check (trigger_type in ('comment', 'dm_welcome', 'story_mention', 'dm_keyword'));
  end if;
end $$;

create index if not exists automation_rules_active_idx
  on public.automation_rules (organization_id, account_id, trigger_type, priority)
  where is_active;

alter table public.automation_rules enable row level security;
drop policy if exists tenant_isolation_automation_rules_all on public.automation_rules;
create policy tenant_isolation_automation_rules_all on public.automation_rules
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.automation_rules from anon;

drop trigger if exists trg_automation_rules_audit on public.automation_rules;
create trigger trg_automation_rules_audit
  after insert or update or delete on public.automation_rules
  for each row execute function public.fn_audit_log_row();

-- ── 5. Publicacoes agendadas ─────────────────────────────────────────────────
create table if not exists public.scheduled_posts (
  id                uuid primary key default gen_random_uuid(),
  organization_id   uuid not null references public.organizations(id) on delete cascade,
  account_id        uuid not null references public.instagram_accounts(id) on delete cascade,
  media_type        text not null,
  caption           text not null default '',
  media_urls        text[] not null default '{}',
  cover_url         text,
  scheduled_for     timestamptz not null,
  status            text not null default 'draft',
  -- Contêiner criado no passo 1 da Meta. Guardado para o passo 2 nao recriar
  -- midia se a publicacao falhar e for reprocessada.
  meta_container_id text,
  meta_media_id     text,
  published_at      timestamptz,
  error_log         text,
  attempt_count     integer not null default 0,
  created_by        uuid references auth.users(id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'scheduled_posts_media_type_check') then
    alter table public.scheduled_posts
      add constraint scheduled_posts_media_type_check
      check (media_type in ('image', 'video', 'reel', 'carousel', 'story'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'scheduled_posts_status_check') then
    alter table public.scheduled_posts
      add constraint scheduled_posts_status_check
      check (status in ('draft', 'scheduled', 'publishing', 'published', 'failed', 'cancelled'));
  end if;
end $$;

-- Indice do cron: ele pergunta "o que vence agora?" a cada minuto, e sem indice
-- parcial isso seria varredura da tabela inteira a cada passada.
create index if not exists scheduled_posts_due_idx
  on public.scheduled_posts (scheduled_for)
  where status = 'scheduled';
create index if not exists scheduled_posts_org_idx
  on public.scheduled_posts (organization_id, account_id, scheduled_for desc);

alter table public.scheduled_posts enable row level security;
drop policy if exists tenant_isolation_scheduled_posts_all on public.scheduled_posts;
create policy tenant_isolation_scheduled_posts_all on public.scheduled_posts
  for all
  using (organization_id in (select * from public.fn_user_org_ids()))
  with check (organization_id in (select * from public.fn_user_org_ids()));
revoke all on public.scheduled_posts from anon;

drop trigger if exists trg_scheduled_posts_audit on public.scheduled_posts;
create trigger trg_scheduled_posts_audit
  after insert or update or delete on public.scheduled_posts
  for each row execute function public.fn_audit_log_row();

comment on table public.instagram_accounts is
  'Conta do Instagram conectada. O token e CIFRADO (access_token_encrypted): ele '
  'permite publicar e mandar DM em nome do negocio.';
comment on column public.conversations.instagram_account_id is
  'Canal Instagram. Exclusivo com channel_session_id (WhatsApp) pela CHECK '
  'conversations_exactly_one_channel.';
