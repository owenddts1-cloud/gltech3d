# Runbook — Catálogo de produtos

> Como operar o catálogo: custo real, mídia, canais de venda e vínculo com as
> vendas. Ordem importa — cada passo depende do anterior.

---

## O modelo mental (leia uma vez)

**`products` é UMA tabela só.** A mesma linha alimenta a tela de Produtos do CRM
e a vitrine pública. Não existe "cadastrar de novo na landing": cadastrou no CRM,
ligou o switch *Visível na landing* e definiu um preço, está no ar.

Isso vale para as fotos também — as imagens da aba Mídia **são** as imagens do
site. Não há upload separado.

Três grupos de campo, com destinos diferentes:

| Grupo | Onde aparece |
|---|---|
| Custo (gramas, tempo, filamento, impressora, insumos, margem) | Só no CRM. **Nunca** sai para a vitrine — a lista de colunas públicas é fechada em [repository.ts](../../lib/landing/repository.ts) |
| Vitrine (descrição, material, dimensões, cores, fotos, links) | Site público |
| Interno (observações, "geralmente quem compra", estoque) | Só no CRM |

---

## Passo 0 — Migrations (já aplicadas)

Quatro migrations sustentam este runbook. **Todas já estão no banco de produção**
— confirmado por consulta. Ficam listadas para quem clonar o repo:

| Migration | O que faz |
|---|---|
| `0069_products_buyer_profile` | Coluna `buyer_profile` (quem costuma comprar) |
| `0070_landing_settings_links_fallback` | Preenche os links da loja derivando do catálogo |
| `0071_v_products_costed_energy_key` | Converge a chave de energia na view SQL |
| `0072_product_sales_delta_trigger` | **Conserta o contador de vendas** — ver Passo 5 |
| `0073_products_model_source` | Origem do modelo (próprio/livre/terceiro) — ver abaixo |

Em clone novo: `npx supabase db push` (ou aplique o `supabase/baseline.sql`, que
já traz as quatro no apêndice). Todas são aditivas e idempotentes; a 0070 nunca
sobrescreve canal já configurado.

---

## Passo 1 — Filamentos e impressoras

`/app/printers`

Enquanto isto não estiver preenchido, **todo custo é R$ 0,00 e não há como não
ser** — a fórmula não tem de onde tirar o número.

- **Filamento**: o que importa é `custo por grama`, tirado da nota. É o que vira
  a linha "Material".
- **Impressora**: `potência (W)` e `depreciação (R$/h)`. Sem vincular uma
  impressora à peça, o sistema usa 200 W e R$ 0,40/h — funciona, mas não é o
  *seu* custo.
- **Tarifa de energia (R$/kWh)**: no dashboard. Default 0,85.

---

## Passo 2 — Custo das peças

`/app/products` → abrir a peça → aba **Custo**

O cabeçalho mostra quantas peças estão sem custo, e cada card ganha o selo
**"Custo pendente"** quando gramas ou tempo estão zerados. É a sua lista de
pendências.

O que digitar, e de onde sai:

| Campo | Fonte |
|---|---|
| Gramas | Slicer (estimativa de filamento) |
| Tempo (min) | Slicer (estimativa de impressão) |
| Filamento / Impressora | Cadastro do passo 1 |
| Insumos | Linha a linha: embalagem, ímã, tag, parafuso |
| Margem (%) | Sua decisão comercial |

**"Salvar e próxima →"** grava e já abre a peça seguinte *que ainda está
pendente*, com o cursor em Gramas. É o modo de percorrer as 18 sem tocar no
mouse. `Ctrl+Enter` também grava.

> Se o custo total continuar R$ 0,00 com gramas e tempo preenchidos, o filamento
> selecionado está sem custo/grama no cadastro.

**Sobre insumos:** o campo aceita várias linhas discriminadas. Antes tudo era
colapsado num único valor chamado "Insumos" — se você tiver peças com esse
rótulo genérico, elas continuam válidas; é só abrir e detalhar.

---

## Passo 3 — Vitrine e canais de venda

Aba **Vitrine**: descrição, endereço na loja (slug), material, dimensões, cores.
Peça criada no CRM já ganha um slug derivado do nome — você só mexe se quiser um
endereço específico.

Aba **Links**: deixe **vazio** para herdar o link da loja. O campo mostra em
cinza o que será herdado. Preencha só quando aquele anúncio tiver URL própria
(ex.: uma página específica na Shopee).

Os links da loja ficam em `/app/landing-edit` → **Links**. São eles que a 0070
preenche automaticamente.

---

## Passo 4 — Fotos e vídeos por pasta

A mídia vive no **Supabase Storage**, não no repositório: não incha o Git, não
exige deploy para trocar uma foto, e vídeo pesado não quebra o build.

Duas formas:

**Poucas fotos** → aba Mídia, botão de upload. A primeira imagem é a capa.

**Pastas inteiras** → `scripts/import-product-media.ts`. Organize assim:

```
media-import/
  luminaria-lua-cheia-alta-qualidade/    <- nome da pasta = slug da peça
    capa.png                             <- vira a capa (images[0])
    02.png
    10.png                               <- ordem numérica: 2 antes de 10
    demo.mp4                             <- vai para vídeos
```

```bash
# 1. Ver o que aconteceria, numa peça só
npx tsx scripts/import-product-media.ts --dry-run --only luminaria-lua-cheia-alta-qualidade

# 2. Aplicar só nela e conferir no site
npx tsx scripts/import-product-media.ts --only luminaria-lua-cheia-alta-qualidade

# 3. Rodada completa
npx tsx scripts/import-product-media.ts --dry-run
npx tsx scripts/import-product-media.ts
```

Se o nome da pasta não bater com nenhuma peça, **o script não adivinha**: ele
lista as pastas órfãs com os slugs mais parecidos. Resolva com um mapa:

```bash
# Propõe o mapa a partir das pastas que já existem em public/images
npx tsx scripts/import-product-media.ts --from-public
# salve a saída como media-map.json, revise, e:
npx tsx scripts/import-product-media.ts --root public/images --map media-map.json --dry-run
```

Detalhes que importam:
- **Re-rodar não duplica.** O caminho no Storage vem do hash do arquivo: mesmo
  conteúdo, mesmo caminho.
- **Não apaga o que você subiu pela tela.** O padrão só acrescenta o que falta;
  use `--replace` para trocar a lista inteira.
- Limite de 50 MB por arquivo. `.stl` e `.3mf` são ignorados com aviso.

---

## Passo 5 — Vincular as vendas já feitas

**Isto já está pronto no sistema — é só usar.**

`/app/sales` → abrir a venda → campo **Produto**.

### Antes de sair vinculando: nem toda venda é peça de catálogo

Vale conferir o que as vendas registradas realmente são. Na base atual, as 26
lançadas são quase todas **encomenda B2B sob medida** — chaveiro de paróquia, ímã
para microfone, letreiro, maxilar 3D, porta-polaroid — e nove estão descritas só
como "Peça 3D". **Nenhuma delas corresponde a uma peça do catálogo.**

Isso não é falha de cadastro; são dois negócios diferentes:

| | Onde vive | Contador |
|---|---|---|
| Serviço sob medida | O.S. (`/app/service-orders`) | não alimenta `sold_qty` de catálogo |
| Peça de catálogo (varejo) | Venda com produto vinculado | alimenta `sold_qty` |

**Vincule só quando a venda foi mesmo aquela peça do catálogo.** Forçar vínculo
para "preencher o número" produz um ranking de mais vendidos que não corresponde
a nada — e o pódio derivado passa a mentir na vitrine.

Enquanto o varejo não estiver lançado, o botão "Aplicar os 3 mais vendidos" fica
desabilitado de propósito. Nesse cenário o pódio manual é a escolha honesta.

O que realmente destrava o contador é **lançar as vendas de Shopee e Mercado
Livre** (as abas já existem) escolhendo a peça no ato — aí o número cresce sozinho
e vira dado real.

### O que você ganha em cada venda genuinamente vinculada

1. **Custo e margem reais** na venda, calculados do custo da peça.
2. **`sold_qty` sobe na hora em que você vincula**, se a venda já estiver *paga*
   ou *concluída*. É o que alimenta o ranking de mais vendidos.
3. **Estoque baixa junto.**

> **Isto só funciona a partir da migration 0072.** O gatilho original só reagia a
> *mudança de status*: vincular uma peça a uma venda que já estava paga não
> contava nada, e como venda histórica nasce `concluído`, o contador nunca subia.
> Ele também nunca descontava quando uma venda paga era cancelada ou apagada.
> Agora o gatilho calcula a diferença entre o antes e o depois, e cobre os seis
> casos: vincular, desvincular, trocar de peça, mudar quantidade, cancelar e
> apagar.

> Vincular só faz sentido depois do passo 2. Sem custo preenchido, a margem da
> venda aparece como 100%, que é o default, não a realidade.

**Sobre o estoque:** `sold_qty` é exato. `stock_qty` é *best-effort* — como a
coluna não pode ficar negativa, uma baixa que bateu no zero não é "lembrada", e
um estorno pode devolver mais do que tirou. Rastrear isso com precisão exigiria
uma tabela de movimentação de estoque, que não existe.

**Se desconfiar do contador:** `select public.fn_reconcile_product_sales(null);`
recalcula `sold_qty` a partir das vendas. Só toca peças com ao menos uma venda
vinculada — peça sem vínculo tem contador digitado à mão e não é zerada.

---

## Passo 6 — Catálogo no Instagram e no WhatsApp

Um arquivo só alimenta os três canais da Meta. **Não precisa de API nem de app
aprovado** — você cola uma URL no painel e a Meta busca sozinha.

```
https://SEU-DOMINIO/api/v1/public/feed/products.csv
```

Onde colar: **Commerce Manager › Catálogo › Fontes de dados › Feed agendado**.
Com o catálogo criado, você conecta a conta do Instagram (Instagram Shopping) e o
WhatsApp Business ao mesmo catálogo.

> **Antes de colar, confira `NEXT_PUBLIC_APP_URL` na Vercel** (Settings ›
> Environment Variables). É dela que saem os links e as URLs de imagem do feed.
> Precisa ser o domínio real, com `https://` e **sem barra no fim**. Se ficar em
> `http://localhost:3000`, a Meta recusa todos os itens.
>
> É variável `NEXT_PUBLIC_`, então é embutida no build: mudar exige **novo
> deploy**. Para conferir sem abrir o painel:
> `curl -s https://SEU-DOMINIO/api/v1/public/feed/products.csv | head -2`
> — a coluna `link` tem que mostrar o seu domínio.

Regras que o feed aplica sozinho:

- Só entra peça **publicada, com preço e com foto**. Hoje isso dá **10 das 18** —
  as 8 sem foto ficam de fora de propósito, porque entrariam como anúncio
  quebrado. Suba as fotos (passo 4) e elas entram sozinhas.
- Disponibilidade sai de `stock_qty`: com peça pronta vira *in stock*; sem, vira
  *available for order*. É a verdade de quem imprime sob demanda.
- Os cabeçalhos `X-Feed-Items` e `X-Feed-Skipped` dizem quantas entraram e
  quantas ficaram de fora, sem precisar abrir o arquivo.

**Catálogo nativo do WhatsApp pelo sistema não dá.** A integração atual (WAHA) só
envia texto — não tem catálogo, lista nem botão. O catálogo do WhatsApp vem do
mesmo feed da Meta, pelo app do WhatsApp Business. O que o sistema consegue
gerar é uma **mensagem por nicho**, com nome, preço e link de cada peça
(`buildNicheCatalogMessages` em `lib/landing/feed.ts`).

---

## Passo 7 — Ordem e pódio na vitrine

`/app/landing-edit`:

- **Ordem** — arraste as peças para definir a sequência do site. Cada arraste
  grava **uma linha só** (índice fracionário), então é instantâneo mesmo com
  catálogo grande. "Ordem A-Z" renumera tudo de uma vez.
- **Pódio** — os três blocos de "Mais Vendidos". O botão **"Aplicar os 3 mais
  vendidos"** troca a escolha manual pelo que as vendas dizem; ele fica
  desabilitado enquanto nenhuma venda estiver vinculada a peça (passo 5), em vez
  de aplicar um pódio de zeros.
- Nichos, textos das seções, banners, links da loja e comissões por plataforma.

> A edição de **peça** não fica mais aqui — é tudo em `/app/products`. Esta tela
> cuida da *página*: ordem, destaque e texto.

---

## Origem do modelo — antes de pensar em vender arquivo

Aba **Interno** › **Origem do modelo**.

Vender a peça **impressa** e distribuir o **arquivo STL** são coisas
juridicamente diferentes. Um pack de arquivos é obra derivada redistribuída, e
boa parte do catálogo é de personagem licenciado (Batman, Charizard, Naruto,
Banguela, Toy Story). Marcar a origem transforma "o que pode entrar no pack" numa
consulta, em vez de uma decisão tomada de memória a cada vez.

| Valor | Significa | Pode distribuir o arquivo? |
|---|---|---|
| Modelo próprio | Modelado por você | Sim |
| Licença livre | CC-BY, CC0, domínio público | Sim, respeitando a licença (anote em "Licença / fonte") |
| De terceiro | Sem permissão de redistribuir | **Não** |
| Não classificado | Ainda não avaliado — **é o padrão** | Não |

**As 18 peças nascem "Não classificado"**, de propósito: classificar o catálogo
seria afirmar um dado jurídico no seu lugar. A marcação é sua, peça a peça.

Quando quiser montar o pack, o filtro é `model_source in ('proprio','livre')`.
Nada mais do produto digital existe ainda — nem entrega de arquivo ao cliente,
nem cobrança (o sistema não tem gateway de pagamento nenhum).

---

## Quando algo parece errado

| Sintoma | Causa quase certa |
|---|---|
| Preço sugerido R$ 0,00 | Gramas ou tempo zerados; ou filamento sem custo/grama |
| Margem 100% em tudo | É o default da coluna — ninguém definiu ainda |
| "Defina um preço de venda para publicar" | Switch da landing ligado sem preço |
| Peça não aparece no site | `Visível na landing` desligado, ou sem preço |
| Editei e o site não mudou | Cache com tag; salvar pelo CRM já revalida. Se persistir, force um deploy |
| Foto quebrada no site | `npx tsx scripts/fix-local-media-paths.ts --dry-run` |
| Card sem botão de compra | Links da loja vazios — veja o passo 0 (migration 0070) e `/app/landing-edit` → Links |

### Consertar caminho de foto quebrado

```bash
npx tsx scripts/fix-local-media-paths.ts --dry-run   # mostra e não grava
npx tsx scripts/fix-local-media-paths.ts             # aplica
```

Só corrige quando o nome do arquivo tem **exatamente uma** correspondência em
`public/`. Ambíguo ou inexistente, ele reporta e não toca — não adivinha.

---

## O que ainda não existe

- **Produto digital**: não há entrega de arquivo ao cliente, licença nem
  cobrança. O sistema não tem gateway de pagamento nenhum. A migration 0073
  entrega só a base de dados (origem do modelo).
- **Catálogo nativo do WhatsApp pelo sistema**: a integração atual só envia
  texto. O catálogo vem do feed da Meta, pelo app do WhatsApp Business.
- **Envio de mídia pelo WhatsApp**: o schema aceita `media_url`, mas o despacho
  manda só texto. Mandar foto ainda é manual.
- **Integração com a API do Instagram**: não existe. O que existe é o feed.
- **Vínculo peça ↔ filamento é 1:1.** Peça multi-material precisa ser aproximada
  pelo filamento principal + insumos multi-linha.
- **`category_id`** existe como FK mas a tela grava só o texto do nicho.
- **Movimentação de estoque**: `stock_qty` é um saldo, não um histórico — por
  isso é best-effort (ver Passo 5).

