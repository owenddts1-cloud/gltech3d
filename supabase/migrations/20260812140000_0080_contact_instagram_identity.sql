-- =============================================================================
-- Migration 0080 — identidade do Instagram no contato
-- =============================================================================
-- Forward-fix da 0079, que destravou o canal mas nao deu ao contato como ser
-- reconhecido nele. Sem isto, cada mensagem recebida criaria um contato novo.
--
-- POR QUE COLUNA E NAO `source_metadata` jsonb. A ingestao precisa de UPSERT
-- idempotente por identidade, e isso exige indice unico. Indice sobre caminho de
-- jsonb funciona, mas o CLAUDE.md lista "jsonb lock-in" como anti-padrao: a UI
-- passaria a ler `source_metadata->>'ig_id'` espalhado, sem schema central. O
-- WhatsApp ja resolve isso com `phone_number` em coluna; o Instagram segue o
-- mesmo desenho.
--
-- A IDENTIDADE E O ID, NAO O @. O `instagram_user_id` (escopado ao app) e
-- estavel; o handle muda quando a pessoa renomeia o perfil. Casar por @ faria a
-- mesma pessoa virar dois contatos depois de uma troca de nome — e o historico
-- de conversa se partiria ao meio sem ninguem notar.

alter table public.contacts
  add column if not exists instagram_user_id text;
alter table public.contacts
  add column if not exists instagram_username text;

-- Parcial: a maioria dos contatos nao vem do Instagram, e `null` se repete
-- legitimamente. Unico dentro da organizacao, nao global — o id e escopado ao
-- app, e duas orgs com apps distintos podem ver ids diferentes da mesma pessoa.
create unique index if not exists contacts_instagram_user_key
  on public.contacts (organization_id, instagram_user_id)
  where instagram_user_id is not null;

comment on column public.contacts.instagram_user_id is
  'Identidade ESTAVEL do cliente no Instagram (id escopado ao app). O @ muda, o id nao.';
comment on column public.contacts.instagram_username is
  'Handle atual, so para exibicao. Nunca usar para casar identidade.';
