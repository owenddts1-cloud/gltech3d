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
- **Realtime** (`.channel()`) — canal público não depende de `auth.uid()`.

---

## Telas afetadas hoje

Varredura de todo componente `"use client"` que importa `lib/supabase/browser`:

| Arquivo | O que faz | Situação |
|---|---|---|
| `app/app/models/_components/ModelsClient.tsx` | baixava STL do bucket privado | **corrigido** — usa URL assinada |
| `components/inbox/CRMSidePanel.tsx` | lê `crm_leads`, `orders`, `crm_lead_activities` | **corrigido** — `fetchContactCrmSummary` |
| `components/contacts/MergeDialog.tsx` | lê `merge_queue` | **corrigido** — `fetchMergeQueueItem` |
| `app/app/ai/knowledge/sources/_client.tsx:41` | só `.channel()` (Realtime) | **ok** |
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
