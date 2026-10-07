# Design Spec: Controle de Acesso (RBAC), Endurecimento de Autenticação (MFA / WebAuthn / Dispositivos Confiáveis) & Isolamento do CMS GLTech3D

**Data:** 2026-10-07  
**Autor:** Antigravity Architect & Security Full Stack  
**Status:** Aprovado  

---

## 1. Contexto & Problema de Negócio

A plataforma GLTech3D (`gltech3d.vercel.app`) atua em duas frentes complementares:
1. **Loja Pública e Oficina Especializada:** Vitrine de modelos 3D, catálogo de filamentos técnicos, captação de leads e pedidos sob demanda.
2. **SaaS Operacional e CRM para Manufatura Aditiva (Calc3D PRO):** Ferramentas para assinantes (cálculo de custos de impressão com energia/bico/depreciação, orçamentos personalizados com logo própria e histórico de peças).

### Vulnerabilidades Diagnosticadas no Modelo Anterior:
- **Ausência de Isolamento no CMS:** As Server Actions de edição da vitrine pública (`app/actions/landing/actions.ts` e `app/actions/filament-catalog/actions.ts`) exigiam apenas `assertProAccess`. Assim, qualquer cliente assinante do Calc3D PRO poderia acessar a rota `/app/landing-edit` no menu e alterar a vitrine oficial da GLTech3D.
- **Módulos Críticos Expostos no Menu:** Sub-abas e integrações como *Pedidos do site*, *LGPD*, *Agentes IA*, *Conexões*, *Automações n8n*, *Criação de Conteúdo* e *Landing Edit* apareciam no menu do CRM para usuários não-admins.
- **MFA Uniforme sem Truncamento por Privilégio:** Administradores da diretoria não possuíam enforcement obrigatório de AAL2 no login, enquanto dispositivos confiáveis possuíam prazo fixo de 30 dias para qualquer perfil, sem opção estendida de 1 ano para a máquina de trabalho da diretoria.

---

## 2. Matriz de Níveis de Acesso (RBAC) & Isolamento da Landing Page

### 2.1 Três Perfis de Acesso

1. **Admin da Plataforma / Diretoria (`diretoria@gltech3d.com.br` / `platform_admins`):**
   - Acesso irrestrito a todas as áreas do CRM, relatórios financeiros globais, pedidos do site, campanhas de e-mail e automações.
   - **Exclusividade Total do CMS:** Somente o perfil admin da organização `gltech3d` pode editar:
     - Pódio dos Mais Vendidos (Top 3).
     - Ordem e seleção dos 8 destaques da Home.
     - Carrossel e catálogo de Filamentos da vitrine.
     - Banners, redes sociais e configurações globais do site.
   - Tentativas de mutação por não-admins retornam `403 Forbidden`.

2. **Assinante / Cliente Pro (ex: Calc3D PRO):**
   - Acesso restrito ao seu próprio tenant:
     - Calculadora 3D com salvamento de parâmetros (kWh, depreciação, lucro).
     - Histórico próprio de simulações e orçamentos emitidos.
     - Exportação de PDF com a sua própria marca.
     - Gestão de impressoras, filamentos e pedidos próprios.
   - **Isolamento Absoluto:** Bloqueio total a qualquer tela ou ação do CMS público, e bloqueio aos pedidos/leads da loja oficial.

3. **Usuário Gratuito / Visitante:**
   - Acesso apenas a ferramentas públicas básicas e consulta do status de pedidos próprios via login.

---

### 2.2 Estrutura do Menu do CRM para Usuários Não-Admin

No componente de navegação (`components/shell/nav-crm.ts` e renderizadores do menu), os seguintes itens são **estritamente ocultados** para usuários que não sejam admins da organização `gltech3d` ou `is_platform_admin`:

1. **Em Vendas (`/app/sales`):**
   - Ocultar: `Pedidos do site` (`/app/pedidos-site`).
2. **Em Clientes (`/app/clientes`):**
   - Ocultar: `Conexões` (`/app/connections`).
   - Ocultar: `LGPD` (`/app/lgpd/requests`).
   - Ocultar: `Agentes IA` (`/app/ai/agents`).
3. **Módulos Independentes:**
   - Ocultar: `Automações (n8n)` (`/automations`).
   - Ocultar: `Criação de Conteúdo` (`/content-studio`).
   - Ocultar: `Landing Edit` (`/app/landing-edit`).
4. **Configurações do Usuário (`/app/settings`):**
   - Para não-admins, expor apenas o pacote básico:
     - Perfil (`/app/settings/profile`)
     - Segurança (`/app/settings/security`)
     - Notificações (`/app/settings/notifications`)
     - Plano e Cobrança (`/app/settings/billing`)
     - Organização (`/app/settings/organization`)
     - Conexões WhatsApp (`/app/settings/whatsapp`)

---

## 3. Endurecimento do Banco de Dados & Server Actions

### 3.1 Guards em Server Actions
Em `app/actions/landing/actions.ts` e `app/actions/filament-catalog/actions.ts`:
- Função `requireAdminLandingCtx()`:
  - Valida autenticação (`loadAuthUser()`).
  - Resolve org ativa (`resolveActiveOrg()`).
  - Valida se `authUser.is_platform_admin === true` OU se `activeOrg.slug === env.LANDING_ORG_SLUG && activeOrg.role === 'admin'`.
  - Se falso, lança erro imediato: `{ ok: false, error: "403 Forbidden: Apenas a diretoria da GLTech3D pode alterar a vitrine pública." }`.

### 3.2 RLS no Postgres (Migration `0090_cms_admin_isolation.sql`)
- Adiciona policies explícitas nas tabelas de vitrine (`landing_settings`, `platform_commissions`) garantindo que apenas membros com role `admin` da organização correspondente a `LANDING_ORG_SLUG` tenham permissão de `INSERT`, `UPDATE` ou `DELETE`.

---

## 4. Endurecimento de Autenticação (MFA, Dispositivos Confiáveis & WebAuthn)

### 4.1 Política de MFA Diferenciada
- **Diretoria:**
  - MFA obrigatório no login.
  - No `signInWithPassword.ts`: se o usuário for `platform_admin` ou possuir e-mail `diretoria@gltech3d.com.br`, exige AAL2 caso não possua cookie válido de dispositivo confiável.
- **Clientes Comuns:**
  - MFA 100% opcional. O login com e-mail e senha segue direto sem travar o cliente.
  - Clientes podem ativar voluntariamente em `/app/settings/security`.

### 4.2 Dispositivo Confiável (TTL 365 Dias vs 30 Dias)
- Em `lib/auth/trusted-device.ts`:
  - Clientes comuns: TTL padrão de **30 dias**.
  - Diretoria: Opção de TTL estendido de **365 dias** (1 ano) em cookie `httpOnly`, `secure`, `sameSite: lax`.
  - O hash do token associa `rawToken + userId + userAgent`.
  - Quando válido, suprime o desafio de MFA por 1 ano.

### 4.3 Biometria & WebAuthn / Passkeys
- Cadastro em `/app/settings/security`:
  - Disparo de `navigator.credentials.create()` (FIDO2 / WebAuthn).
  - Armazenamento da chave pública no Supabase.
- Login rápido em `/login`:
  - Botão "Entrar com Biometria / Face ID".
  - Execução de `navigator.credentials.get()`.

---

## 5. Próxima Etapa: Ponte para o Redesign do Catálogo Visual
Após a implementação e teste da presente arquitetura de segurança, o sistema emitirá a notificação de encerramento e solicitará a autorização para iniciar o **Plano Multidisciplinar de Redesign do Catálogo Visual** (4 Agentes: UI/UX Editorial Industrial, Front-End Live Preview, Copywriting B2B e Motor PDF A4).
