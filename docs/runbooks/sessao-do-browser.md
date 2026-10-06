# Auditoria — sessão do Supabase no browser

> Por que leituras feitas pelo cliente do browser voltam vazias, quais telas
> estão afetadas hoje, e qual é o padrão certo.

---

## O defeito

O cookie de sessão é gravado com **`httpOnly: true`** em
[middleware.ts:53](../../middleware.ts) e [lib/supabase/server.ts:35](../../lib/supabase/server.ts).
Isso está **correto** — é o que impede um XSS de ler a sessão do usuário.

Mas [lib/supabase/browser.ts:34](../../lib/supabase/browser.ts) chama
`createBrowserClient` **sem adaptador de cookies**. Nessa configuração o
`@supabase/ssr` lê a sessão de `document.cookie` — e **JavaScript não enxerga
cookie `httpOnly`**.

Consequência: **o cliente Supabase do browser nunca tem sessão.** Toda chamada
dele chega ao Postgres com `auth.uid()` nulo, ou seja, como `anon`.

Com RLS ativa em todas as tabelas, o resultado não é um erro — é **lista vazia**.
Silenciosamente.

### Prova

Medido contra o projeto de produção, com o arquivo `PAYLOAD.stl` que existe no
bucket privado `models-3d`:

| Tentativa | Resultado |
|---|---|
| `GET /storage/v1/object/models-3d/<path>` com a anon key | **400 — bloqueado** |
| URL assinada emitida no servidor, buscada **sem credencial nenhuma** | **41.684 bytes, STL válido** |

---

## O padrão correto

**Leitura autenticada não pode sair do browser.** Ela vai numa Server Action ou
Route Handler, que usam `lib/supabase/server.ts` e enxergam o cookie.

Para arquivo em bucket privado, o servidor emite uma **URL assinada** e o browser
busca com `fetch()` puro — a autorização viaja na própria URL:

```ts
// servidor
const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
// browser
const res = await fetch(data.signedUrl);
```

Referência funcionando: `createModelDownloadUrl` em
[app/actions/models/actions.ts](../../app/actions/models/actions.ts).

### O que continua válido no browser

- **`uploadToSignedUrl`** — o token vai na URL, não precisa de sessão. É por isso
  que o upload sempre funcionou e só a leitura quebrava.
- **Realtime por _broadcast_** — canal de broadcast não passa por RLS, então
  funciona sem sessão. **`postgres_changes` NÃO funciona**: o Realtime aplica a
  RLS da tabela ao assinante, e o assinante do browser é `anon` → nenhum evento
  chega, em silêncio. Ver "Realtime sem sessão" abaixo.

---

## Realtime sem sessão (broadcast do servidor)

Antes, seis telas assinavam `postgres_changes` (`messages`, `conversations`,
`crm_leads`, `ai_agent_runs`, `ai_knowledge_sources`) — nenhuma recebia nada,
pelo mesmo motivo das leituras vazias. O desenho atual:

1. **O servidor avisa depois de gravar.** Após a escrita ter sucesso, a rota
   chama `broadcastOrg(orgId, topic, event, payload)` de
   [lib/realtime/broadcast.ts](../../lib/realtime/broadcast.ts) dentro de
   `deferBroadcast(...)` (usa `after()` do Next: não atrasa a resposta). O envio
   é pelo endpoint REST do Realtime (`httpSend`, com fallback p/ servidor
   self-host antigo) — nenhum websocket aberto no servidor.
2. **Canal por org e por assunto**, nomes só via
   [lib/realtime/channels.ts](../../lib/realtime/channels.ts):
   `org:<orgId>:messages`, `org:<orgId>:conversations`, `org:<orgId>:leads`,
   `org:<orgId>:agent-runs`, `org:<orgId>:kb-sources`. **Não existe canal
   cross-tenant**: o inbox do super-admin (`/admin/inbox`) e os alertas da
   plataforma atualizam por polling (20 s / 30 s) — um canal compartilhado
   entregaria a atividade de todos os tenants a quem tivesse a anon key.
3. **Payload só com ids + tipo** (`conversation_id`, `lead_id`, `pipeline_id`,
   `run_id`, `status`…). **Nunca** vai texto de mensagem, nome, telefone ou
   qualquer PII: o tipo `RealtimeIdsPayload` é fechado e
   `sanitizeRealtimePayload` descarta em runtime qualquer campo fora da lista,
   id que não seja UUID e status que não seja token de enum.
4. **O browser só ouve e refaz a leitura pela API autenticada.** Os hooks usam
   `useRealtimeChannel({ name, broadcast: { event: "*" } })`, que entra no tópico
   EXATO (sem sufixo por instância) por um registro com contagem de referência
   ([hooks/realtime/broadcast-registry.ts](../../hooks/realtime/broadcast-registry.ts))
   — duas telas no mesmo tópico compartilham um canal. Ao receber:
   - **re-sanitizam** a mensagem (`readBroadcastPayload`: `kind` fora da lista
     fechada → ignorada; campos fora da allowlist descartados) — o payload é
     entrada NÃO confiável;
   - **não renderizam nada do payload** (ex.: o toast de execução da IA usa
     texto fixo por `kind`/`status` em `hooks/ai/run-toast.ts`; status
     desconhecido vira o texto genérico);
   - invalidam a query **com throttle** (`useThrottledInvalidate`: no máximo 1
     refetch a cada 2 s por query, com um disparo final no fim da rajada),
     filtrando por `conversation_id`/`pipeline_id`/`agent_id` no cliente.
5. **Polling de segurança.** O broadcast é best-effort (não tem retry). Cada
   lista usa `realtimeRefetchInterval(status)`: 30 s enquanto o canal não está
   `subscribed`, 120 s de batimento quando está.

| Tela / hook | Canal | Quem emite |
|---|---|---|
| `useMessagesRealtime` (thread) | `org:<id>:messages` | `lib/waha/ingest.ts` (inbound, fromMe, ack), `app/api/v1/messages/_handler.ts` (envio — inclui resposta da IA) |
| `useConversationsRealtime` (inbox) | `org:<id>:conversations` | os mesmos + `conversations/[id]/{claim,close,release,reactivate-bot}`, PATCH (`_handler`), handoff da IA |
| `useBoard` (kanban) | `org:<id>:leads` | `leads/_handler.ts` (criar/editar/mover, também via MCP), `leads/[id]/{move,win,lose}`, `leads/bulk` |
| `useAgentRuns` (aba Execuções) | `org:<id>:agent-runs` | `lib/ai/runtime/agent.ts` (início), `finalize.ts` (fim) |
| Fontes de conhecimento | `org:<id>:kb-sources` | `ai/knowledge/sources/**` (criar, upload, editar, arquivar, reindexar), ingestão de conversas |
| `useAdminInboxRealtime` / `useAlertsRealtime` | — (desligados de propósito) | polling em `useAdminInbox` (20 s) / `useAdminDashboardKPIs` (30 s) |

**Ao criar uma escrita nova** que uma dessas telas mostra: chame
`deferBroadcast(() => broadcastOrg(...))` depois do sucesso. Escritas que não
emitem (ex.: server actions antigas do CRM) só aparecem no próximo polling.

### Risco residual (enquanto os canais forem públicos)

Os canais **não** são privados (`private: true` + Realtime Authorization ainda
não configurados — pendência em `pendencias-em-aberto.md`). Quem tem a anon key
(pública por design) **e** sabe o id de uma org — que aparece, por exemplo, em
URLs públicas de mídia da landing — consegue:

- **escutar**: vê só ids opacos + tipo + horário, ou seja, *metadados de
  atividade* daquela org ("chegou mensagem na conversa X às 10:02"). Nenhum
  conteúdo, nome ou telefone;
- **injetar** sinais falsos: o pior efeito é a tela refazer a leitura pela API
  autenticada (que devolve só o que o usuário pode ver), limitado pelo throttle,
  ou um toast de texto fixo ("Execução concluída.") sem dado real.

Não dá para: ler dados, escrever dados, nem fazer a tela exibir texto escolhido
pelo atacante. A correção definitiva fecha também a escuta de metadados.

---

## Telas afetadas hoje

Varredura de todo componente `"use client"` que importa `lib/supabase/browser`:

| Arquivo | O que faz | Situação |
|---|---|---|
| `app/app/models/_components/ModelsClient.tsx` | baixava STL do bucket privado | **corrigido** — usa URL assinada |
| `components/inbox/CRMSidePanel.tsx` | lê `crm_leads`, `orders`, `crm_lead_activities` | **corrigido** — `fetchContactCrmSummary` |
| `components/contacts/MergeDialog.tsx` | lê `merge_queue` | **corrigido** — `fetchMergeQueueItem` |
| `app/app/(pro)/ai/knowledge/sources/_client.tsx` | assinava `postgres_changes` (nunca entregava) | **corrigido** — broadcast `org:<id>:kb-sources` |
| `hooks/inbox/*`, `hooks/kanban/useBoard.ts`, `hooks/ai/useAgentRuns.ts` | assinavam `postgres_changes` (nunca entregava) | **corrigido** — broadcast do servidor + polling de segurança |
| `hooks/useAdminInboxRealtime.ts`, `hooks/useAlertsRealtime.ts` | cross-tenant (`postgres_changes` sem filtro / canal público `alerts-platform` sem emissor) | **desligados** — só polling |
| `ProductImages`, `ItemPhotoField`, `MediaGallery`, `_form`, `_document-branding` | só `uploadToSignedUrl` | **ok** |

### Estado

**Nenhuma leitura autenticada sai mais do cliente do browser.** As três telas
afetadas foram movidas para Server Actions, e as três passaram a **mostrar o
erro** em vez de exibir lista vazia — confundir "não há nada" com "não consegui
ler" foi o que manteve o defeito invisível por tanto tempo.

**Não troque o cookie para `httpOnly: false`.** Faria tudo voltar a funcionar de
imediato e trocaria um bug de leitura por um buraco de segurança: qualquer XSS
passaria a poder roubar a sessão.

---

## Como reconhecer o sintoma

Uma lista que aparece **vazia sem mensagem de erro**, numa tela que usa
`createClient()` de `lib/supabase/browser`, com dados que existem no banco.
Confirme consultando a tabela direto — se houver linha lá e a tela mostrar zero,
é este defeito.
