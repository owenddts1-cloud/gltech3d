# Integração do Módulo Bot de Ofertas no GLTECH CRM

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrar o sistema completo do Bot de Ofertas (WhatsApp Baileys & Telegram) na rota `/automations/ofertas` do GLTECH CRM, com submenu expansível na sidebar e paleta Clay, sem quebrar nenhuma página existente.

**Architecture:** O Next.js fornece a interface React completa e fluida (Nova Oferta com Scraper e Preview WhatsApp ao vivo, Planilha/Fila com CSV, WhatsApp & Canais QR Code, Anti-Ban & Horários, Histórico) estilizada com a paleta Clay. Rotas de API em `app/api/bot-ofertas/*` comunicam-se com o serviço de persistência e com o daemon Baileys do bot (`services/bot_ofertas`). A navegação no CRM (`nav-crm.ts`) ganha o grupo `Automações` contendo `Workflows n8n` e `Bots de Ofertas`.

**Tech Stack:** Next.js 15 (App Router), TypeScript, TailwindCSS (Clay palette), React Lucide / Phosphor Icons, Baileys v7, Cheerio/Axios, Express daemon.

**Spec:** `services/bot_ofertas/PROMPT_INTEGRACAO_GLTECH_CRM.md`

## Global Constraints
- Sidebar: Manter paleta Clay `#38241b`, indicador `#ea580c` / `#f97316`, fundo `#483025`, texto `#fdba74`.
- Rotas existentes: Nunca quebrar `/app/*`, `/automations`, `/login`, etc.
- Compatibilidade Vercel Serverless: O Next.js não pode travar no build se o daemon local do Baileys não estiver rodando; deve ter fallback de leitura de dados e detecção de status offline com aviso orientativo.
- Script de inicialização: Adicionar `"bot": "node services/bot_ofertas/server.js"` ao `package.json` raiz.

---

### Task 1: Atualização da Sidebar e Navegação do CRM
**Files:**
- Modify: `components/shell/nav-crm.ts`
- Modify: `components/shell/Sidebar.tsx`
- Test: `components/shell/Sidebar.test.tsx`

- [ ] **Step 1: Atualizar `components/shell/nav-crm.ts`**
Transformar o item `Automações (n8n)` em grupo `Automações` (`key: "automacoes"`) com sub-itens:
  - `Workflows n8n` (`/automations`)
  - `Bots de Ofertas` (`/automations/ofertas`)
- [ ] **Step 2: Ajustar `components/shell/Sidebar.tsx`**
Garantir que grupos ativos abram por padrão (`open[group.key] ?? groupActive`) para navegação direta suave.
- [ ] **Step 3: Executar testes de unidade da Sidebar**
Comando: `npx vitest run components/shell/Sidebar.test.tsx`

---

### Task 2: Rotas de API do Bot de Ofertas (`app/api/bot-ofertas/*`)
**Files:**
- Create: `app/api/bot-ofertas/status/route.ts`
- Create: `app/api/bot-ofertas/connect/route.ts`
- Create: `app/api/bot-ofertas/groups/route.ts`
- Create: `app/api/bot-ofertas/offers/route.ts`
- Create: `app/api/bot-ofertas/offers/[id]/route.ts`
- Create: `app/api/bot-ofertas/dispatch/route.ts`
- Create: `app/api/bot-ofertas/scrape/route.ts`
- Create: `app/api/bot-ofertas/config/route.ts`
- Create: `app/api/bot-ofertas/history/route.ts`
- Create: `lib/bot-engine/client.ts`

- [ ] **Step 1: Criar cliente utilitário `lib/bot-engine/client.ts`**
Helper que conecta ao daemon do bot (porta 3005 / `process.env.BOT_OFERTAS_PORT || 3000`) e lê/grava fallback nos arquivos JSON em `services/bot_ofertas/data` se o daemon não responder.
- [ ] **Step 2: Implementar as rotas de API**
Proxy e fallback para status, connect, groups, offers CRUD, dispatch, scrape, config e history.

---

### Task 3: Componentes e Interface React do Bot de Ofertas (`/automations/ofertas`)
**Files:**
- Create: `components/bot-ofertas/types.ts`
- Create: `components/bot-ofertas/WhatsAppMockupPreview.tsx`
- Create: `components/bot-ofertas/NovaOfertaForm.tsx`
- Create: `components/bot-ofertas/PlanilhaFilaTable.tsx`
- Create: `components/bot-ofertas/ConexoesManager.tsx`
- Create: `components/bot-ofertas/AntiBanSettings.tsx`
- Create: `components/bot-ofertas/HistoricoView.tsx`
- Create: `app/automations/ofertas/page.tsx`
- Create: `app/automations/ofertas/_components/BotOfertasClient.tsx`
- Modify: `app/automations/layout.tsx` (garantir suporte a AppShell / navegação consistente)

- [ ] **Step 1: Criar types e formatação de deals**
- [ ] **Step 2: Criar componentes de UI com a paleta oficial Clay**
- [ ] **Step 3: Montar a página unificada em `/automations/ofertas` com abas dinâmicas**

---

### Task 4: Script no `package.json`, Typecheck e Verificação
**Files:**
- Modify: `package.json`
- Test: `npm run typecheck`
- Test: `npx vitest run`

- [ ] **Step 1: Adicionar scripts `"bot"` e `"bot:dev"` no `package.json` raiz**
- [ ] **Step 2: Executar typecheck e vitest**
- [ ] **Step 3: Commit e push para deploy**
