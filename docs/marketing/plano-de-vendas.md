# Plano de vendas GLTech3D (out/2026 a set/2027)

Três linhas de receita: **peças/produtos**, **revenda de filamento** (nova) e **Calc3D PRO** (SaaS, R$ 89/ano por Pix). O plano parte do que já existe no repo e aponta onde está a fricção. Preços de filamento ficam como `R$ X`: preencha com a tabela real.

---

## 1. Diagnóstico do site e do funil

**O que já ajuda a vender**

- `/calc3d-pro` é a página mais forte. A calculadora grátis entrega valor antes de pedir cadastro, e o trial de 7 dias sem cartão (`/criar-conta`) leva direto ao CRM. R$ 89/ano (`lib/pricing/pro-plans.ts`) sai por cerca de R$ 7,42/mês.
- Na home, o GL ROCKET (`HeroScrollVideo.tsx`) diferencia a marca. O pódio de mais vendidos (`ProductGrid`), o `LeadForm` e a `NewsletterBar` captam contato.
- `/product/[slug]` tem preço, Shopee/ML/WhatsApp e JSON-LD, e todas as páginas de produto estão no sitemap. `/orcamento` com upload de STL é um bom gancho para peça técnica.
- `lib/analytics/track.ts` já respeita a LGPD.

**O que atrapalha**

1. **A prova social é fictícia.** `SocialProof.tsx` publica 3 depoimentos marcados no código como "SÃO EXEMPLOS". Isso é risco de publicidade enganosa (CDC art. 37). Troque por depoimentos reais ou esconda a seção.
2. **A medição está quase cega.** `track()` só dispara no `WhatsAppFloat` e no `LeadForm`. Ficam sem evento: "Comprar Agora" e "Pedir pelo WhatsApp" do produto, "SOLICITAR ORÇAMENTO", `TrialCta` e o Pix.
3. **O `/catalogo` está órfão.** Fica fora do `sitemap.ts` e da `Navbar`, usa outra identidade visual (escuro com âmbar, contra o bege da marca) e mostra o botão do WhatsApp duas vezes.
4. **A marca aparece duplicada no título** de `/orcamento`, `/tecnologias` e `/catalogo` ("— GLTech3D | GLTech3D").
5. **O trial não tem nutrição.** O único e-mail de trial (`trial-started.ts`) vai para o dono. O cliente passa 7 dias sem receber nada.
6. **O PRO promete mais do que entrega.** `PlansBlock` vende "Marketplaces" e "Inbox", mas os pedidos de marketplace são lançados à mão e a Inbox depende do WAHA (`estado-dos-modulos.md`). Ajuste a copy antes de pagar tráfego.
7. **As linhas de receita não se cruzam.** A calculadora pede "Preço do filamento" e não vende filamento. Produto e orçamento não sugerem nada depois.

---

## 2. Posicionamento e público

| Linha | Posicionamento | Persona principal | Dor | Gatilho de compra |
|---|---|---|---|---|
| Peças/produtos | "Acabamento de loja, feito em MG, enviado para o Brasil" | **Carla, 34, cliente final**: compra presente pelo Instagram | Peça "com cara de impressora", prazo | Foto real, prazo, frete claro |
| Peças técnicas | "Do STL à peça funcional, ±0,1 mm" | **Marcos, 41, manutenção/oficina** | Peça que não existe para comprar | Orçamento em minutos |
| Filamento | "Testado na nossa produção, em 3 linhas" | **Lucas, 22, hobbista**: 1 Bambu/Ender, 1 a 2 rolos/mês | Rolo úmido, frete caro | Cor em estoque, kit |
| Filamento atacado | "Preço de farm sem mínimo absurdo" | **Rafael, 30, farm de 3 a 8 máquinas**: Shopee, 10 a 30 kg/mês | Margem, falta de cor | Tabela de atacado, lote constante |
| Calc3D PRO | "Pare de chutar preço. R$ 89 por ano" | **Rafael** e **Júlia, 27, lojista Shopee/ML** | Vende e não sabe se lucra | A calculadora revela o prejuízo |

O filamento abre a porta para o maker, o PRO o mantém por perto e a peça vende para o cliente final. O Lucas de hoje é o Rafael de amanhã.

---

## 3. Funil Calc3D PRO

### Aquisição

- **SEO.** Keywords: calculadora impressão 3D, quanto cobrar por impressão 3D, como precificar impressão 3D, custo de energia impressora 3D, planilha de custo impressão 3D, preço por grama impressão 3D, margem de lucro impressão 3D. As páginas estão na seção 7.
- **YouTube e Reels.** Faça ao vivo a conta de uma peça real ("Chaveiro de 12 g: cobrei R$ 5 e perdi dinheiro"). O CTA é sempre "calculadora grátis no link".
- **Grupos de Facebook e WhatsApp de makers.** Ajude antes de vender: responda a dúvida de preço com o print da anatomia do custo e mande o link da calculadora, nunca o do PRO.
- **Parcerias.** Pequenos canais de impressão 3D ganham trial de 60 dias para a audiência e R$ 20 por PRO pago. Com lojas de peças de impressora, troque links.

### Ativação no trial (e-mails a construir; hoje não existem)

Meta de ativação: **cadastrar 1 impressora + 1 filamento + 1 produto com custo** até o dia 2.

| Dia | Assunto | Copy (2 linhas) |
|---|---|---|
| 0 | Seu Calc3D PRO está aberto. Faça isso primeiro | Cadastre sua impressora e o rolo que está nela agora: leva 3 minutos. A partir daí, todo produto sai com o custo real calculado sozinho. |
| 2 | Quanto você ganha de verdade no seu produto mais vendido? | Cadastre o item que mais sai na Shopee e compare o lucro real com o que você imaginava. Em 9 de cada 10 casos a energia e o desgaste estavam de fora. |
| 5 | Faltam 2 dias. Seus dados ficam, o cadeado vem | No dia 8 os módulos PRO travam, mas nada é apagado. Um Pix de R$ 89 libera o ano inteiro, menos de R$ 7,50 por mês. |
| 7 | Último dia do teste: um Pix e você segue de onde parou | Pague o Pix e declare em Plano e cobrança, e a liberação sai no mesmo dia. Se não fizer sentido, responda este e-mail e conte o porquê: eu leio todos. |

Complemente com WhatsApp manual no dia 3 para quem não cadastrou nada (lista em `/admin/assinantes`, filtro "Em trial").

### Conversão

- **Âncora** no `PlansBlock`: "Uma impressão de 200 g que falha já custa um terço do plano anual."
- **Garantia:** "30 dias ou o Pix de volta". Vai além dos 7 dias do CDC art. 49 e tira o medo de pagar sem cartão.
- **Prova:** prints do Dashboard real da GLTech3D e 3 depoimentos de testadores (PRO grátis para 5 makers em troca de depoimento com nome e @).
- **Fricção:** "Liberação em até 2 h, das 8h às 22h". A aprovação pelo e-mail já permite cumprir isso.

### Retenção e renovação

- **E-mail mensal:** "Seu mês no Calc3D: X vendas, R$ Y de lucro".
- **Renovação:** avisos em D-30, D-7 e D-0 por e-mail e WhatsApp. Como renovar soma os dias em vez de resetar, o argumento é "renove agora, não perde nada".
- **Desconto em filamento:** assinante PRO tem 5% no filamento o ano todo.

---

## 4. Filamentos

- **Linhas:** Comum para protótipo, Plus+ para o dia a dia (PLA+, PETG) e Premium (seda, mármore, carbono).
- **Kits** com cerca de 8% de desconto sobre o avulso:
  - "Kit Starter 3 cores" (Comum: preto, branco, cinza).
  - "Kit Presente" (3 cores seda).
  - "Kit Funcional" (PETG preto e branco).
- **Combo de entrada:** "Primeiro rolo + 60 dias de Calc3D PRO" pelo preço do rolo. O bônus tem custo marginal zero e coloca o maker dentro do CRM.
- **Frete:** grátis a partir de 3 rolos no Sudeste e de 5 no restante do Brasil (ajuste à regra real). Retirada grátis em BH. Mostre o frete no carrinho do WhatsApp antes de fechar.
- **Recompra:** registre a venda no CRM. No dia 30 (hobbista) ou no dia 15 (farm), mande pelo WhatsApp: "Oi Lucas, o PLA+ preto deve estar no fim. Separo outro do mesmo lote?" Envie à mão, respeitando o throttle anti-ban.
- **Cross-sell com a calculadora:** quick win 1 (seção 9).
- **Conteúdo:**
  - Guia de temperaturas.
  - PLA x PLA+ x PETG.
  - Como secar filamento sem estufa.
  - Quantos metros tem 1 kg.

  Todo guia termina em "Comprar este filamento" e "Calcular o custo da peça".
- **Atacado para farms:**
  - O PDF sem preço vai para os grupos.
  - A tabela de atacado (10, 25 e 50 kg/mês) só sai pelo WhatsApp, depois de qualificar quantas impressoras e quantos kg/mês a farm usa.
  - Pedido mensal recorrente trava o preço por 90 dias.

---

## 5. Peças e produtos

- **Vitrine:** use a mesma identidade visual na home e no `/catalogo`. Cada produto precisa de 1 foto em contexto (estante, mão).
- **Orçamento rápido:** inclua no `/orcamento` a opção "Não tenho arquivo, quero mandar foto", que abre o WhatsApp. Responda em até 2 h no horário comercial.
- **Prova social real:** envie junto com a peça um cartão com QR: "Poste com @gltech3d e ganhe 10% na próxima". Republique e use no `SocialProof` com autorização por escrito (pelo WhatsApp já vale).

**Sazonais (próximos 12 meses)**

| Data | Ocasião | Começar campanha | Corte de produção/envio |
|---|---|---|---|
| 12/10/2026 | Dia das Crianças | já (só pronta-entrega) | 08/10 |
| 31/10/2026 | Halloween | 13/10 | 26/10 |
| 27/11/2026 | Black Friday (Cyber Monday 30/11) | 03/11 (lista de espera) | estoque pronto até 20/11 |
| 25/12/2026 | Natal | 23/11 | último envio nacional 14/12; BH 20/12 |
| 09/02/2027 | Carnaval | 18/01 | 01/02 |
| 15/03/2027 | Dia do Consumidor | 01/03 | — |
| 28/03/2027 | Páscoa | 01/03 | 19/03 |
| 09/05/2027 | Dia das Mães | 12/04 | 30/04 |
| 12/06/2027 | Dia dos Namorados | 17/05 | 04/06 |
| 08/08/2027 | Dia dos Pais | 12/07 | 30/07 |
| 15/09/2027 | Dia do Cliente | 01/09 | — |
| 12/10/2027 | Dia das Crianças | 14/09 | 04/10 |

**A Black Friday vale para as três linhas:** kit de filamento, peça presente e Calc3D PRO com 2 anos por R$ 149. Esse último depende de um novo `ProPlanId` em `pro-plans.ts`.

---

## 6. Instagram, Reels e TikTok: 12 pautas

| # | Pauta | Hook (texto na tela / primeira fala) |
|---|---|---|
| 1 | O GL ROCKET explodindo em camadas (o vídeo do hero, na vertical) | "Esse foguete tem 47 peças. Todas saíram daqui." (use a contagem real) |
| 2 | Montagem do GL ROCKET em timelapse | "Do fatiador ao lançamento em 60 segundos" |
| 3 | Preço real de uma peça na calculadora | "Você cobra R$ 5 nesse chaveiro? Você está pagando para trabalhar." |
| 4 | Peça que falhou e quanto custou | "Essa falha me custou R$ 18. Eis como eu cobro isso do cliente." |
| 5 | PLA x PETG x PLA+ no teste de calor (carro ao sol) | "Deixei 3 peças no painel do carro. Só uma voltou inteira." |
| 6 | Teste de queda e flexão por linha de filamento | "Rolo de R$ X contra rolo de R$ Y: vale a diferença?" |
| 7 | Unboxing de pedido de cliente (com autorização) | "A Carla pediu uma luminária. Olha como ela chegou." |
| 8 | Bastidores da farm às 23h | "4 impressoras, 1 pessoa, zero planilha" |
| 9 | Peça técnica que salvou uma máquina | "Essa peça não existia para comprar. Desenhamos em 2 horas." |
| 10 | Erros de iniciante com filamento úmido | "Seu PETG faz fio de aranha? Não é a temperatura." |
| 11 | Peças do GL ROCKET em cores de filamento diferentes | "Escolha a cor do próximo GL ROCKET nos comentários" (gera engajamento e mostra o catálogo de cores) |
| 12 | Tour de 30 s pelo Calc3D PRO | "Minha farm inteira cabe nessa tela. R$ 89 por ano." |

Poste 3 Reels por semana (terça, quinta e sábado, às 19h) e o mesmo vídeo no TikTok. O link da bio deve apontar para uma página `/links` do próprio site, para aparecer no Vercel Analytics.

---

## 7. SEO: 15 páginas prioritárias

| URL | Keyword | Title | Meta description |
|---|---|---|---|
| `/calc3d-pro` | calculadora impressão 3D | Calculadora de Custo de Impressão 3D Grátis | Filamento, energia, desgaste e margem da sua peça em segundos. Grátis, sem cadastro. |
| `/calc3d-pro/quanto-cobrar` | quanto cobrar por impressão 3D | Quanto Cobrar por Impressão 3D: Guia + Calculadora | Precifique sem chute: custo por grama, hora de máquina, falha e margem. |
| `/calc3d-pro/custo-energia` | custo energia impressora 3D | Quanto Gasta de Energia uma Impressora 3D? | Consumo de Bambu, Ender e Prusa em kWh e o peso disso no preço. Calcule com a sua tarifa. |
| `/calc3d-pro/planilha` | planilha custo impressão 3D | Planilha de Custo de Impressão 3D (e algo melhor) | Baixe a planilha ou use a calculadora que já soma energia, desgaste e falha. |
| `/filamentos` | comprar filamento 3D | Filamento para Impressora 3D: PLA, PETG e PLA+ | Linhas Comum, Plus+ e Premium testadas na nossa produção. Cores em estoque, pedido pelo WhatsApp. |
| `/filamentos/pla` | filamento PLA 1kg | Filamento PLA 1,75 mm 1 kg: Cores e Preço | Diâmetro consistente, cores em estoque, kits e envio para todo o Brasil. |
| `/filamentos/petg` | filamento PETG | Filamento PETG 1,75 mm: Cores e Preço | Para peças funcionais e calor. Cores, temperatura recomendada e kits. |
| `/filamentos/pla-plus` | PLA+ | Filamento PLA+: Mais Resistente que o PLA | Menos frágil, mesmo acabamento. Compare com o PLA e escolha a cor. |
| `/filamentos/guia-de-temperaturas` | temperatura PLA PETG | Temperatura de Impressão: PLA, PETG, PLA+ e ABS | Bico, mesa e ventilação por material, e como resolver fios e warping. |
| `/filamentos/pla-vs-petg` | PLA ou PETG | PLA ou PETG: Qual Filamento Usar? | Resistência, calor, acabamento e preço em testes reais. |
| `/filamentos/atacado` | filamento atacado | Filamento no Atacado para Farms de Impressão 3D | Tabela por volume mensal, lote constante, preço travado por 90 dias. |
| `/orcamento` | impressão 3D sob encomenda | Orçamento de Impressão 3D Online pelo STL | Envie o STL/3MF e receba a estimativa na hora. Envio para o Brasil. |
| `/catalogo` | presentes impressão 3D | Presentes e Decoração em Impressão 3D | Luminárias, colecionáveis e peças exclusivas sob demanda. Peça pelo WhatsApp. |
| `/tecnologias` | tipos de filamento | Tipos de Filamento 3D: Tabela Comparativa | PLA, PETG, ABS e TPU por resistência, calor e acabamento. |
| `/` | impressão 3D BH | Impressão 3D em BH com Envio para Todo o Brasil | Peças decorativas, funcionais e personalizadas. Orçamento rápido pelo WhatsApp. |

Confirme a cidade antes de publicar (o DDD 31 indica BH).

---

## 8. Métricas e metas (revisão semanal, 20 min, segunda-feira)

| Métrica | Fonte | Meta inicial (30 dias) |
|---|---|---|
| Visitantes únicos em `/`, `/calc3d-pro`, `/filamentos` e `/catalogo` | Vercel Analytics (páginas) | Linha de base na semana 1 e depois +15% por mês |
| `click_whatsapp` por origem | Vercel Analytics (eventos) | ≥ 4% dos visitantes |
| `submit_orcamento` | Vercel Analytics | ≥ 10 por mês |
| Trials iniciados | E-mail "trial começou" e `/admin/assinantes` | 20 no mês |
| Trial ativado (impressora + produto cadastrados) | `/admin/assinantes` + Dashboard da org | ≥ 50% |
| Trial → PRO pago | `/admin/pro-signups` | ≥ 15% (3 PRO no mês) |
| Vendas e receita por linha | CRM Vendas + Relatórios (canal / categoria) | Linha de base |
| Recompra de filamento em 45 dias | CRM Vendas (cliente com 2 compras) | ≥ 30% |
| Ticket médio de peça | Relatórios | Linha de base |

Para medir isso, os eventos `click_comprar`, `click_marketplace` e `submit_orcamento` precisam de fato ser disparados nas telas, e é preciso acrescentar `start_trial`, `submit_pix` e `click_filamento` ao `AnalyticsEvent`. Classifique cada venda no CRM com a categoria "Peça", "Filamento" ou "PRO", senão o relatório não separa as linhas.

---

## 9. Top 10 ações para os próximos 30 dias

| # | Ação | Impacto | Esforço |
|---|---|---|---|
| 1 | Tirar os depoimentos de exemplo e publicar 3 reais (ou esconder a seção) | Alto (confiança + risco legal) | 1 h |
| 2 | Instrumentar `track()` em Comprar, WhatsApp do produto, orçamento, trial e Pix | Alto (sem isso nada é medido) | 0,5 dia |
| 3 | **Quick win 1:** "Comprar este filamento" na calculadora | Alto | ≤ 1 dia |
| 4 | Sequência de 4 e-mails do trial (seção 3) via Resend + cron | Alto | 1 a 2 dias |
| 5 | Lançar `/filamentos` com selos e carrinho de WhatsApp, e colocar `/catalogo` e `/filamentos` na navbar e no sitemap | Alto | Em andamento |
| 6 | **Quick win 2:** oferta de filamento depois do pedido de peça e do orçamento | Médio | ≤ 1 dia |
| 7 | **Quick win 3:** selos "Mais vendido" e "Últimas unidades" | Médio | ≤ 1 dia |
| 8 | Ajustar a copy do PRO (marketplaces/inbox), incluir a garantia de 30 dias e corrigir os títulos duplicados | Médio | 2 h |
| 9 | 12 Reels (seção 6), 3 por semana, começando pelo GL ROCKET e pela "conta do chaveiro" | Médio a alto | Contínuo |
| 10 | Montar o kit de Black Friday (filamento, peça presente e PRO de 2 anos) e abrir a lista de espera em 03/11 | Alto (sazonal) | 1 dia |

### Quick wins de produto (≤ 1 dia cada)

**1. "Comprar este filamento" na calculadora**
- **Onde:** `app/(marketing)/calc3d-pro/_components/CalculatorBlock.tsx`, abaixo do campo "Preço do filamento" (por volta da linha 170) e ao lado de "Transformar isso em venda no PRO".
- **Copy:**
  - Abaixo do campo: `Sem filamento ou pagando caro? Ver PLA, PETG e PLA+ a partir de R$ X/kg →` (link para `/filamentos`).
  - No card de resultado: botão secundário `Comprar o filamento desta peça`, que abre o WhatsApp com `Olá! Calculei uma peça de {peso} g no Calc3D e quero o filamento. Quais cores vocês têm em estoque?`
- **Evento:** `click_filamento` com `{ origem: "calculadora" }`.

**2. Oferta de filamento depois do pedido de peça ou do orçamento**
- **Onde:** no modal de "Comprar Agora" em `app/(marketing)/product/[id]/ProductActions.tsx` e logo abaixo do botão "SOLICITAR ORÇAMENTO" em `app/(marketing)/orcamento/_OrcamentoClient.tsx`.
- **Copy:** `Também imprime em casa? O filamento que usamos nesta peça está à venda, testado na nossa produção. Ver cores →` (link para `/filamentos`). No orçamento, use a variante: `Prefere imprimir você mesmo? Calcule o custo grátis no Calc3D →` (link para `/calc3d-pro#calculadora`).

**3. Selos "Mais vendido" e "Últimas unidades"**
- **Onde:** nos cards do `ProductGrid` (o campeão e os demais do pódio já vêm de `catalog.bestsellers`), nos cards de `/filamentos` e em `/product/[slug]`, perto do preço.
- **Copy:**
  - `Mais vendido` (top 3 do pódio).
  - `Últimas {n} unidades` (estoque de 3 ou menos).
  - `Volta em breve · Me avise no WhatsApp` (sem estoque), que abre o WhatsApp com `Oi! Me avisa quando o {produto/cor} voltar?`
- **Cuidado:** use só dados reais de estoque e de vendas. Selo de escassez falso é o mesmo problema do item 1.
