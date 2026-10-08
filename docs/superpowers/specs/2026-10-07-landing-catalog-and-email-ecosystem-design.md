# Especificação Técnica: Refatoração Landing Page, Catálogo & Ecossistema de E-mails GLTech3D

**Data:** 2026-10-07  
**Status:** Aprovado para Implementação  
**Escopo:** Frontend (Next.js App Router, Tailwind CSS, Motion), Backend (Server Actions, Route Handlers), E-mails Transacionais (Resend, Nodemailer) e SEO  

---

## 1. Visão Geral e Objetivos

Este projeto implementa melhorias de alta prioridade na plataforma **GLTech3D** (gltech3d.vercel.app):
1. **Refatoração Visual e Arquitetural da Landing Page:**
   - Correção de layout e padding na Navbar superior (Pill/Cápsula) no botão "Entrar".
   - Pódio "Mais Vendidos" (Top 3) desacoplado via configuração e mantido sempre visível durante a navegação.
   - Redução da galeria da Home para 8 itens com máscara de gradiente fade-out e CTA centralizado para `/produtos`.
   - Criação da página dedicada `/produtos` com busca em tempo real e filtros de nichos.
   - Carrossel horizontal interativo de filamentos posicionado imediatamente acima de "O Fatiador Digital", com suporte a drag/touch e fallback de amostras técnicas de filamentos.
   - Sincronização e revalidação de cache instantânea no CRM (Landing Edit e Gestão de Filamentos).
2. **Ecossistema Completo de E-mails Transacionais e Leads:**
   - Fluxo real de redefinição de senha (`/esqueci-senha` ➔ `/api/auth/forgot-password` ➔ E-mail transacional ➔ `/redefinir-senha?token=...`).
   - Formulário de orçamento com notificação imediata da Diretoria (layout de ficha técnica + botão WhatsApp) e auto-resposta acolhedora para o cliente.
   - Inscrição em Newsletter com e-mail de boas-vindas instantâneo.
   - Template modular para campanhas de marketing recorrentes.
   - Metatags de SEO e OpenGraph ricas para todas as páginas públicas.

---

## 2. Especificação Arquitetural e de Componentes

### 2.1. Navbar Superior (Pill/Cápsula) — Correção de Overflow
- **Arquivo:** `components/marketing/Navbar.tsx`
- **Problema:** Quando scrolled/ativo, o container arredondado (`rounded-[2rem]`) com `py-3 px-6` causa aperto ou leve encavalamento do botão "Entrar" na borda direita em certas resoluções.
- **Ajuste:**
  - Ajustar o container flex da direita (`flex items-center gap-2.5 shrink-0 pr-1`).
  - Garantir padding interno seguro nas laterais (`px-5 sm:px-7`) e margem de respiro para que os botões "Calc3D PRO" e "Entrar" fiquem 100% contidos na curvatura sem encavalar.

### 2.2. Seção "Mais Vendidos" (Top 3 Configurável & Persistente)
- **Arquivos:**
  - `lib/landing/bestsellers-config.ts` (Novo)
  - `components/marketing/ProductGrid.tsx`
- **Contrato de Configuração (`BestSellersConfig`):**
  ```ts
  export interface BestSellersConfig {
    championSlug?: string;
    secondSlug?: string;
    thirdSlug?: string;
  }
  export const defaultBestSellersConfig: BestSellersConfig = {
    championSlug: "luminaria-lua-cheia-alta-qualidade",
    secondSlug: "charizard-articulavel",
    thirdSlug: "base-carregadora-relogio-apple-watch",
  };
  ```
- **Lógica de Resolução:**
  1. Se existirem itens configurados no banco com `bestseller_rank` (1, 2, 3), eles são utilizados prioritariamente.
  2. Se não houver ou faltar posições, busca pelos slugs de `bestSellersConfig` nos produtos carregados.
  3. Fallback para itens com flag `is_top` ou primeiros produtos da ordem.
- **Persistência Visual:**
  - Em `ProductGrid.tsx`, alterar `const showPodium = Boolean(champion);` (removendo a checagem que ocultava o pódio caso houvesse filtro de busca ou nicho ativo).

### 2.3. Galeria da Home ("Nossa Coleção") Compacta com Fade-out
- **Arquivo:** `components/marketing/ProductGrid.tsx`
- **Comportamento:**
  - A exibição na Home é limitada a 8 cards (`products.slice(0, 8)`).
  - No grid de 4 colunas (desktop) ou 2 colunas (mobile), a partir da metade da segunda fileira (itens 5 a 8), aplica-se um container posicionado em `absolute inset-x-0 bottom-0 h-72 sm:h-80` com:
    - Gradiente: `bg-gradient-to-t from-[#FAF9F6] via-[#FAF9F6]/85 to-transparent pointer-events-none`.
    - Botão CTA centralizado:
      ```tsx
      <div className="absolute inset-x-0 bottom-8 flex justify-center z-20 pointer-events-auto">
        <Link
          href="/produtos"
          className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-brand-espresso text-white font-sora font-extrabold text-sm uppercase tracking-wider shadow-xl shadow-brand-espresso/20 hover:bg-brand-bronze hover:scale-105 transition-all duration-300"
        >
          Ver mais produtos
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </div>
      ```
  - Os botões de busca e dropdown de nichos (`Categories.tsx`) continuam funcionando normalmente na Home.

### 2.4. Nova Página Dedicada de Catálogo (`/produtos`)
- **Arquivos:**
  - `app/(marketing)/produtos/page.tsx` (Novo - Server Component)
  - `app/(marketing)/produtos/ProdutosClient.tsx` (Novo - Client Component)
  - `lib/auth/public-paths.ts` (Adicionar `/^\/produtos(\/.*)?$/`)
- **Recursos da Página:**
  - **Acesso Público:** Liberado no middleware sem exigir autenticação.
  - **Header & Breadcrumb:** Breadcrumb de navegação (`Início / Produtos`), botão de retorno à Home, título h1 de alto impacto, contador dinâmico de produtos encontrados.
  - **Busca em Tempo Real & Filtros de Nicho:** Barra de pesquisa instantânea e chips de nicho com contagem de modelos 3D cadastrados.
  - **Grid Completo:** Renderização de todos os produtos do catálogo usando a estrutura `ProductCard` com `TiltCard`, `ProductMedia`, badges de preço e detalhes.
  - **SEO:** Metatags otimizadas para "Catálogo de Peças e Modelos 3D | GLTech3D".

### 2.5. Seção de Filamentos (Carrossel Interativo Acima do Fatiador)
- **Arquivos:**
  - `components/marketing/filaments/FilamentsHomeSection.tsx`
  - `components/marketing/filaments/FilamentCarousel.tsx` (Novo)
  - `lib/filament-catalog/fallback-filaments.ts` (Novo)
- **Posicionamento:** Em `HomeClient.tsx`, localizado diretamente acima de `<SlicerReveal />`.
- **Componente do Carrossel:**
  - Trilho horizontal com `overflow-x-auto scroll-smooth snap-x snap-mandatory flex gap-5 pb-4`.
  - Setas laterais circulares com monitoramento do `scrollLeft` para desabilitar o botão na extrema esquerda (`scrollLeft === 0`) e extrema direita.
  - Suporte nativo a arrastar com o mouse (*drag-to-scroll*) e swipe por touch em dispositivos móveis.
- **Fallback com 6 a 8 Filamentos:**
  - Caso a consulta ao banco retorne array vazio, carrega filamentos técnicos de demonstração (PLA Premium Preto, Branco Polar, Silk Bronze Ouro, PETG Cinza Espacial, TPU 95A Flexível, PLA Madeira) com especificações de temperatura e dados realistas.
- **Micro-interações:**
  - Card hover: elevação `-translate-y-2`, leve brilho/glow na borda refletindo o tom do material e rotação/escala sutil do carretel.
  - Botão de ação: animação convidativa e feedback tátil ao adicionar ao carrinho.
  - Botão inferior: link direto "Ver catálogo de filamentos" para `/filamentos`.

### 2.6. Sincronização em Tempo Real no CRM (Cache Revalidation)
- **Arquivos:**
  - `app/actions/filament-catalog/actions.ts`
  - `app/actions/landing/actions.ts`
  - `app/app/(pro)/landing-edit/_components/OrderPanel.tsx`
- **Revalidação Imediata:**
  - Em `app/actions/filament-catalog/actions.ts`, criar helper de revalidação disparado em `createFilament`, `updateFilament`, `deleteFilament`, `reorderFilaments`, `setFilamentAvailability` e `publishFilament`:
    ```ts
    revalidateLanding(); // Invalida tags 'landing-catalog' e 'landing-filament-catalog'
    revalidatePath("/");
    revalidatePath("/produtos");
    revalidatePath("/filamentos");
    revalidatePath("/app/landing-edit");
    ```
  - Em `app/actions/landing/actions.ts`, atualizar `refresh()` para invalidar `/produtos`.
- **Painel de Ordem (`OrderPanel.tsx`):**
  - Adicionar demarcador visual claro após o 8º item: "Exibidos na Home (Top 8) ↑ | Apenas em /produtos ↓".
  - Adicionar botão rápido de toggle de Destaque (`isTop`) em cada card do produto.

---

## 3. Ecossistema de E-mails & Captação de Leads

### 3.1. Infraestrutura de Envio (`lib/email/`)
- **Provedores:**
  - **Resend:** SDK `@resend/react` / `resend` via `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.
  - **Nodemailer / SMTP:** Fallback seguro via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `SMTP_FROM`.
- **Garantia de Entregabilidade:** Todos os templates fornecem versão HTML com estilos inline e versão em texto plano (`text`).

### 3.2. Fluxo de Redefinição de Senha
- **Endpoint:** `app/api/auth/forgot-password/route.ts` (e compatibilidade com `app/api/v1/public/password-reset/route.ts`).
  - Recebe `{ email }`, valida sintaxe e verifica existência no Supabase Auth.
  - Gera token assinado com HMAC (SHA-256) com tempo de vida de 1 hora (`PASSWORD_RESET_TTL_SECONDS = 3600`).
  - Dispara e-mail com template escuro da GLTech3D com link:
    `https://gltech3d.vercel.app/redefinir-senha?token={TOKEN}`.
- **Página de Redefinição:**
  - Criar `app/(public)/redefinir-senha/page.tsx` para capturar `searchParams.token` e reutilizar o formulário `ResetPasswordForm` já existente em `[token]/page.tsx`.
  - Validação de expiração, formulário com medidor de força de senha e Server Action `resetPassword` que atualiza a credencial no Supabase Auth e revoga o token.

### 3.3. Formulário de Orçamento da Home ("Vamos tirar sua ideia do papel")
- **Endpoint:** `app/api/orcamento/route.ts` (com compatibilidade com `/api/v1/public/leads` e `/api/contato`).
- **Validação com Zod:**
  ```ts
  const orcamentoSchema = z.object({
    name: z.string().trim().min(2),
    email: z.string().trim().email(),
    phone: z.string().trim().min(8),
    projectType: z.string().optional(),
    message: z.string().optional(),
    consent: z.literal(true),
  });
  ```
- **Notificação para a Diretoria:**
  - Destinatário: `diretoria@gltech3d.com.br` (ou `OWNER_NOTIFY_EMAIL`).
  - Assunto: `[Novo Orçamento] Solicitação de: {Nome do Cliente}`
  - Template: Ficha técnica limpa contendo todos os dados do lead, tipo de projeto, mensagem e botão verde de WhatsApp com link direto `https://wa.me/55{telefone}` pronto para responder em 1 clique.
- **E-mail de Auto-resposta para o Cliente:**
  - Assunto: `Recebemos sua ideia! — Equipe GLTech3D`
  - Conteúdo: Confirmação de recebimento, prazo de resposta, apresentação da oficina e contatos oficiais: WhatsApp `(31) 99928-4834` e Instagram `@gltech3d`.

### 3.4. Inscrição na Newsletter & Campanhas Recorrentes
- **Endpoint:** `app/api/newsletter/subscribe/route.ts`.
  - Salva o e-mail no CRM com prevenção de duplicados.
  - E-mail de Boas-Vindas Imediato:
    - Assunto: `Bem-vindo ao universo 3D da GLTech3D 🚀`
    - Conteúdo acolhedor, apresentação da manufatura aditiva, botão para explorar lançamentos em `/produtos` e filamentos em `/filamentos`, Instagram `@gltech3d`.
- **Template Modular de Campanhas (`lib/email/templates/newsletter-campaign.ts`):**
  - Gerador com suporte a:
    - **Header:** Logotipo GLTech3D e links de navegação.
    - **Bloco 1:** Cards de 3 produtos em destaque com foto, nome e preço.
    - **Bloco 2:** Material da Semana (destaque de filamento técnico com propriedades e dicas de impressão).
    - **Bloco 3:** Banner CTA para envio de arquivo STL para orçamento.
    - **Footer:** Links oficiais de WhatsApp, Instagram, marketplaces e link de descadastramento (*opt-out*).

---

## 4. Plano de Testes e Validação

1. **Testes de Navegação e UI:**
   - Testar Navbar em mobile, tablet e desktop verificando o padding e acomodação do botão "Entrar".
   - Testar persistência do pódio dos Mais Vendidos ao alternar nichos e termos de busca na Home.
   - Testar o fade-out na galeria da Home e clique no botão "Ver mais produtos", validando o redirecionamento para `/produtos`.
   - Testar carrossel de filamentos com drag, touch e setas laterais, verificando a desativação no início e no fim.
2. **Testes do Ecossistema de E-mails:**
   - Testar solicitação de redefinição de senha em `/esqueci-senha` e abertura de link `/redefinir-senha?token=...`.
   - Testar envio de orçamento pelo formulário e validar a geração do e-mail da diretoria (com link do WhatsApp) e a auto-resposta do cliente.
   - Testar inscrição na newsletter e recebimento do e-mail de boas-vindas.
   - Testar geração do template modular de campanha com blocos dinâmicos.
3. **Testes de Build e Lint:**
   - Executar `pnpm typecheck` ou `tsc --noEmit` para garantir ausência de erros de tipo.
   - Validar que rotas públicas estão devidamente registradas em `PUBLIC_PATHS`.
