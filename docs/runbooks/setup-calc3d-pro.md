# Setup do Calc3D PRO — passo a passo

> **Versão em PDF:** `docs/guia-setup-calc3d-pro.pdf` (não versionado — regenere com
> `node scripts/gerar-guia-setup.mjs`). Ele lê os valores reais do seu `.env.local`.

Checklist de configuração para o trial e a venda funcionarem. Auditado em 05/10/2026
contra o `.env.local`, a conta Resend e o DNS real.

## Você não tem domínio próprio — e isso define o caminho do e-mail

| Domínio | Situação |
|---|---|
| `gltech3d.com.br` | **Não registrado** — disponível no registro.br (~R$40/ano) |
| `gltech3d.vercel.app` | Seu site. Subdomínio da Vercel: **não aceita registros DNS** |
| `calc3d.com.br` | De terceiro. Serviu de inspiração, não é seu |

O Resend **exige** domínio verificado para entregar a terceiros. Sem domínio, ele só
entrega no e-mail dono da conta — serve para você receber avisos, não para falar com o
cliente.

**Solução adotada: SMTP da Brevo.** Plano grátis, 300 e-mails/dia, entrega para qualquer
pessoa. O código prefere SMTP e deixa o Resend de reserva. (A senha de app do Gmail não
estava disponível na conta — a Brevo resolve o mesmo problema sem ela.)

Registrar `gltech3d.com.br` continua valendo a pena no futuro (sai do `.vercel.app` e dá
remetente próprio), mas **não bloqueia nada**.

## Estado atual

| Item | Estado |
|---|---|
| SMTP (Brevo) | ✅ **configurado e testado** — entregou para o dono e para terceiro |
| `RESEND_API_KEY` | ✅ configurada (reserva) |
| `RESEND_FROM_EMAIL` | ✅ `onboarding@resend.dev` |
| `NEXT_PUBLIC_PIX_KEY` | ✅ `eb2082ad-…-7760988d3126` |
| `NEXT_PUBLIC_PIX_RECEIVER_NAME` | ⚠️ **em branco de propósito** — Passo 2 |
| `PRO_SIGNUP_NOTIFY_EMAIL` | ✅ `diretoria.gltech@gmail.com` |
| `NEXT_PUBLIC_APP_URL` | ✅ `https://gltech3d.vercel.app` |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | ❌ faltam — Passo 4 |
| `public/pix/calc3d-pro-qr.jpeg` | ✅ QR adicionado |
| `NEXT_PUBLIC_PIX_COPIA_E_COLA` | ✅ validado: CRC ok, chave ok, valor R$ 89,00 = preço do plano |
| Migration 0082 | ✅ aplicada |
| Org GLTech3D | ✅ `plan=pro`, sem expiração |

---

## Passo 1 — E-mail ✅ FEITO

Configurado pela **Brevo** (plano grátis, 300/dia) e **testado de verdade**: entregou para
`diretoria.gltech@gmail.com` e para um endereço de terceiro.

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=bcb460001@smtp-brevo.com
SMTP_PASSWORD=<chave SMTP da Brevo>
SMTP_FROM=GLTech3D <diretoria.gltech@gmail.com>
```

Para testar de novo a qualquer momento:

```
node scripts/testar-smtp.mjs                    # manda para o próprio remetente
node scripts/testar-smtp.mjs alguem@exemplo.com # manda para outra pessoa
```

### Cuidados

- **Não ative "Bloquear endereços IP não autorizados"** em SMTP & API na Brevo. O site roda
  na Vercel, que envia de IPs que mudam a cada execução — com o bloqueio, a Brevo recusaria
  o próprio sistema.
- **Confira o spam do cliente.** Enviar como `@gmail.com` por um serviço de terceiro
  funciona, mas o Gmail não reconhece a Brevo como autorizada a falar pelo `gmail.com`.
  Parte dos e-mails pode cair no spam. Registrar `gltech3d.com.br` e autenticá-lo na Brevo
  resolve isso de vez.
- **Falha de rede intermitente é esperada.** `smtp-relay.brevo.com` aponta para vários
  servidores; um pode não responder. O código tenta de novo sozinho em falha de conexão
  (nunca em senha errada).
- A chave SMTP pode ser revogada e trocada na Brevo a qualquer momento — só atualize
  `SMTP_PASSWORD` no `.env.local` e na Vercel.

---

## Passo 2 — Pix

### 2.1 Variáveis — só falta o nome do recebedor

Já aplicado em `.env.local`:

```
NEXT_PUBLIC_PIX_KEY=eb2082ad-a521-4ff7-9670-7760988d3126
PRO_SIGNUP_NOTIFY_EMAIL=diretoria.gltech@gmail.com
```

Falta preencher:

```
NEXT_PUBLIC_PIX_RECEIVER_NAME=Seu Nome Como Está No Banco
```

**Deixei em branco de propósito.** Sua chave é aleatória (um UUID), então o nome do
recebedor é a *única* pista que o comprador tem de que está pagando a pessoa certa. Em
branco, a linha "Recebedor" não aparece. Com o nome errado, ele desconfia e abandona — e
isso é pior que não mostrar nada.

Depois de editar, **pare e reinicie** o `npm run dev`. Recarregar a página não basta.

### 2.2 QR Code

```bash
mkdir -p public/pix
```

1. No app do banco: **Pix → Receber → Gerar QR Code**.
2. Valor fixo de **R$ 89,00** (reduz erro de digitação) ou sem valor (reaproveitável).
3. Salve como PNG ~400×400, fundo branco, em `public/pix/calc3d-pro-qr.jpeg`.
4. Commite o arquivo.

Sem o arquivo a imagem some sozinha e a chave copiável continua funcionando — não quebra,
só perde conversão.

> ⚠️ QR com valor fixo morre quando o preço mudar. Trocar `amountCents` em
> `lib/pricing/pro-plans.ts` exige regerar o QR.

---

## Passo 3 — Redis (rate limit)

Sem `UPSTASH_REDIS_REST_URL`, o `checkRateLimit` cai para um contador **em memória, por
instância** — em serverless isso é praticamente nenhum limite. E no cadastro o abuso não
gera só e-mail: cria **contas de usuário e organizações**.

1. [upstash.com](https://upstash.com) → **Create Database** → Redis → região `sa-east-1`.
2. Na aba **REST API**, copie `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`.
3. Coloque as duas em `.env.local` e na Vercel.

Limites já aplicados quando o Redis existe: cadastro 5/h por IP · pedido Pix público 3/h
por IP · upload de comprovante 2/h por IP · pedido dentro do CRM 3/h por organização ·
reset de senha 5/h por IP **e** 3/h por e-mail.

---

## Passo 4 — Vercel

1. Project → **Settings** → **Environment Variables**.
2. Adicione, marcando **Production**, **Preview** e **Development**:
   - `NEXT_PUBLIC_PIX_KEY`
   - `NEXT_PUBLIC_PIX_RECEIVER_NAME`
   - `PRO_SIGNUP_NOTIFY_EMAIL`
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
   - `RESEND_FROM_EMAIL` (o valor novo do Passo 1)
3. Confira `NEXT_PUBLIC_APP_URL`: tem que ser a URL pública real
   (`https://gltech3d.vercel.app` ou o domínio final). Ela monta os links de ativação e
   de reset de senha nos e-mails. Com `localhost` ali, o código cai no fallback
   `https://gltech3d.vercel.app` — funciona, mas é melhor deixar explícito.
4. **Deployments** → no último, menu `⋯` → **Redeploy** → **desmarque** "use existing
   build cache" → confirme.

> ⚠️ Variável `NEXT_PUBLIC_*` é embutida em **tempo de build**. Mudar na Vercel sem
> redeploy não tem efeito nenhum. É o erro mais comum aqui.

---

## Passo 5 — TOTP na sua conta

Você é platform admin, e `/admin` exige MFA. Sem TOTP a tela de aprovação é inalcançável.

1. Instale um autenticador (Google Authenticator, Authy, 1Password, Bitwarden).
2. No CRM: **Configurações → Segurança**.
3. Cartão "MFA (TOTP)" → **Ativar agora**.
4. Escaneie o QR (ou digite o segredo manual).
5. Digite os 6 dígitos.
6. **Salve os códigos de recuperação fora do navegador.**

> Existe reset de senha. **Não existe reset de MFA.** Perder o celular sem os códigos de
> recuperação é perder o acesso.

Seus clientes em trial **não** passam por isso. O TOTP só é exigido de conta com plano
pago — no primeiro login depois de você aprovar o Pix. Avise, senão vira "paguei e o
sistema travou".

---

## Passo 6 — Teste de ponta a ponta

Faça nesta ordem, em janela anônima:

1. **Landing** — abra `/calc3d-pro`. A peça 3D deve animar no hero. Role: os cadeados do
   preview do CRM destravam em cascata.
2. **Celular** — abra a mesma página no telefone. Deve aparecer a ilustração estática, e
   na aba Network **não** deve baixar o chunk do `three`.
3. **Cadastro** — clique em "Ver o que o PRO faz · 7 dias grátis", crie uma conta de
   teste. Você deve cair em `/app/dashboard` com a sidebar, selo **TRIAL · 7 dias**,
   nenhum cadeado e **sem** tela de MFA.
4. **Aviso de trial** — confira se chegou o e-mail em `PRO_SIGNUP_NOTIFY_EMAIL`.
5. **Trial expirado** — no painel do Supabase, mude `trial_ends_at` dessa org para ontem.
   Recarregue: faixa vermelha no topo, cadeados na sidebar, selo **GRÁTIS**.
   `/app/sales` deve redirecionar para `/app/settings/billing` dizendo "Você tentou abrir
   **Vendas**". `/app/dashboard` e `/app/calculator` continuam abrindo.
6. **Pagamento** — em `/app/settings/billing`, preencha o formulário. Confira se o e-mail
   chegou para você.
7. **Aprovação** — em `/admin/pro-signups`, abra o pedido. A tela deve dizer
   **"Organização já existente liberada — nenhum tenant novo foi criado"**. Confira que
   continua existindo **uma só** organização para esse e-mail.
8. **Pós-aprovação** — recarregue o CRM: selo **PRO**, cadeados somem. No próximo login,
   o TOTP é exigido.
9. **Reset de senha** — `/esqueci-senha` com o e-mail de teste. Só funciona depois do
   Passo 1.
10. **Limpeza** — apague a organização e o usuário de teste pelo painel do Supabase.

---

## Ordem recomendada

```
1. E-mail (bloqueador — sem ele nada chega a cliente nenhum)
2. Pix (chave + QR)            ──┐
3. Redis                          ├── podem ser feitos em paralelo
5. TOTP                        ──┘
4. Vercel + redeploy
6. Teste ponta a ponta
```

Se quiser só **testar** antes de vender, pule o Passo 1 usando a Opção C e faça o resto.
Para **vender de verdade**, o Passo 1 é obrigatório.
