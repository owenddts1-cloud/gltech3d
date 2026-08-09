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

## Passo 0 — Aplicar as migrations pendentes

**Faça isto antes de tudo.** Três migrations acompanham esta entrega e ainda não
foram aplicadas:

| Migration | O que faz | Se não aplicar |
|---|---|---|
| `0069_products_buyer_profile` | Cria a coluna `buyer_profile` | O campo "Geralmente quem compra" dá erro ao salvar |
| `0070_landing_settings_links_fallback` | Preenche os links da loja | Peça nova entra na vitrine sem botão de compra |
| `0071_v_products_costed_energy_key` | Corrige a chave de energia na view SQL | Nada visível — a view não tem consumidor |

```bash
npx supabase db push          # pede a senha do banco
```

As três são aditivas e idempotentes. A 0070 **nunca sobrescreve** canal já
configurado. Nenhuma apaga dado.

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

Vendas novas já saem vinculadas (o seletor está no diálogo de nova venda). O que
falta é passar nas vendas antigas.

O que você ganha em cada venda vinculada:

1. **Custo e margem reais** na venda, calculados do custo da peça.
2. **`sold_qty` sobe sozinho** quando o status vira *pago* ou *concluído* — um
   gatilho no banco cuida disso. É o que alimenta o ranking de mais vendidos.
3. **Estoque baixa sozinho** na mesma transição.

> Vincular só faz sentido depois do passo 2. Sem custo preenchido, a margem da
> venda aparece como 100%, que é o default, não a realidade.

---

## Passo 6 — Ordem e pódio na vitrine

`/app/landing-edit`: pódio de mais vendidos, nichos, textos das seções, banners
e comissões por plataforma.

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

## Ordenação da Vitrine

- **Aba Ordem em `/app/landing-edit`**: Permite reordenar a sequência exata em que as peças aparecem na vitrine do site via **Drag & Drop** ou botões de seta. Atualiza a coluna `sort_order` no banco via Server Action `reorderLandingProducts`.

---

## O que ainda não existe

- **Vínculo peça ↔ filamento é 1:1.** Peça multi-material precisa ser aproximada pelo filamento principal + insumos multi-linha.
- **`category_id`** existe como FK mas a tela grava só o texto do nicho.

