# Runbook — Calc3D PRO: trial, Pix e liberação

Como operar a venda do Calc3D PRO. Dois caminhos de entrada, um caminho de pagamento.

---

## O fluxo, de ponta a ponta

**Entrada A — trial (o caminho principal)**

1. A pessoa abre `/calc3d-pro`, usa a calculadora grátis e clica em "Ver o que o PRO faz · 7 dias grátis".
2. Em `/criar-conta` informa nome da operação, e-mail e senha. **Sem cartão, sem confirmação de e-mail.**
3. O sistema cria a conta, uma organização própria com `trial_ends_at = hoje + 7 dias` e já abre a sessão — ela cai em `/app/dashboard` com tudo liberado.
4. Você recebe um e-mail avisando que um trial começou.
5. No 8º dia os módulos PRO ganham cadeado. **Nada é apagado.** Calculadora, Dashboard e Configurações continuam abertos.

**Entrada B — pagar direto**

A pessoa vai ao bloco Pix de `/calc3d-pro` e declara o pagamento sem nunca ter testado.

**Pagamento (os dois caminhos convergem aqui)**

6. Ela paga o Pix e declara — pelo formulário público (`/calc3d-pro#comprar`) ou de dentro do CRM (`/app/settings/billing`).
7. Você confere o Pix **no seu extrato** e aprova em `/admin/pro-signups`.
8. O acesso destrava e vale por 365 dias.

> O passo 7 é o único ponto de verdade sobre o pagamento. **Nada no sistema sabe se o Pix caiu** — a pessoa apenas declarou. Conferir no extrato não é opcional.

---

## Aprovar: UPGRADE ou CRIAR

A tela decide sozinha qual caminho seguir, e a diferença importa:

| Situação | O que acontece |
|---|---|
| Pedido veio de dentro do CRM | **UPGRADE** da org que fez o pedido |
| E-mail pertence a **uma** organização | **UPGRADE** dessa organização |
| E-mail pertence a **várias** | **409 `ambiguous_org`** — a tela pede que você escolha. Nunca adivinha |
| E-mail tem conta mas nenhuma organização | **CRIA** tenant e coloca a conta existente como admin dele. **Sem link de ativação**: o cliente entra com a senha atual (ou usa "Esqueci minha senha", que manda o link para o e-mail dele) |
| E-mail não tem conta | **CRIA** tenant e manda o link de ativação (uso único) |

**A aprovação nunca mexe no papel de quem já é membro.** Pagar não dá autoridade dentro da
org: se o comprador for viewer/atendente, continua viewer/atendente. Se o acesso dele à org
estava **revogado**, o plano é liberado para a org mas o acesso **não** é reativado — a tela
avisa, e um admin da org precisa convidá-lo de novo. Pedido de dentro do CRM só pode ser
feito pelo **admin** da org (`403 forbidden_role` para os demais; a tela de cobrança esconde
o formulário).

**O link de ativação só cria conta.** Ele define senha apenas criando a conta — nunca troca a
senha de uma conta existente. Por isso é de uso único (a segunda tentativa encontra a conta
criada e é recusada) e não serve para tomar a conta de ninguém, mesmo tendo circulado por
WhatsApp.

**No UPGRADE** nenhum tenant novo nasce e **não sai** e-mail de "crie sua senha" — ela já tem senha. Isso é deliberado: mandar aquele e-mail transformaria o console de admin num vetor de redefinição de senha de terceiros. Ela recebe "PRO liberado, válido até DD/MM".

Antes do UPGRADE existir, quem fizesse trial e depois pagasse ganhava uma **segunda organização vazia** enquanto os dados ficavam na primeira, expirada. O sintoma para o cliente era "paguei e perdi tudo".

**Renovação soma, não reseta.** Renovar 10 dias antes do vencimento preserva esses 10 dias.


---

## Aprovar pelo e-mail (1 clique, sem login)

Decisão do dono: confirmar o Pix e liberar o PRO direto do e-mail, sem abrir o painel.

**Como ligar.** Defina `PRO_APPROVAL_TOKEN_SECRET` (≥32 caracteres; gere com
`openssl rand -base64 48`) na Vercel e no `.env.local`. Sem ela o e-mail continua só com o
link "Abrir o pedido e liberar" (painel com login + TOTP), como antes. Para desligar, apague
a variável — links já enviados param de funcionar na hora.

**O que chega.** O e-mail "Calc3D PRO — liberar acesso para…" ganha dois botões grandes,
**Aprovar e liberar** e **Recusar**, mais o link "Abrir no painel".

**O que acontece no clique.**

1. Abre `/aprovar/<token>`. Abrir **não decide nada** — a página confere a assinatura e
   mostra o resumo (comprador, e-mail mascarado, valor) e um botão **Confirmar aprovação**
   (ou **Confirmar recusa**).
2. Só no clique desse botão a página envia **um** `POST /api/v1/public/pro-signup/email-action`
   com o token. Por que o segundo clique: Microsoft Defender (Safe Links), Proofpoint,
   Mimecast e similares abrem os links do e-mail num navegador headless **que executa
   JavaScript**. Se a página decidisse ao carregar, o scanner aprovaria o PRO sem o Pix
   conferido — ou recusaria um pedido legítimo — sem ninguém clicar.
3. O servidor confere de novo: assinatura (HMAC com segredo próprio), propósito, ação,
   validade (**48 h**), que o pedido existe, está **pendente** e tem o **mesmo valor** do
   e-mail. Rate limit: 10 tentativas por IP a cada 10 min.
4. Aprovar segue exatamente a mesma lógica do painel (`lib/pro-signup/approve.ts`):
   UPGRADE na org existente ou CRIAR tenant novo (nome = empresa do pedido ou nome do
   comprador; slug derivado, com sufixo se já existir). Recusar marca o pedido como recusado
   com a nota "recusado pelo link do e-mail".
5. Você recebe um **e-mail de alarme**: "Pedido de Fulano aprovado pelo link do e-mail às
   HH:MM. Não foi você? Remova o plano aqui" → `/admin/assinantes/<org>`.

**O que a página mostra.** UPGRADE: "PRO liberado para <org> até DD/MM" (com aviso se o
acesso do comprador está revogado). CRIAR conta nova: o link de ativação com **Copiar** e
**Avisar no WhatsApp**. CRIAR com conta existente: "o cliente entra com a senha atual", sem
link. Pedido já decidido: "Este pedido já foi
decidido" (nada muda — o efeito é único). E-mail com mais de uma organização: "escolha no
painel" (nada é liberado sozinho). Link vencido/adulterado: mensagem de link inválido.

**Riscos assumidos (e por quê).** Quem tiver o e-mail tem o poder de aprovar por 48 h — e,
no caminho CRIAR com conta nova, vê o link de ativação. O token vai no caminho da URL, então
aparece no histórico do navegador e nos logs de acesso da hospedagem (Vercel); a página usa
`noindex` e `no-referrer` e o nosso código não registra o token, mas os logs da plataforma
registram o caminho — trate-os como sensíveis por 48 h. Um scanner que **clique** em botões
de formulário ainda poderia confirmar (não é o comportamento comum desses produtos). Mitigações: o botão só decide pedido
pendente e com o valor do e-mail; todo uso é auditado (`pro_signup.approved`/`rejected` com
`via: "email_link"` e IP, sem ator) e gera o e-mail de alarme; desfazer é um clique no painel
de Assinantes. Não encaminhe esse e-mail.

---

## Painel de Assinantes (`/admin/assinantes`)

Só platform admin (login + TOTP). Lista quem é assinante ou já fez trial, com filtros
**Todos / PRO ativo / Em trial / Vencido / Gratuito**, busca por nome ou slug, situação,
vencimento, nº de membros, responsável (admin mais antigo) e último pedido PRO.

Na ficha de um cliente:

- **Plano.** Definir tipo (PRO, Enterprise, Gratuito) com data de vencimento ou **Sem
  vencimento**; **+30 dias** / **+365 dias** (somam ao que resta — e ficam bloqueados para
  plano sem vencimento, porque estender viraria uma data e *reduziria* o acesso); **Remover
  plano** (volta a gratuito **e encerra um trial em andamento**). Data escolhida vale até
  23:59 de Brasília.
- **Membros.** Trocar o papel de cada pessoa. O último admin ativo não pode ser rebaixado
  (promova outro antes).
- **Histórico.** Pedidos PRO da org e os últimos 20 eventos de auditoria, com o motivo.

Toda ação pede um **motivo de pelo menos 10 caracteres**, grava auditoria
(`tenant.plan_changed`, `tenant.plan_extended`, `tenant.plan_revoked`,
`member.role_changed_by_platform_admin`, com `{ before, after, reason }`) e, nas mudanças de
plano, avisa os admins do cliente por e-mail. Limite: 30 alterações por minuto por operador.

As colunas de plano só são escritas por `lib/plan/write.ts` (painel) e `grantProAccess`
(aprovação). O antigo `settings.plan` não é mais escrito nem lido.

---

## O que é grátis e o que é PRO

**Sempre livre:** Calculadora 3D, Dashboard, Configurações (incluindo a tela de pagamento — se ela travasse, ninguém conseguiria pagar).

**PRO:** Vendas, Produtos, Projetos, Ordens de Serviço, Impressoras e Filamentos, Modelagem/Fatiador, Dinheiro, Relatórios, Inbox, Conexões, Contatos, Equipe, Inventário, Fornecedores, Consumíveis, Calendário, IA, Landing Edit, LGPD, Auditoria, Automações, Criação de Conteúdo.

A regra é **allowlist**: qualquer módulo novo nasce travado. Isso é intencional — uma lista de "o que é PRO" seria esquecida e o módulo novo nasceria de graça.

---

## Pré-requisitos (sem eles a venda não funciona)

| Item | Sem ele |
|---|---|
| `NEXT_PUBLIC_PIX_KEY` | O bloco de pagamento esconde a chave e manda para o WhatsApp |
| `NEXT_PUBLIC_PIX_RECEIVER_NAME` | Some a linha "Recebedor:" e o comprador paga sem conferir o nome |
| `public/pix/calc3d-pro-qr.jpeg` | O QR some (a chave copiável continua funcionando) |
| `PRO_SIGNUP_NOTIFY_EMAIL` | Cai no e-mail da diretoria |
| `RESEND_API_KEY` + **domínio verificado** | **Nenhum e-mail chega a cliente nenhum** — nem ativação, nem reset de senha |
| `UPSTASH_REDIS_REST_URL` | O rate limit vira contador em memória por instância, ou seja quase nenhum. No cadastro o abuso cria **contas e organizações**. **Trate como obrigatório.** |
| TOTP na sua conta de platform admin | `/admin` exige MFA; sem isso a tela de aprovação é inalcançável |
| `PRO_APPROVAL_TOKEN_SECRET` (opcional) | O e-mail ao dono vem sem os botões de 1 clique — aprova só pelo painel |

---

## Passo a passo: configurar o Pix

### 1. As variáveis

`NEXT_PUBLIC_PIX_KEY` e `NEXT_PUBLIC_PIX_RECEIVER_NAME` são `NEXT_PUBLIC_*`, lidas de `process.env` no navegador — ou seja, **embutidas em tempo de build**.

> ⚠ **Mudar o valor na Vercel não tem efeito até um redeploy.** Este é o erro que vai acontecer.

**Local:**
1. Abra `.env.local` (não `.env.example`, que é template versionado).
2. Acrescente:
   ```
   NEXT_PUBLIC_PIX_KEY=seu-cnpj-ou-email
   NEXT_PUBLIC_PIX_RECEIVER_NAME=Nome Que Aparece No Banco
   ```
3. Pare e reinicie `npm run dev`. Recarregar a página não basta.

**Vercel:**
1. Project → **Settings** → **Environment Variables** → **Add**.
2. Key e Value; marque **Production**, **Preview** e **Development**.
3. **Save**.
4. **Deployments** → no último, menu `⋯` → **Redeploy** → **desmarque** "use existing build cache" → confirme.

**Qual chave usar:** CNPJ ou e-mail. `NEXT_PUBLIC_PIX_RECEIVER_NAME` **tem que bater** com o nome que aparece no app do banco do comprador — se não bater, ele desconfia e abandona.

Estas variáveis vão para o bundle do navegador: qualquer pessoa vê a chave. É intencional (chave de recebimento é pública por natureza), mas precisa estar dito.

### 2. O QR Code

Não vai em variável de ambiente — imagem não cabe lá.

1. No app do seu banco: **Pix → Receber → Gerar QR Code**.
2. Com valor fixo de R$ 89,00 (reduz erro de digitação) ou sem valor (reaproveitável).
3. Salve como PNG, ~400×400, fundo branco.
4. Coloque em `public/pix/calc3d-pro-qr.jpeg` e commite.

Se o arquivo não existir, a imagem simplesmente some e a chave copiável continua funcionando — não quebra, só perde conversão.

> ⚠ **QR com valor fixo morre quando o preço mudar.** Trocar `amountCents` em `lib/pricing/pro-plans.ts` exige regerar o QR.

---

## Passo a passo: ativar o TOTP na sua conta

**Estado atual:** `requiresMfa` exige TOTP de **platform admin sempre** e de `admin` de tenant **só com plano pago**. Usuário em trial não é incomodado — forçar um autenticador antes de a pessoa ver uma tela do produto mataria o funil.

Você é platform admin, então para você é obrigatório.

### Caminho 1 — pela tela de Segurança (novo)

1. Instale um autenticador: Google Authenticator, Authy, 1Password ou Bitwarden.
2. Entre no CRM e vá em **Configurações → Segurança**.
3. No cartão "MFA (TOTP)", clique em **Ativar agora**.
4. Escaneie o QR (ou digite o segredo manualmente).
5. Digite os 6 dígitos.
6. **Salve os códigos de recuperação fora do navegador** — gerenciador de senhas ou papel no cofre.

### Caminho 2 — pelo login (automático)

Se o MFA for obrigatório para você e ainda não estiver configurado, o overlay aparece sozinho no primeiro carregamento de qualquer rota `/app/**`: saia, entre de novo em `/login`, e siga os mesmos passos 4-6.

> ⚠ **Sem os códigos de recuperação, perder o celular = perder o acesso.** Existe reset de senha, mas não reset de MFA.

### O que o cliente vive

Quem está em trial **não** é incomodado com TOTP. No **primeiro login depois de você aprovar o Pix**, ele será levado ao enrolamento. Avise — senão vira "paguei e o sistema travou".

---

## Situações que você vai encontrar

**"Enviei o formulário duas vezes."** O índice único parcial só permite um pedido pendente por e-mail. O segundo responde sucesso com `duplicate: true` e **não** dispara outro e-mail.

**"Paguei mas não chegou e-mail para você."** Confira o rate limit: 3 envios por hora por IP (público) ou por organização (dentro do CRM).

**"O link de ativação expirou."** Vale 7 dias e só existe no caminho CREATE. Rejeite o pedido antigo e aprove de novo, ou crie o tenant à mão.

**"Criei a conta com o e-mail errado."** Agora existe reset de senha em `/esqueci-senha` — mas ele depende do Resend com domínio verificado. Sem isso, você troca a senha à mão pelo painel do Supabase.

**"A fila aparece vazia e eu sei que tem pedido."** Vazio aqui é sintoma de falha de leitura, não de ausência: a tela distingue os dois casos e mostra o erro em vermelho quando a requisição falha. Se aparecer "Nenhum pedido", não há pedido mesmo.

**"Um cliente diz que o módulo travou no meio do uso."** O gate roda na navegação. Uma aba aberta antes do trial vencer continua mostrando a tela até ela recarregar — mas **não** consegue mais gravar (as server actions checam plano). Pedir F5 resolve.

---

## Onde o código mora

| Peça | Caminho |
|---|---|
| Landing | `app/(marketing)/calc3d-pro/` |
| Cena 3D do hero | `app/(marketing)/calc3d-pro/_components/PrintHero.tsx` |
| Cadastro / trial | `app/(marketing)/criar-conta/` + `app/api/v1/public/signup/route.ts` |
| Reset de senha | `app/(public)/esqueci-senha/`, `app/(public)/redefinir-senha/[token]/` |
| Decisão de plano (pura) | `lib/plan/resolve.ts`, `lib/plan/modules.ts` |
| Gate de rota | `app/app/(pro)/layout.tsx` + `lib/plan/server.ts` |
| Cadeado e selo | `components/shell/Sidebar.tsx` |
| Faixa de trial | `components/app/TrialBanner.tsx` |
| Tela de upgrade | `app/app/settings/billing/` |
| Aprovação (lógica única) | `lib/pro-signup/approve.ts` |
| Aprovação pelo painel | `app/api/v1/admin/pro-signups/[id]/approve/route.ts` |
| Aprovação pelo e-mail | `lib/pro-signup/email-action-token.ts`, `app/(public)/aprovar/[token]/`, `app/api/v1/public/pro-signup/email-action/route.ts` |
| Painel de Assinantes | `app/admin/(protected)/assinantes/`, `app/api/v1/admin/subscribers/`, `lib/plan/admin.ts`, `lib/plan/write.ts` |
| UPGRADE vs CRIAR (puro) | `lib/pro-signup/resolve-target-org.ts` |
| Preço e duração | `lib/pricing/pro-plans.ts`, `lib/tenants/trial.ts` |
| Schema | migrations `0081` (pedidos) e `0082` (plano e trial) |

Ações de auditoria: `signup.trial_started`, `pro_signup.requested`, `pro_signup.approved` (com `mode: upgrade|create`), `pro_signup.rejected`, `pro_signup.activated` (aprovação/recusa levam `via: panel|email_link`), `tenant.plan_changed`, `tenant.plan_extended`, `tenant.plan_revoked`, `member.role_changed_by_platform_admin`, `auth.password_reset_requested`, `auth.password_reset_completed`.
