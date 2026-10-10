# Master Plan V2: Bot de Ofertas Multi-Nicho & Multi-Marketplace no GLTECH CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o motor completo V2 de Bot de Ofertas de Afiliados Multi-Nicho e Multi-Marketplace no GLTECH CRM, incluindo agendador contínuo com aquecimento rápido (2 a 15 min), reciclagem inteligente de fila, scrapers para 5 marketplaces, cópias criativas com tutoriais de cupons e central de resgate, boas-vindas automáticas para novos membros no WhatsApp Baileys, e gestão visual por nichos na paleta Clay.

**Architecture:** 
- O frontend no Next.js (App Router) expõe o dashboard em `/automations/ofertas` com abas para criação, edição modal inline, planilha multifacetada com filtros de nicho e tags de marketplace, simulador de WhatsApp real com watermark GLTech3D, conexões multi-nicho e controle do motor anti-ban.
- Rotas API em `app/api/bot-ofertas/*` gerenciam o CRUD estendido, re-scraping de ofertas para atualização de preços, e envio direto ou agendado.
- O daemon em `services/bot_ofertas/` executa o Baileys com detecção de novos membros para disparar boas-vindas, agendador com jitter dinâmico de 2 a 15 min e rodízio quando a fila esvaziar, além de scrapers resilientes com axios/cheerio para Mercado Livre, Amazon, Shopee, AliExpress e TikTok Shop.

**Tech Stack:** Next.js 15, TypeScript, TailwindCSS (Clay palette `#38241b`, `#ea580c`, `#fdba74`), React Phosphor/Lucide icons, @whiskeysockets/baileys v7, Cheerio, Axios, Vitest.

**Spec:** Master Prompt V2 e exemplos de mensagens do grupo `GLTech Ofertas - Impressão 3D`.

## Global Constraints
- Paleta oficial Clay mantida em todos os novos componentes (`#38241b`, `#462f25`, `#ea580c`, `#f97316`, `#faf9f6`, `#fdba74`).
- Nenhuma alteração disruptiva em tabelas, rotas ou módulos existentes do CRM (Produção, Vendas, Financeiro, Clientes, Suprimentos).
- Marca oficial: "GLTech Ofertas - Impressão 3D" e marca d'água "GLTech3D" (nunca nomes de concorrentes).
- Tolerância a falhas na Vercel: leitura com fallback em JSON quando o daemon local Baileys estiver offline.
- Execução isolada do daemon via `npm run bot` ou serviço em segundo plano.

## Review Focus
1. Oferta sem imagem ou com link inválido: o formatador e o envio devem efetuar fallback limpo para texto sem quebrar o socket.
2. Fila zerada no agendador com modo rodízio ativo: selecionar a oferta ativa com envio mais antigo (`dispatchedAt` menor) sem causar repetição em looping imediato.
3. Novo membro entrando no grupo: Baileys deve disparar mensagem de boas-vindas somente se habilitado e no grupo configurado, marcando o JID sem duplicar mensagens.
4. Re-scraping de links expirados ou protegidos por captcha: a API deve retornar erro amigável sem sobrescrever os dados existentes do produto.
5. Filtro conjugado na tabela (nicho + marketplace + busca + status): a filtragem não pode causar render em branco se campos forem nulos.

---

### Task 1: Expansão do Modelo de Dados & Configurações Multi-Nicho
**Files:**
- Modify: `components/bot-ofertas/types.ts`
- Modify: `lib/bot-engine/client.ts`
- Modify: `services/bot_ofertas/src/services/storage.js`
- Test: `tests/bot-ofertas/storage.test.ts`

**Interfaces:**
- Consumes: interfaces atuais de `OfferItem` e `BotConfigData`.
- Produces: `OfferItem` com `niche`, `marketplace`, `couponHubUrl`, `copyStyle`, `status` (`pendente` | `enviado` | `pausado` | `esgotado`), `recycledCount`, `lastDispatchedAt`.
- Produces: `BotConfigData` com `minIntervalMinutes` (default 2), `maxIntervalMinutes` (default 15), `recycleMode` (boolean), `welcomeMessageEnabled` (boolean), `welcomeGroupName` (string), `nicheGroups` (Record de nicho para grupo JID e canal Telegram), `marketplacesCouponHubs`.

- [ ] **Step 1: Escrever teste de unidade para storage V2**
```typescript
import { describe, it, expect } from "vitest";
import storage from "@/services/bot_ofertas/src/services/storage";

describe("Storage V2 Multi-Niche & Multi-Marketplace", () => {
  it("salva e recupera oferta com nicho, marketplace e couponHubUrl", () => {
    const offer = storage.addOffer({
      title: "Filamento PETG Masterprint",
      category: "Filamentos 3D",
      niche: "impressao_3d",
      marketplace: "shopee",
      couponHubUrl: "https://sshopee.me/GMNE98tfdo4yYUpL",
      promoPrice: 62.27,
      status: "pendente"
    });
    expect(offer.niche).toBe("impressao_3d");
    expect(offer.marketplace).toBe("shopee");
  });
});
```

- [ ] **Step 2: Executar teste e validar falha inicial**
Run: `npx vitest run tests/bot-ofertas/storage.test.ts`
Expected: FAIL (campos ausentes ou teste novo).

- [ ] **Step 3: Implementar types e persistência em `types.ts`, `client.ts` e `storage.js`**
Adicionar os novos campos com valores padrão retrocompatíveis para ofertas existentes.

- [ ] **Step 4: Executar teste e validar aprovação**
Run: `npx vitest run tests/bot-ofertas/storage.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add components/bot-ofertas/types.ts lib/bot-engine/client.ts services/bot_ofertas/src/services/storage.js tests/bot-ofertas/storage.test.ts
git commit -m "feat(bot-ofertas): expand data models for multi-niche, multi-marketplace and config"
```

---

### Task 2: Formatador V2: Cópias Criativas, Tutoriais de Cupom e Boas-Vindas
**Files:**
- Modify: `lib/bot-engine/formatter.ts`
- Modify: `services/bot_ofertas/src/services/formatter.js`
- Test: `tests/bot-ofertas/formatter.test.ts`

**Interfaces:**
- Consumes: `OfferItem`, dados de cupom e canais.
- Produces: `formatOfferMessage(offer, options)` com suporte a estilos criativos (`padrao`, `achado`, `cupom_mes`, `urgencia`), tutorial de cupom, link para central de cupons do marketplace, e branding oficial GLTech Ofertas.
- Produces: `formatWelcomeMessage(phone, groupName)` gerando a mensagem de boas-vindas do GLTech Ofertas.
- Produces: `detectMarketplace(url)` e `getDefaultCouponHub(marketplace)`.

- [ ] **Step 1: Escrever testes para as cópias criativas e mensagem de boas-vindas**
```typescript
import { describe, it, expect } from "vitest";
import { formatOfferMessage, formatWelcomeMessage, detectMarketplace } from "@/lib/bot-engine/formatter";

describe("Formatter V2", () => {
  it("detecta marketplace a partir de links meli, shopee, amazon", () => {
    expect(detectMarketplace("https://melila.me/abc")).toBe("mercadolivre");
    expect(detectMarketplace("https://sshopee.me/xyz")).toBe("shopee");
    expect(detectMarketplace("https://amzn.to/123")).toBe("amazon");
  });

  it("gera mensagem de boas-vindas oficial do GLTech Ofertas", () => {
    const text = formatWelcomeMessage("5513988389028", "GLTech Ofertas - Impressão 3D");
    expect(text).toContain("Bem-vindo @5513988389028 ao GLTech Ofertas - Impressão 3D!");
    expect(text).toContain("Filamentos");
    expect(text).toContain("Sem spam");
  });

  it("inclui link da central de cupons quando fornecido", () => {
    const msg = formatOfferMessage({
      title: "Filamento PLA",
      promoPrice: 100,
      coupon: "10OFF",
      marketplace: "shopee",
      couponHubUrl: "https://sshopee.me/cupons"
    });
    expect(msg).toContain("Sempre resgate todos os cupons disponíveis aqui: https://sshopee.me/cupons");
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npx vitest run tests/bot-ofertas/formatter.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar funções em `lib/bot-engine/formatter.ts` e sincronizar em `services/bot_ofertas/src/services/formatter.js`**
Criar os templates criativos, o detector de URLs, e a formatação com avisos de cupom e tutorial de resgate.

- [ ] **Step 4: Executar testes de unidade do formatador**
Run: `npx vitest run tests/bot-ofertas/formatter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/bot-engine/formatter.ts services/bot_ofertas/src/services/formatter.js tests/bot-ofertas/formatter.test.ts
git commit -m "feat(bot-ofertas): add creative copy templates, coupon hubs and welcome message formatter"
```

---

### Task 3: Scraper Universal Multi-Marketplace (5 Plataformas) & Atualização Contínua
**Files:**
- Modify: `services/bot_ofertas/src/services/scraper.js`
- Modify: `app/api/bot-ofertas/scrape/route.ts`
- Create: `app/api/bot-ofertas/offers/[id]/refresh/route.ts`
- Test: `tests/bot-ofertas/scraper.test.ts`

**Interfaces:**
- Consumes: URLs de Mercado Livre, Amazon, Shopee, AliExpress, TikTok Shop.
- Produces: `{ title, imageUrl, originalPrice, promoPrice, marketplace, couponHubUrl, warning? }`.
- Produces: Endpoint `POST /api/bot-ofertas/offers/[id]/refresh` que re-consulta a URL original e atualiza a oferta.

- [ ] **Step 1: Escrever teste de unidade para detecção e limpeza de metadados dos marketplaces**
```typescript
import { describe, it, expect } from "vitest";
import { cleanTitle, detectPlatformFromUrl } from "@/services/bot_ofertas/src/services/scraper";

describe("Scraper Multi-Marketplace Helpers", () => {
  it("limpa sufixos de títulos de todas as 5 plataformas", () => {
    expect(cleanTitle("Filamento PLA 1kg - Mercado Livre")).toBe("Filamento PLA 1kg");
    expect(cleanTitle("Alicate de Corte | Amazon.com.br")).toBe("Alicate de Corte");
    expect(cleanTitle("Hotend Creality - Shopee Brasil")).toBe("Hotend Creality");
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npx vitest run tests/bot-ofertas/scraper.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar suporte expandido em `scraper.js` e a rota `offers/[id]/refresh`**
Adicionar User-Agents rotativos, resolução de URLs encurtadas (`meli.la`, `amzn.to`, `sshopee.me`, `s.click.aliexpress.com`), extração por OpenGraph e JSON-LD, e rota para re-scraping e atualização de preço no banco.

- [ ] **Step 4: Executar testes de unidade do scraper**
Run: `npx vitest run tests/bot-ofertas/scraper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add services/bot_ofertas/src/services/scraper.js app/api/bot-ofertas/scrape/route.ts app/api/bot-ofertas/offers/[id]/refresh/route.ts tests/bot-ofertas/scraper.test.ts
git commit -m "feat(bot-ofertas): add 5-marketplace universal scraper and offer price refresh route"
```

---

### Task 4: Agendador de Aquecimento Rápido (2 a 15 Min), Modo Rodízio & Boas-Vindas Baileys
**Files:**
- Modify: `services/bot_ofertas/src/services/scheduler.js`
- Modify: `services/bot_ofertas/src/services/whatsapp.js`
- Modify: `app/api/bot-ofertas/config/route.ts`
- Test: `tests/bot-ofertas/scheduler.test.ts`

**Interfaces:**
- Consumes: `BotConfigData` (intervalos de 2 a 15 min, flags `recycleMode`, `welcomeMessageEnabled`).
- Produces: Jitter dinâmico rápido recalculado a cada disparo, modo rodízio quando não houver pendentes, e evento `group-participants.update` no Baileys para recepção de novos membros.

- [ ] **Step 1: Escrever teste de unidade para o motor de rodízio e jitter do agendador**
```typescript
import { describe, it, expect } from "vitest";
import scheduler from "@/services/bot_ofertas/src/services/scheduler";

describe("Scheduler Fast Warming & Recycling Mode", () => {
  it("calcula próximo intervalo entre minInterval e maxInterval", () => {
    const nextInterval = scheduler.calculateNextIntervalMs(2, 15);
    expect(nextInterval).toBeGreaterThanOrEqual(2 * 60 * 1000);
    expect(nextInterval).toBeLessThanOrEqual(15 * 60 * 1000);
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npx vitest run tests/bot-ofertas/scheduler.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar intervalo rápido, reciclagem e listener de boas-vindas**
No `scheduler.js`, implementar `calculateNextIntervalMs`, lógica de recuperação da oferta enviada há mais tempo quando fila zerar, e no `whatsapp.js` registrar o hook `sock.ev.on('group-participants.update')` que dispara a mensagem formatada de boas-vindas ao grupo.

- [ ] **Step 4: Executar testes de unidade do agendador**
Run: `npx vitest run tests/bot-ofertas/scheduler.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add services/bot_ofertas/src/services/scheduler.js services/bot_ofertas/src/services/whatsapp.js app/api/bot-ofertas/config/route.ts tests/bot-ofertas/scheduler.test.ts
git commit -m "feat(bot-ofertas): implement 2-15 min fast warming scheduler, recycle mode and welcome listener"
```

---

### Task 5: Interface: Modal de Edição Completa, Filtros Multifacetados e Atualização de Preço
**Files:**
- Create: `components/bot-ofertas/EditarOfertaModal.tsx`
- Modify: `components/bot-ofertas/PlanilhaFilaTable.tsx`
- Modify: `app/automations/ofertas/_components/BotOfertasClient.tsx`
- Test: `tests/bot-ofertas/PlanilhaFilaTable.test.tsx`

**Interfaces:**
- Consumes: `offers: OfferItem[]`, callbacks `onRefresh`, `onEdit`, `onDispatch`, `onDelete`.
- Produces: Tabela com tags de marketplace (Todos, Mercado Livre, Amazon, Shopee, AliExpress, TikTok), filtro de nicho, status completo (`pendente`, `enviado`, `pausado`, `esgotado`), botão de re-scraping com spinner ("🔄") e modal `EditarOfertaModal` com edição individual de título, preços, cupom, links e estilo.

- [ ] **Step 1: Escrever teste de renderização e filtros para PlanilhaFilaTable**
```typescript
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { PlanilhaFilaTable } from "@/components/bot-ofertas/PlanilhaFilaTable";

describe("PlanilhaFilaTable V2", () => {
  it("renderiza tags de marketplace e filtro de nicho", () => {
    render(
      <PlanilhaFilaTable
        offers={[]}
        onDispatch={async () => {}}
        onDelete={async () => {}}
        onEdit={() => {}}
        onRefresh={async () => {}}
      />
    );
    expect(screen.getByText("Mercado Livre")).toBeDefined();
    expect(screen.getByText("Shopee")).toBeDefined();
  });
});
```

- [ ] **Step 2: Executar teste e verificar falha**
Run: `npx vitest run tests/bot-ofertas/PlanilhaFilaTable.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Criar `EditarOfertaModal.tsx` e atualizar `PlanilhaFilaTable.tsx` e `BotOfertasClient.tsx`**
Implementar o modal com paleta Clay, as tags selecionáveis de marketplace, o dropdown de nicho, e a integração com o endpoint de atualização de preço individual.

- [ ] **Step 4: Executar testes de componente**
Run: `npx vitest run tests/bot-ofertas/PlanilhaFilaTable.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add components/bot-ofertas/EditarOfertaModal.tsx components/bot-ofertas/PlanilhaFilaTable.tsx app/automations/ofertas/_components/BotOfertasClient.tsx tests/bot-ofertas/PlanilhaFilaTable.test.tsx
git commit -m "feat(bot-ofertas): add edit offer modal, marketplace tag filters and live price refresh"
```

---

### Task 6: Interface: Nova Oferta, Mockup Real com Watermark, Anti-Ban & Conexões Multi-Nicho
**Files:**
- Modify: `components/bot-ofertas/NovaOfertaForm.tsx`
- Modify: `components/bot-ofertas/WhatsAppMockupPreview.tsx`
- Modify: `components/bot-ofertas/AntiBanSettings.tsx`
- Modify: `components/bot-ofertas/ConexoesManager.tsx`
- Test: `npm run typecheck`

**Interfaces:**
- Consumes: dados atualizados de `formData`, `config`, `status`.
- Produces: Seletores de nicho, marketplace, estilo de copy e link de cupons em `NovaOfertaForm`; Mockup de smartphone com balão realista escuro (`#202c33`), watermark `GLTech3D`, cabeçalho `GLTech Ofertas - Impressão 3D` e preview de cupom em `WhatsAppMockupPreview`; Configurações do range de 2 a 15 min, modo rodízio e toggle de mensagem de boas-vindas em `AntiBanSettings`; Mapeamento de grupos de WhatsApp e Telegram por nicho em `ConexoesManager`.

- [ ] **Step 1: Atualizar `NovaOfertaForm.tsx` e `WhatsAppMockupPreview.tsx`**
Integrar os campos de nicho, marketplace, tutorial de cupons e central de resgate, e renderizar a prévia fidedigna do WhatsApp com a watermark `GLTech3D`.

- [ ] **Step 2: Atualizar `AntiBanSettings.tsx` e `ConexoesManager.tsx`**
Adicionar controles de range de 2 a 15 minutos, rodízio de ofertas, mensagem de boas-vindas automatizada e tabela de vinculação de nichos para grupos específicos.

- [ ] **Step 3: Executar typecheck e vitest geral**
Run: `npm run typecheck && npx vitest run`
Expected: 0 errors, all tests pass.

- [ ] **Step 4: Commit e Push**
```bash
git add components/bot-ofertas/NovaOfertaForm.tsx components/bot-ofertas/WhatsAppMockupPreview.tsx components/bot-ofertas/AntiBanSettings.tsx components/bot-ofertas/ConexoesManager.tsx
git commit -m "feat(bot-ofertas): integrate multi-niche connections, 2-15m warming controls and rich WhatsApp preview"
```

---

### Task 7: Verificação Final End-to-End e Deploy em Produção
**Files:**
- Verify: Todas as rotas do CRM e novo módulo de ofertas
- Test: `npm run build` ou `npm run typecheck` + verificação de integridade

- [ ] **Step 1: Executar verificação estrita de TypeScript e testes**
Run: `npm run typecheck`
Expected: Clean exit code 0.

- [ ] **Step 2: Verificar integridade de rotas existentes**
Verificar se `/automations`, `/login`, e demais módulos do CRM continuam íntegros e sem erros.

- [ ] **Step 3: Commit final e push para a branch `main`**
```bash
git push origin main
```
Verificar status de deploy na Vercel e registrar confirmação de sucesso.
