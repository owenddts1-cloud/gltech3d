# Plano de Implementação: Landing Page, Catálogo & Ecossistema de E-mails GLTech3D

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as 4 refatorações de layout e arquitetura da landing page (Navbar pill fix, Top 3 configurável, galeria 8 itens com fade-out, catálogo `/produtos`, carrossel de filamentos com fallback, revalidação em tempo real no CRM) e o ecossistema completo de captação de leads e e-mails transacionais (redefinição de senha de ponta a ponta, orçamento com notificação WhatsApp para diretoria e auto-resposta, newsletter com boas-vindas imediato e template modular de campanhas).

**Architecture:** Abordagem modular com Next.js App Router (Server e Client Components desacoplados), Server Actions e Route Handlers tipados com Zod, templates inline HTML/text para e-mail com entrega resiliente via Resend e fallback Nodemailer/SMTP, e revalidação de tags/caminhos sem cache preso.

**Tech Stack:** Next.js 15 (App Router), React 18, Tailwind CSS, Motion, Lucide React, Zod, Resend, Nodemailer, Supabase Auth/DB.

**Spec:** `docs/superpowers/specs/2026-10-07-landing-catalog-and-email-ecosystem-design.md`

## Global Constraints

- Preserve todas as regras de segurança existentes: `lib/auth/public-paths.ts` controla o bypass do middleware; rotas públicas novas devem ser adicionadas lá.
- Nenhum dado de custo (ex: `filament_grams`, `margin_pct`) pode ser exposto em rotas ou componentes públicos.
- Todos os templates de e-mail devem incluir obrigatoriamente versões em HTML com CSS inline e texto puro (`text`).
- O sistema de envio deve prioritariamente usar Resend (`RESEND_API_KEY`) e fallback automático para SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`).
- Tipografia oficial: Fontes `Sora` (títulos) e `Inter` (corpo/dados) com a paleta da marca (`brand-espresso`, `brand-bronze`, `brand-bone`, `brand-sand`).

## Review Focus

1. **Token de Redefinição Expirado ou Alterado:** O endpoint e a tela `/redefinir-senha` devem recusar tokens com mais de 1 hora ou adulterados sem causar erro 500.
2. **Fallback de Filamentos sem Quebrar Props:** Os dados de fallback de filamentos devem satisfazer o tipo `PublicFilament` sem campos nulos inesperados.
3. **Fade-out sem Bloquear Cliques no Botão CTA:** O gradiente da galeria da Home deve ter `pointer-events-none` e o botão centralizado `pointer-events-auto`.
4. **Resolução de Pódio sem Produtos Suficientes:** Se o banco ou o config tiverem menos de 3 produtos, o componente não deve estourar erro e deve preencher graciosamente.
5. **Prevenção de Spam no Envio de E-mails:** Os formulários públicos devem validar o input com Zod e sanitizar telefones e mensagens.

---

### Task 1: Correção do Overflow na Navbar (Pill/Cápsula)

**Files:**
- Modify: `components/marketing/Navbar.tsx:135-275`

**Interfaces:**
- Produces: Layout da cápsula com padding lateral refinado garantindo que o botão "Entrar" não encavale na borda arredondada.

- [ ] **Step 1: Ajustar espaçamento do container e botões de ação na Navbar**
Em `components/marketing/Navbar.tsx`, ajustar as classes da barra cápsula (`scrolled || isOpen`) para garantir padding seguro (`px-5 sm:px-7`) e no container flex direito adicionar `pr-1` e `gap-2.5` para conter perfeitamente o botão "Entrar" dentro da borda.
- [ ] **Step 2: Verificar visualmente e garantir ausência de quebras de layout**
Verificar se os botões "Calc3D PRO" e "Entrar" permanecem visualmente contidos em telas desktop e mobile.
- [ ] **Step 3: Commit**
```bash
git add components/marketing/Navbar.tsx
git commit -m "fix(navbar): refine pill container padding and prevent action buttons overflow"
```

---

### Task 2: Pódio "Mais Vendidos" (Top 3 Configurável & Persistente)

**Files:**
- Create: `lib/landing/bestsellers-config.ts`
- Modify: `components/marketing/ProductGrid.tsx:300-345`

**Interfaces:**
- Produces: `bestSellersConfig` exportado com slugs configuráveis, resolução dinâmica no `ProductGrid` e exibição ininterrupta do pódio.

- [ ] **Step 1: Criar arquivo de configuração `lib/landing/bestsellers-config.ts`**
Exportar a interface `BestSellersConfig` e a constante `defaultBestSellersConfig` com os slugs padrão dos 3 colocados.
- [ ] **Step 2: Ajustar resolução do pódio em `ProductGrid.tsx`**
Atualizar `ProductGrid.tsx` para resolver os 3 produtos a partir do banco (`bestsellerRank`), com fallback para `defaultBestSellersConfig` buscando por slug nos produtos, e alterar `showPodium` para `Boolean(champion)` para manter o pódio sempre visível independentemente de filtros.
- [ ] **Step 3: Testar renderização do pódio**
Executar teste de tipo para garantir contratos válidos.
- [ ] **Step 4: Commit**
```bash
git add lib/landing/bestsellers-config.ts components/marketing/ProductGrid.tsx
git commit -m "feat(landing): make bestsellers top 3 configurable by slug and keep podium visible"
```

---

### Task 3: Galeria da Home Compacta (8 Itens) com Fade-out e CTA

**Files:**
- Modify: `components/marketing/ProductGrid.tsx:340-375`

**Interfaces:**
- Produces: Galeria da Home limitada a 8 itens, máscara de gradiente cobrindo da metade da 2ª fileira para baixo e botão "Ver mais produtos" direcionando para `/produtos`.

- [ ] **Step 1: Limitar produtos renderizados na Home e adicionar container relativo com fade-out**
Em `ProductGrid.tsx`, limitar a renderização da grade para `displayProducts = filteredProducts.slice(0, 8)`. Adicionar overlay `bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/85 to-transparent pointer-events-none` a partir da metade da segunda fileira.
- [ ] **Step 2: Adicionar botão CTA centralizado sobre o gradiente**
Inserir botão destacado "Ver mais produtos" com ícone de seta, `pointer-events-auto`, link para `/produtos` e classes de hover da GLTech3D.
- [ ] **Step 3: Commit**
```bash
git add components/marketing/ProductGrid.tsx
git commit -m "feat(landing): compact home gallery to 8 items with smooth fade-out mask and cta"
```

---

### Task 4: Nova Página Dedicada de Catálogo (`/produtos`)

**Files:**
- Create: `app/(marketing)/produtos/page.tsx`
- Create: `app/(marketing)/produtos/ProdutosClient.tsx`
- Modify: `lib/auth/public-paths.ts`

**Interfaces:**
- Consumes: `getLandingCatalog()` de `lib/landing/repository.ts`
- Produces: Rota pública `/produtos` com busca em tempo real, filtros por nichos, breadcrumb e SEO.

- [ ] **Step 1: Liberar rota pública em `lib/auth/public-paths.ts`**
Adicionar `/^\/produtos(\/.*)?$/` à lista de `PUBLIC_PATHS` para evitar redirecionamento pelo middleware.
- [ ] **Step 2: Criar Client Component `ProdutosClient.tsx`**
Implementar busca instantânea por nome/categoria, chips de nichos com contadores, contagem total de modelos e grade responsiva completa com `ProductCard`.
- [ ] **Step 3: Criar Server Component `page.tsx` em `app/(marketing)/produtos/`**
Buscar o catálogo com `getLandingCatalog()`, renderizar header com breadcrumb `Início / Produtos`, título H1 otimizado para SEO, e metadata completa com OpenGraph.
- [ ] **Step 4: Commit**
```bash
git add lib/auth/public-paths.ts app/\(marketing\)/produtos/
git commit -m "feat(catalog): create dedicated /produtos page with real-time search and category filters"
```

---

### Task 5: Carrossel Interativo de Filamentos com Fallback Técnico

**Files:**
- Create: `lib/filament-catalog/fallback-filaments.ts`
- Create: `components/marketing/filaments/FilamentCarousel.tsx`
- Modify: `components/marketing/filaments/FilamentsHomeSection.tsx`

**Interfaces:**
- Produces: Carrossel com scroll snap horizontal, setas com estado disabled nas extremidades, suporte a drag/touch, 6–8 amostras de fallback e link "Ver catálogo de filamentos".

- [ ] **Step 1: Criar dados de demonstração em `lib/filament-catalog/fallback-filaments.ts`**
Exportar `FALLBACK_FILAMENTS: PublicFilament[]` contendo 6 a 8 itens realistas (PLA Premium Preto, Branco, Silk Bronze, PETG Cinza, TPU 95A, etc.).
- [ ] **Step 2: Criar componente `FilamentCarousel.tsx`**
Implementar container com scroll horizontal, botões circulares anterior/próximo com detecção de extremidades (`canScrollLeft`, `canScrollRight`), scroll snap e suporte a arraste com o mouse.
- [ ] **Step 3: Atualizar `FilamentsHomeSection.tsx`**
Integrar `FilamentCarousel`, carregar `FALLBACK_FILAMENTS` se a lista estiver vazia, posicionar os cards com micro-interações de hover e adicionar botão inferior "Ver catálogo de filamentos" apontando para `/filamentos`.
- [ ] **Step 4: Commit**
```bash
git add lib/filament-catalog/fallback-filaments.ts components/marketing/filaments/
git commit -m "feat(filaments): add interactive horizontal carousel with fallback spools and micro-animations"
```

---

### Task 6: Revalidação de Cache em Tempo Real no CRM e Indicador de Top 8

**Files:**
- Modify: `app/actions/filament-catalog/actions.ts`
- Modify: `app/actions/landing/actions.ts`
- Modify: `app/app/(pro)/landing-edit/_components/OrderPanel.tsx`

**Interfaces:**
- Produces: Purga imediata de cache sob demanda nas mutações do CRM e visualização clara do Top 8 no painel de ordem.

- [ ] **Step 1: Adicionar revalidação em `app/actions/filament-catalog/actions.ts`**
Criar helper `refreshFilaments()` que chama `revalidateLanding()`, `revalidatePath("/")`, `revalidatePath("/produtos")`, `revalidatePath("/filamentos")` e invocá-lo em todas as mutações (`createFilament`, `updateFilament`, `deleteFilament`, `reorderFilaments`, `publishFilament`, `setFilamentAvailability`).
- [ ] **Step 2: Atualizar `refresh()` em `app/actions/landing/actions.ts`**
Incluir `revalidatePath("/produtos")` e `revalidatePath("/")` para invalidar a Home e a nova rota de produtos.
- [ ] **Step 3: Adicionar demarcação visual do Top 8 em `OrderPanel.tsx`**
Inserir divisor visual e badge indicando claramente quais são os 8 produtos da vitrine da Home versus o restante do catálogo.
- [ ] **Step 4: Commit**
```bash
git add app/actions/filament-catalog/actions.ts app/actions/landing/actions.ts app/app/\(pro\)/landing-edit/_components/OrderPanel.tsx
git commit -m "fix(crm): add real-time cache revalidation for filaments/products and top 8 indicator in order panel"
```

---

### Task 7: Fluxo Completo de Redefinição de Senha

**Files:**
- Create: `app/api/auth/forgot-password/route.ts`
- Create: `app/(public)/redefinir-senha/page.tsx`
- Modify: `lib/email/templates/password-reset.ts`

**Interfaces:**
- Consumes: `findUserIdByEmail` de `lib/auth/admin-users.ts`, `signPasswordResetToken` de `lib/auth/password-reset-token.ts`
- Produces: Endpoint `/api/auth/forgot-password`, e-mail escuro com link `https://gltech3d.vercel.app/redefinir-senha?token={TOKEN}` e página `/redefinir-senha` que lê query param `token`.

- [ ] **Step 1: Criar rota `/api/auth/forgot-password/route.ts`**
Validar e-mail com Zod, buscar usuário no Supabase Auth, gerar token HMAC com validade de 1 hora, disparar e-mail transacional via `sendEmail()` e auditar a ação.
- [ ] **Step 2: Criar página `/app/(public)/redefinir-senha/page.tsx`**
Ler `searchParams.token`, verificar o token via `verifyPasswordResetToken(token)` e renderizar `ResetPasswordForm` (ou mensagem amigável de link inválido/expirado).
- [ ] **Step 3: Ajustar template em `lib/email/templates/password-reset.ts`**
Garantir layout escuro/tech moderno alinhado com a identidade da GLTech3D, com botão destacado para `/redefinir-senha?token={token}` e versão em texto puro.
- [ ] **Step 4: Commit**
```bash
git add app/api/auth/forgot-password/ app/\(public\)/redefinir-senha/page.tsx lib/email/templates/password-reset.ts
git commit -m "feat(auth): implement complete password reset flow with token query param support and branded email"
```

---

### Task 8: Formulário de Orçamento da Home, Notificação WhatsApp & Auto-resposta

**Files:**
- Create: `app/api/orcamento/route.ts`
- Modify: `lib/email/templates/lead-notify.ts`
- Modify: `lib/email/templates/lead-welcome.ts`
- Modify: `components/marketing/LeadForm.tsx`

**Interfaces:**
- Produces: Endpoint `/api/orcamento`, e-mail para a Diretoria com botão direto de resposta no WhatsApp, e-mail de auto-resposta para o cliente e integração no `LeadForm.tsx`.

- [ ] **Step 1: Refinar templates de e-mail de notificação e auto-resposta**
Em `lead-notify.ts`, incluir layout de ficha técnica limpa e botão direto do WhatsApp `https://wa.me/55{telefone}`. Em `lead-welcome.ts`, reforçar a mensagem cordial com contatos oficiais.
- [ ] **Step 2: Criar rota `/api/orcamento/route.ts`**
Validar dados (nome, e-mail, telefone, mensagem), salvar lead em `contacts`, disparar e-mail para diretoria e auto-resposta para o cliente via `after()`.
- [ ] **Step 3: Atualizar `LeadForm.tsx`**
Ajustar `onSubmit` para postar em `/api/orcamento` (com fallback para `/api/v1/public/leads`) com tratamento de erro e toasts.
- [ ] **Step 4: Commit**
```bash
git add app/api/orcamento/ lib/email/templates/lead-notify.ts lib/email/templates/lead-welcome.ts components/marketing/LeadForm.tsx
git commit -m "feat(leads): add quote endpoint with direct whatsapp reply email for directors and client auto-reply"
```

---

### Task 9: Inscrição na Newsletter & E-mail de Boas-Vindas

**Files:**
- Create: `app/api/newsletter/subscribe/route.ts`
- Modify: `lib/email/templates/newsletter-welcome.ts`
- Modify: `components/marketing/NewsletterBar.tsx`

**Interfaces:**
- Produces: Endpoint `/api/newsletter/subscribe` anti-duplicidade, e-mail imediato de boas-vindas com links para catálogo e redes, e integração no `NewsletterBar.tsx`.

- [ ] **Step 1: Atualizar template `newsletter-welcome.ts`**
Incluir links para `/produtos`, `/filamentos`, Instagram `@gltech3d` e WhatsApp em versão HTML inline e texto puro.
- [ ] **Step 2: Criar rota `/api/newsletter/subscribe/route.ts`**
Validar e-mail, inserir no CRM com tag `newsletter` (tratando duplicatas via idempotência), disparar e-mail de boas-vindas e registrar audit log.
- [ ] **Step 3: Atualizar `NewsletterBar.tsx`**
Postar para `/api/newsletter/subscribe` e exibir feedback tátil de sucesso.
- [ ] **Step 4: Commit**
```bash
git add app/api/newsletter/subscribe/ lib/email/templates/newsletter-welcome.ts components/marketing/NewsletterBar.tsx
git commit -m "feat(newsletter): add dedicated subscribe endpoint and instant welcome email"
```

---

### Task 10: Template Modular de Campanhas de E-mail Marketing

**Files:**
- Create: `lib/email/templates/newsletter-campaign.ts`
- Create: `tests/unit/newsletter-campaign.test.ts`

**Interfaces:**
- Produces: Função `buildNewsletterCampaignEmail(options)` que gera e-mails completos com cabeçalho, bloco de 3 destaques, material da semana, CTA de projeto STL e rodapé com opt-out.

- [ ] **Step 1: Criar teste de unidade em `tests/unit/newsletter-campaign.test.ts`**
Validar que a função gera HTML e texto puro contendo todos os blocos e links obrigatórios.
- [ ] **Step 2: Implementar `buildNewsletterCampaignEmail` em `lib/email/templates/newsletter-campaign.ts`**
Estruturar o template modular com design responsivo, CSS inline, suporte a itens dinâmicos e opt-out.
- [ ] **Step 3: Executar testes de unidade**
Run: `pnpm test:unit tests/unit/newsletter-campaign.test.ts`
Expected: PASS
- [ ] **Step 4: Commit**
```bash
git add lib/email/templates/newsletter-campaign.ts tests/unit/newsletter-campaign.test.ts
git commit -m "feat(email): create modular marketing campaign email template with products and filament highlights"
```

---

### Task 11: Metatags de SEO e Validação Final do Build

**Files:**
- Modify: `app/(marketing)/produtos/page.tsx`
- Modify: `app/(marketing)/filamentos/page.tsx`

**Interfaces:**
- Produces: Metatags completas de SEO (Title, Description, Canonical, OpenGraph, Twitter) e validação de types em todo o projeto.

- [ ] **Step 1: Revisar metatags de SEO em `/produtos` e `/filamentos`**
Garantir tags otimizadas para "Impressão 3D sob demanda", "Modelos 3D", "Filamentos para Impressora 3D" e imagens OpenGraph.
- [ ] **Step 2: Rodar verificação de tipos (`typecheck`)**
Run: `pnpm typecheck`
Expected: Exit 0 sem erros de tipo.
- [ ] **Step 3: Commit**
```bash
git add app/\(marketing\)/produtos/page.tsx app/\(marketing\)/filamentos/page.tsx
git commit -m "seo: enhance metadata and opengraph tags for catalog and filaments pages"
```
