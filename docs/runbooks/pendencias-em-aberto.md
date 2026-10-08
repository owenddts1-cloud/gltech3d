# Pendências em aberto

Lacunas conhecidas, com o motivo de ainda não terem sido fechadas. Registradas aqui
para não virarem descoberta de produção.

---

## Fechadas em 2026-10-06

- **Gate de plano em `/api/v1/**`.** `lib/plan/api.ts` (`requireProApi` /
  `requireProApiForSession`) nas rotas de escrita de IA, WhatsApp, contatos, conversas,
  leads, mensagens e equipe; responde `403 plan_required`. LGPD fica livre de propósito
  (atender titular é obrigação legal, com ou sem plano).
- **Server actions sem `assertProAccess`.** Aplicado em todas as que gravam;
  `tests/unit/pro-write-gate-coverage.test.ts` quebra o CI se uma ação nova gravar sem o
  gate (ou sem entrar na allowlist com motivo).
- **Escritas em `organizations` que salvavam zero linhas.** `lib/tenants/update-own-org.ts`
  (service role + org da sessão + zero linhas = erro + colunas de plano proibidas). Usado
  por `updateTenant` e pela tarifa `k_energy`.
- **Chave de serviço `sb_secret_` tratada como ausente.** `lib/supabase/service-role-key.ts`.
  Consertou auditoria sem sessão, login por código de recuperação, e-mails da Equipe e a
  checagem de convite.
- **RPCs SECURITY DEFINER sem checagem de tenant e buckets listáveis.** Migration 0083.
  **Aplicar em produção:** `npx supabase db push` (só a 0083 está pendente).

- **`settings.plan` legado.** `TenantOverview` lê a coluna `plan` (+ trial/vencimento via
  `resolvePlanState`); `createTenant` e `grantProAccess` não escrevem mais o jsonb. Chaves
  `settings.plan` antigas em bancos existentes ficam inertes (ninguém lê).

- **(6) `perf.yml` não falhava.** `scripts/check-bundle-budget.mjs` mede o JS de primeira
  carga (gzip) de `/`, `/calc3d-pro`, `/app/dashboard` e `/app/inbox` contra
  `perf-budgets.json` e falha o CI; `bundle-isolation.test.ts` roda no mesmo job.
  Baseline real é ~2x o alvo antigo de 250 KB do inbox (Sentry Replay ≈170 KB no chunk raiz).
- **(7) Segredo global do webhook de impressoras.** Token por organização (`api_tokens`,
  escopo `printer:webhook`), org resolvida do token, card "Token do webhook" na tela de
  Impressoras. O segredo global só vale para a org do site, com aviso de depreciação.
  Ver `docs/printer-telemetry.md`.
- **(9) Realtime `postgres_changes` pelo browser.** Servidor emite broadcast ids-only por
  org (`lib/realtime/broadcast.ts`) e as telas do tenant escutam + polling de segurança;
  inbox do super-admin e alertas da plataforma ficam só no polling (sem canal
  cross-tenant). Canais ainda são públicos — ver item 16. Ver
  `docs/runbooks/sessao-do-browser.md`.
- **(13) Sentry estourando cota.** `tracesSampler` compartilhado (`lib/sentry/sampling.ts`):
  0.1 em produção, 1 em dev, e zero para `/monitoring` e health checks.

- **(8) Papel só no app.** Migration 0084: DELETE separado por papel em 18 tabelas
  (manager+, admin em `contacts` e `financial_records`; membro em `filaments`, `printers`,
  `service_order_items`, que salvam por substituição). Mapa em `lib/auth/delete-policy.ts`,
  conferido contra a migration por `tests/unit/role-delete-policies-drift.test.ts`.
- **(10) Bucket de orçamentos.** Migration 0085 (bucket privado `orcamentos`) + upload por
  URL assinada (`/api/v1/public/orcamento/upload-slot` e `/confirm`, link de 7 dias).
- **(11) Org suspensa.** Migration 0084: `fn_user_org_ids()`/`fn_user_role_in_org()` só
  consideram org `active`; `resolveActiveOrg` devolve `null` para org não ativa.
- **(12) Tarifa de energia.** Salva no `onBlur` via `saveEnergyTariff`.
- **Lacunas de uso:** editar projeto, evento e fornecedor; excluir contato (bloqueado com
  409 quando há histórico); abas personalizadas do Controle salvas em `control_sheets`
  (migration 0086).

**Migrations 0083–0086 precisam ser aplicadas em produção** (`npx supabase db push`) antes
do deploy do código que depende delas (Controle, orçamentos).

Ver `docs/runbooks/estado-dos-modulos.md` para o estado de cada tela do CRM.

---

## 4. Gate de rota não re-executa em navegação entre rotas PRO

Depois que `app/app/(pro)/layout.tsx` monta, navegar **entre** rotas PRO na mesma sessão
não roda `requirePro()` de novo — o segmento compartilhado já está montado. A janela
fecha em qualquer full load ou `router.refresh()`.

Mitigado por `assertProAccess()` nas server actions que escrevem: a aba velha mostra a
tela, mas não grava.

---

## 5. Sem confirmação de e-mail no cadastro

Decisão de produto para não matar o funil do trial. Riscos assumidos:

- e-mail descartável cria organização grátis (mitigado por rate limit + honeypot);
- quem digita o e-mail errado depende do reset de senha, que por sua vez depende do
  Resend com domínio verificado.

---

## 6. `perf.yml` não falha nunca

**Fechada em 2026-10-06** — ver "Fechadas" acima.

---

## 7. Webhook de impressoras: um segredo para todas as orgs

**Fechada em 2026-10-06** — ver "Fechadas" acima.

---

## 8. Permissão por papel só no app, não no banco

**Fechada em 2026-10-06** — ver "Fechadas" acima.

---

## 9. Realtime `postgres_changes` pelo cliente do navegador

**Fechada em 2026-10-06** — ver "Fechadas" acima.

---

## 10. Bucket `orcamentos-public` não existe

**Fechada em 2026-10-06** — ver "Fechadas" acima.

---

## 11. Organização suspensa mantém acesso aos dados

**Fechada em 2026-10-06** — ver "Fechadas" acima.

---

## 12. Tarifa de energia sem botão próprio de salvar

Em Impressoras, mudar só a "Tarifa Energia (R$/kWh)" não dispara gravação: ela vai junto da
próxima alteração de impressora/carretel. **Como fechar:** salvar no `onBlur` do campo.

**Fechada (2026-10-06):** o campo do dashboard grava no `onBlur` quando o valor muda, via
`saveEnergyTariff` (`app/actions/printers/actions.ts`: gate PRO + Zod 0,01–10 +
`mergeOwnOrgSettings`), com o toast "Tarifa de energia salva".

---

## 13. Sentry recusando eventos (429 em `/monitoring`)

**Fechada em 2026-10-06** — ver "Fechadas" acima.


---

## 14. Hero da landing depende do vídeo carregar

`components/marketing/HeroScrollVideo.tsx` fica em "CARREGANDO..." enquanto o vídeo não
carrega; se o `.mp4` falhar (rede ruim, bloqueio), o título nunca aparece. Comportamento
anterior a esta rodada, visto ao testar com o vídeo bloqueado. **Como fechar:** timeout curto
que mostra o hero estático (imagem de capa) quando o vídeo não fica pronto.

---

## 15. Replay do Sentry pesa em todas as rotas

O orçamento de bundle (`perf-budgets.json`) foi calibrado no tamanho real: a meta antiga de
250 KB para o Inbox está ~2,3x abaixo da realidade. O maior peso comum é Sentry + Replay no
chunk raiz (~130 KB gzip + ~37 KB). **Como reduzir:** carregar o Replay sob demanda
(`lazyLoadIntegration`).

---

## 16. Canais de Realtime públicos (sem Realtime Authorization)

Os canais `org:<orgId>:*` (`lib/realtime/channels.ts`) são de broadcast **público**: quem
tem a anon key e sabe um id de org (aparece em URLs públicas de mídia da landing) pode
**escutar** metadados de atividade daquela org (ids opacos + tipo + horário, sem conteúdo)
e **injetar** sinais falsos. Mitigado hoje: payload só com ids (sanitizado no envio **e no
recebimento**), nenhum texto do payload é renderizado, refetch com throttle de 2 s por query,
e nenhum canal cross-tenant existe. **Como fechar:** canais privados — `private: true` no
`channel()` do servidor e do browser + policies RLS em `realtime.messages` (SELECT/INSERT
só quando `realtime.topic()` = `org:<org do JWT>:*`) + um JWT curto emitido pelo servidor
(route handler autenticado que assina `{ sub, org_id, role: "authenticated", exp ≤ 10 min }`
com o segredo JWT do projeto) e aplicado no browser com `supabase.realtime.setAuth(token)`,
renovado antes de expirar. É schema (policies) + segredo novo no `env.ts`, por isso ficou
fora desta rodada.

---

## 17. Rate limit das rotas públicas depende do Upstash

`checkRateLimit` (`lib/ai/dispatcher/rate-limit.ts`) usa o Upstash Redis quando
`UPSTASH_REDIS_REST_URL`/`_TOKEN` existem e, sem eles, cai para um **contador em memória
por instância**. Na Vercel cada instância serverless tem o seu contador (e ele zera a cada
cold start), então os limites por IP viram "N por instância", não "N no total". Afeta todas
as rotas de `/api/v1/public/`, em especial as que emitem slot de upload anônimo:
`/orcamento/upload-slot` (10/h) e `/orcamento/upload-slot/confirm` (20/h), e
`/pro-signup/receipt-slot`. O que segura o upload de `/orcamento` mesmo sem Upstash: bucket
privado só com MIME explícito (sem `application/octet-stream`, migration 0085), caminho
gerado no servidor com carimbo de emissão, link de leitura só até 2 h depois do slot, e
checagem do tipo gravado + assinatura dos primeiros bytes no `confirm` (o objeto que não
bate é apagado). **Como fechar:** configurar o Upstash em produção (é o caminho previsto) e,
opcionalmente, fazer `env.ts` exigir as duas variáveis quando `NODE_ENV=production`. Não
entrou nesta rodada porque mudar `env.ts` quebraria o build de quem faz self-host sem Redis.

Limite conhecido da checagem de conteúdo: 3MF é validado só pela assinatura de zip
(`PK\x03\x04`); validar o pacote exigiria ler o diretório central no fim do arquivo. O link
continua privado, com validade de 7 dias e servido como `model/3mf` (download, não render).

---

## 18. Pedido público com o e-mail de outra pessoa bloqueia o pedido dela

`pro_signup_requests_one_pending_per_email` (índice único parcial, migration 0081) permite um
pedido **pendente** por e-mail. Qualquer pessoa pode enviar o formulário público
`/calc3d-pro` com o e-mail de um cliente; enquanto esse pedido estiver pendente, o pedido
legítimo do cliente feito de dentro do CRM (`/api/v1/pro-signup/upgrade`) bate no índice e é
tratado como duplicado (`duplicate: true`, sem aviso ao dono).

**Continua aberta (decisão de 2026-10-08).** Cancelar automaticamente o pedido público
quando o "dono do e-mail" pede de dentro do CRM foi tentado e **revertido**: o cadastro não
confirma posse do e-mail (`email_confirm: true` em `app/api/v1/public/signup/route.ts`), então
a sessão não prova nada. Quem pagou de verdade é o autor do pedido público; quem se cadastrou
depois com o e-mail dele poderia derrubar esse pedido e receber o PRO.

Comportamento atual, não destrutivo:
- o pedido de dentro do CRM bate no índice único e recebe **409** com "Já existe um pedido
  pendente com este e-mail — fale com o suporte"; gera audit `pro_signup.blocked_by_pending`.
  Nenhum pedido é cancelado ou alterado. Reenvio do PRÓPRIO pedido continua `duplicate: true`;
- na aprovação de um pedido **público**, se a conta com aquele e-mail foi criada **depois** do
  pedido (ou a data não pode ser lida), nada é deduzido: o link do e-mail recusa ("decida pelo
  painel") e o painel exige escolha explícita da org (`reason: account_newer_than_request`).

**Contorno:** confirmar com o comprador (WhatsApp/comprovante) e recusar o pedido que não for
dele. **Como fechar de vez:** confirmação de e-mail no cadastro (pendência 5) ou unicidade por
origem (migration nova).

---

## 19. Riscos residuais aceitos após a revisão de segurança (2026-10-07)

- **Ativação por WhatsApp com e-mail alheio.** **Fechada em 2026-10-08.** A mensagem de
  WhatsApp do caminho CRIAR (`buildActivationMessage` em
  `lib/pro-signup/whatsapp-message.ts`) não leva mais o link: diz "Enviamos o link de
  ativação para o seu e-mail m***@dominio". O painel e a página `/aprovar` ainda mostram o
  link para copiar, com o aviso de enviá-lo **somente** para o e-mail do comprador.
- **3MF só confere a assinatura de ZIP.** **Fechada em 2026-10-08.** A rota de confirm lê
  o fim do arquivo (Range), localiza o EOCD e exige no diretório central
  `[Content_Types].xml` e uma parte `3D/*.model` (o nome canônico é `3D/3dmodel.model`,
  mas o caminho real é declarado em `_rels/.rels`, então qualquer `3D/*.model` vale). ZIP64
  é recusado. Código em `lib/orcamento/file-check.ts` (`check3mfPackage`).
- **Troca do arquivo depois da confirmação.** **Fechada em 2026-10-08.** A confirmação
  copia o objeto para `verified/<mesmo caminho>`, apaga o original, faz a checagem de
  conteúdo **na cópia** e assina a cópia (`lib/orcamento/verify-upload.ts`). Trocar o
  arquivo no caminho do upload depois disso não muda o que o link serve. Repetir o confirm
  do mesmo slot (dentro das 2 h) reassina a cópia já verificada.
- **Self-host com Caddy:** o `Caddyfile` agora sobrescreve `X-Real-IP` com o IP da conexão
  (o app confia nesse cabeçalho para o rate limit). Quem usa outro proxy precisa fazer o mesmo.
