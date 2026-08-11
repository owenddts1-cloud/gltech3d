# Pendências em aberto — passo a passo

> Estado em 11/08/2026. Quatro coisas dependem de você: duas porque exigem senha
> ou conta que eu não tenho, uma porque é decisão de negócio, e uma porque é
> `git push`. Estão na ordem de **impacto**, não de esforço.

---

## 1. Migrations 0075 e 0076 — 5 minutos, conserta coisa que está quebrada AGORA

**Por que primeiro.** O código da 0075 **já está publicado** (subiu no push de 19
commits). Ou seja: a tela de editar peça em `/app/models` está no ar e **falha ao
salvar**, porque a tabela `model_versions` não existe no banco. Rodar a migration
conserta na hora, sem precisar de deploy novo.

A 0076 conserta outra coisa silenciosa: há **duas linhas `Pedidos` marcadas como
pipeline padrão**. Código que resolve o padrão com `.single()` estoura, e com
`.limit(1)` escolhe sem critério — o lead cai num funil hoje e no outro amanhã.

### Antes de aplicar: conferir se o CLI está sincronizado

**Este passo não é opcional.** Migrations anteriores podem ter sido aplicadas
pelo painel do Supabase ou pelo MCP, e não pelo CLI. Se o CLI não souber disso,
ele tenta reaplicar tudo desde o começo.

```bash
npx supabase migration list
```

Você vai ver duas colunas, `Local` e `Remote`. O que procurar:

- **Só `0075` e `0076` aparecem em `Local` sem par em `Remote`** → está tudo
  certo, siga para o `push`.
- **Muitas migrations antigas sem par em `Remote`** → o CLI está desalinhado.
  **NÃO rode o `push`**. Me chame com a saída do comando; o conserto é
  `npx supabase migration repair --status applied <versão>` para cada uma que já
  foi aplicada de outro jeito, e errar isso reaplica schema em cima de dado vivo.

### Aplicar

```bash
npx supabase db push
```

O CLI pede a senha do banco (a do projeto Supabase, em Settings → Database). Ela
é digitada no seu terminal e não passa por mim.

### Conferir que funcionou

```bash
npx supabase migration list
```

`0075` e `0076` devem aparecer nas duas colunas. E na prática:

1. Abra `/app/models`, escolha uma peça, expanda **Editar peça**, gire 90° e
   salve. Deve aparecer "Versão 2 gravada" e o histórico com v1 e v2.
2. Abra `/app/kanban`. Agora só **uma** linha deve ter o selo "Default".

> As duas migrations são aditivas — criam tabela, coluna e índice. Nenhuma apaga
> ou altera dado existente. A 0076 só desmarca o `is_default` do pipeline mais
> novo; nenhum pipeline é removido.

---

## 2. O domínio — decisão de negócio, e está custando venda

**O problema, medido.** `gltech3d.com.br` **não existe no DNS**: sem registro A,
sem NS, sem SOA. Domínio registrado, mesmo sem site, tem NS do registrador — a
ausência dos três indica que **o domínio não está registrado**.

E o feed que alimenta o catálogo do Instagram, do WhatsApp e do Facebook está
publicando **29 links para ele**. Todo link de produto e de imagem do seu
catálogo aponta para um endereço que não abre. Confira você mesmo:

```bash
curl -s https://gltech3d.vercel.app/api/v1/public/feed/products.csv | head -3
```

### Caminho A — resolver hoje, em 2 minutos (recomendado começar por aqui)

No painel da Vercel → Settings → Environment Variables, troque:

```
NEXT_PUBLIC_APP_URL = https://gltech3d.vercel.app
```

Depois **Redeploy** (a variável só entra num build novo). Todos os links do feed,
do sitemap, do Open Graph e das mensagens de WhatsApp passam a apontar para um
endereço que funciona, porque agora tudo lê de uma fonte só
(`lib/marketing/site-url.ts`).

### Caminho B — o endereço definitivo

1. Registre `gltech3d.com.br` no [registro.br](https://registro.br) (é o
   registrador oficial do `.com.br`; leva algumas horas para propagar).
2. Na Vercel → Settings → Domains → **Add**, informe o domínio. A Vercel mostra
   os registros a criar no painel do registro.br.
3. Quando o domínio responder, volte a variável para
   `NEXT_PUBLIC_APP_URL = https://gltech3d.com.br` e faça Redeploy.

**Não faça B antes de A.** Enquanto o registro não propaga, o catálogo continua
com links mortos.

### Depois de trocar, conferir

```bash
curl -s https://<seu-dominio>/api/v1/public/feed/products.csv | grep -oE "https?://[a-z0-9.:-]+" | sort -u
```

Deve listar **só** o domínio que você escolheu.

---

## 3. Publicar os dois commits que faltam

Estão prontos e testados, mas não subi porque `git push` precisa do seu aval:

| Commit | O que leva |
|---|---|
| `dca4ced` | fonte única do endereço do site, título sem `· GLTECH CRM`, keywords removidas, canonical |
| `2f6c0a0` | liveness, migration 0076, KPI, manifest, moeda, precificação unificada, analytics, consentimento, contraste, formulário |

É só me dizer **"pode dar push"** que eu faço — o branch é fast-forward em `main`
e o deploy da Vercel dispara sozinho.

**Antes de subir, decida o item 2.** O `dca4ced` faz tudo ler de
`NEXT_PUBLIC_APP_URL`; se ela continuar apontando para o domínio inexistente, o
comportamento não melhora — só passa a ter um lugar só para corrigir.

---

## 4. GA4 e Meta Pixel — opcional, quando tiver as contas

O Vercel Analytics **já funciona sem nada configurado**: não usa cookie, não
precisa de conta nova, e começa a medir no próximo deploy. Veja em
Vercel → seu projeto → aba **Analytics**.

Os outros dois só entram quando você criar as contas:

1. **GA4** — em analytics.google.com, crie a propriedade e pegue o ID no formato
   `G-XXXXXXXXXX`.
2. **Meta Pixel** — em business.facebook.com → Gerenciador de Eventos, pegue o ID
   numérico.
3. Na Vercel, adicione:

```
NEXT_PUBLIC_GA_ID        = G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID = 000000000000
```

4. Redeploy.

**O que já está pronto para eles:** o banner de consentimento só carrega esses
dois scripts **depois** do visitante aceitar, e o disparo de evento é o mesmo
ponto (`lib/analytics/track.ts`) que já alimenta o Vercel. Você não precisa mexer
em tela nenhuma — só nas variáveis.

Sem os IDs, o banner ainda aparece e a escolha é gravada, mas nenhum script de
terceiro é carregado.

---

## O que continua fora do meu alcance

- **WAHA fora do ar.** `/api/v1/health` mostra `waha: down (fetch failed)`. É o
  que mantém o Inbox vazio e o agente "GL IA" publicado sem canal para responder.
  É infraestrutura: o servidor WAHA precisa voltar, ou a URL/API key precisa ser
  corrigida.
- **Os 18 produtos sem custo.** Todos com `filament_grams = 0` e
  `print_time_seconds = 0`. Nenhuma fórmula inventa o peso de uma peça. Preciso
  de uma das duas coisas: os números (peso em gramas e tempo de impressão por
  peça), ou o **STL de cada produto** subido em `/app/models` — aí o fatiador
  estima peso e tempo sozinho, que é o caminho mais rápido e o motivo de ele ter
  sido construído.
