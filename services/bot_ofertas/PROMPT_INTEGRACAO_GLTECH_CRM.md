# 🚀 PROMPT MESTRE DE INTEGRAÇÃO: BOT DE OFERTAS NO GLTECH CRM

> **Instruções para o usuário:**
> Copie todo o conteúdo abaixo e cole diretamente na conversa do **Gemini 3.8 Flash (High)** no projeto do seu site/CRM (**GLTECH CRM / gltech3d**). Ele contém todas as instruções de arquitetura, design system, rotas e códigos para incorporar o Bot de Ofertas 100% integrado ao seu sistema sem quebrar nada do que já existe!

---

```markdown
# OBJETIVO: INTEGRAR O MÓDULO "BOT DE OFERTAS" AO GLTECH CRM SYSTEM

Você é um Engenheiro Full Stack especialista em Next.js (App Router), TypeScript, TailwindCSS, Supabase e automações com WhatsApp (Baileys) e Telegram.
Sua missão é integrar o sistema completo de **Bot de Ofertas de Afiliados** diretamente no **GLTECH CRM**, respeitando rigorosamente a arquitetura existente, o design system (paleta "Clay" de impressão 3D) e sem afetar nenhuma funcionalidade existente (Dashboard, Produção, Vendas, Financeiro, Clientes, etc.).

---

## 1. REQUISITOS DA SIDEBAR E NAVEGAÇÃO

1. **Alteração do Menu Existente:**
   - Na sidebar principal, localize o item **`Automações (n8n)`**.
   - Remova o sufixo `(n8n)` do rótulo, transformando-o em **`Automações`**.
2. **Criação de Submenu / Acordeão:**
   - Ao clicar ou expandir **`Automações`**, devem ser exibidos os seguintes sub-itens:
     - 🤖 **Workflows n8n** (rota atual `/automations` com a biblioteca de templates e webhooks).
     - 🛍️ **Bots de Ofertas** (nova rota: `/automations/ofertas` ou `/automations/bots/ofertas`).
3. **Manter o Design da Sidebar:**
   - Fundo da sidebar: `#38241b` / `#462f25` (tom Clay / terracota escuro).
   - Texto padrão: `#e6ded8` / `#e4e4e7`.
   - Hover: `#4a3227` / `#5a433d`.
   - Item Ativo: Indicador lateral laranja (`#f97316` / `#ea580c`), fundo `#483025` e texto `#fdba74`.

---

## 2. DESIGN SYSTEM & PALETA DE CORES (TEMA "CLAY")

A interface do Bot de Ofertas deve herdar integralmente a paleta de cores oficial do GLTech3D:
- **Background Principal:** `#f4f4f5` / `#faf9f6` (creme suave)
- **Cards & Superfícies:** `#ffffff` com borda fina `#e8e2d9` e sombra suave `0 4px 20px -2px rgba(45, 36, 30, 0.06)`
- **Tipografia:** `Outfit` / `Inter` / `font-sora`
- **Cor Primária (Ações e Destaques):** `#ea580c` / `#f97316` (Laranja Maker / GLTECH)
- **Cor Secundária / Dourado Maker:** `#8e6d4d` / `#a6815c`
- **Texto Principal:** `#2d241e` / `#18181b`
- **Texto Secundário / Muted:** `#6b5e55` / `#71717a`
- **Status Tags:**
  - Pendente: Fundo `#fff7ed`, Borda `#fed7aa`, Texto `#c2410c`
  - Enviado: Fundo `#f0fdf4`, Borda `#bbf7d0`, Texto `#166534`

---

## 3. ARQUITETURA E FUNCIONALIDADES DO BOT DE OFERTAS

O módulo que você vai integrar já foi prototipado e validado com sucesso (disparando no WhatsApp com foto, legenda ancorada, cupom e link de afiliado). Ele possui as seguintes camadas:

### 3.1. Gateway WhatsApp (Baileys - Zero Docker / Zero VPS)
- **Biblioteca:** `@whiskeysockets/baileys` (versão 7+).
- **Sem custos:** Conexão socket direta que gera o QR Code no próprio painel web para escanear via celular (Aparelhos Conectados).
- **Sessão persistente:** Salva credenciais na pasta `session_auth/` (ou Supabase storage/banco).
- **Listagem de Grupos:** Função `sock.groupFetchAllParticipating()` para listar todos os grupos que o número participa (ex: "Tech Ofertas - Impressão 3D"), permitindo ao usuário selecionar o grupo de destino com 1 clique.
- **Envio de Mídia:** Faz o download seguro da imagem do produto em buffer na memória com User-Agent de navegador e envia via `sock.sendMessage(targetJid, { image: buffer, caption: text })` com fallback automático para texto.

### 3.2. Formatação da Cópia (Padrão de Alta Conversão Maker 3D)
A legenda da oferta gerada segue rigorosamente o padrão visual do grupo de ofertas de impressão 3D:
```text
🛍️ [Marca/Tipo] [Nome Completo do Produto com especificações técnicas]

De: R$ [Valor De]
Por: R$ [Valor Por] ✅ ([X]% OFF)
🎟️ Use o cupom [Cupom]

🛒 [Link de Afiliado Encurtado]

🚀 Entre no grupo: [Link de Convite do Grupo]

#anúncio #cacadoresderenda #GLTech3D
```

### 3.3. Extrator Automático de Metadados (Scraper)
- Endpoint que recebe qualquer URL (Mercado Livre, Shopee, Amazon, AliExpress, Magalu), segue redirecionamentos, lê tags OpenGraph (`og:title`, `og:image`, `og:price:amount`) e preenche automaticamente o título, foto e preço da oferta no formulário.

### 3.4. Mockup Interativo com Preview Real do WhatsApp
- No painel da tela, há um celular simulado do WhatsApp com o balão escuro (`#202c33`), foto do produto com marca d'água (`GLTech3D`), preços riscados, emojis e links clicáveis, atualizando em tempo real conforme o usuário digita.

### 3.5. Planilha & Gestor de Fila (Import/Export CSV)
- Tabela com filtros por status (Pendente / Enviado / Todos) e busca por produto.
- Botão "Disparar Agora (🚀)" em cada linha.
- Importação e Exportação de CSV compatível com Excel e Google Sheets.

### 3.6. Motor Anti-Ban & Agendador Inteligente
- Interruptor para Ativar/Pausar o envio automático em segundo plano.
- Intervalo configurável (ex: 35 a 50 minutos entre postagens).
- **Jitter Aleatório (± 5 minutos):** Variação de tempo orgânica para que os algoritmos do WhatsApp não identifiquem um padrão robótico fixo.
- **Janela de Horário Seguro:** Bloqueio automático de disparos fora do intervalo (ex: só dispara entre 09:00 e 22:00).
- Histórico completo gravando cada disparo com data/hora, canal, destino e status.

---

## 4. ESTRUTURA DE ARQUIVOS A IMPLEMENTAR NO NEXT.JS

Crie ou adapte os arquivos dentro da estrutura do GLTECH CRM:

```
src/
├── app/
│   ├── (dashboard)/
│   │   ├── automations/
│   │   │   ├── page.tsx               # Mantém o hub n8n existente
│   │   │   └── ofertas/
│   │   │       └── page.tsx           # Nova página completa do Bot de Ofertas
│   ├── api/
│   │   └── bot-ofertas/
│   │       ├── status/route.ts        # Status WhatsApp, contagens e agendador
│   │       ├── connect/route.ts       # Inicializa QR Code
│   │       ├── groups/route.ts        # Lista grupos do WhatsApp
│   │       ├── offers/route.ts        # CRUD de ofertas
│   │       ├── dispatch/route.ts      # Dispara oferta no grupo
│   │       ├── scrape/route.ts        # Extrai metadados do link de afiliado
│   │       ├── config/route.ts        # Salva intervalos, horários e grupo alvo
│   │       └── history/route.ts       # Retorna logs de envios
├── components/
│   ├── layout/
│   │   └── sidebar.tsx                # Atualização do menu Automações > Bots de Ofertas
│   └── bot-ofertas/
│       ├── NovaOfertaForm.tsx         # Formulário com scraper
│       ├── WhatsAppMockupPreview.tsx  # Preview estilo WhatsApp
│       ├── PlanilhaFilaTable.tsx      # Tabela com CRUD e CSV
│       ├── ConexoesManager.tsx        # Leitor de QR Code e seleção de grupo
│       └── AntiBanSettings.tsx        # Configuração de intervalos e horários
└── lib/
    └── bot-engine/
        ├── whatsapp.ts                # Conexão Baileys persistente
        ├── formatter.ts               # Formatador da copy com emojis e descontos
        ├── scraper.ts                 # Cheerio/Axios para extração de metadados
        └── scheduler.ts               # Loop do agendador com Jitter
```

---

## 5. CÓDIGO DA CONEXÃO BAILEYS (`lib/bot-engine/whatsapp.ts`)

```typescript
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  WASocket
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import pino from 'pino';

const SESSION_DIR = path.resolve(process.cwd(), 'session_auth');

let sock: WASocket | null = null;
let connectionStatus: 'disconnected' | 'connecting' | 'waiting_qr' | 'connected' = 'disconnected';
let qrCodeDataUrl: string | null = null;
let connectedUser: any = null;
let participatingGroups: Array<{ id: string; name: string; participantsCount: number }> = [];

export async function ensureConnected(maxWaitMs = 8000): Promise<WASocket> {
  if (sock && connectionStatus === 'connected') return sock;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (sock && connectionStatus === 'connected') return sock;
    await new Promise((r) => setTimeout(r, 400));
  }
  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado. Escaneie o QR Code no dashboard.');
  }
  return sock;
}

export async function initWhatsApp(force = false) {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  if (sock && force) {
    try { sock.ev.removeAllListeners(); sock.end(undefined); } catch (_) {}
    sock = null;
  }

  connectionStatus = 'connecting';
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: pino({ level: 'silent' }),
    browser: ['GLTech CRM', 'Chrome', '122.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      connectionStatus = 'waiting_qr';
      qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
    }

    if (connection === 'open') {
      connectionStatus = 'connected';
      qrCodeDataUrl = null;
      connectedUser = sock?.user;
      refreshGroups().catch(() => {});
    }

    if (connection === 'close') {
      qrCodeDataUrl = null;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isReplaced = statusCode === DisconnectReason.connectionReplaced;

      if (isReplaced) {
        connectionStatus = 'disconnected';
      } else if (!isLoggedOut) {
        connectionStatus = 'connecting';
        setTimeout(() => initWhatsApp(true), 4000);
      } else {
        connectionStatus = 'disconnected';
        connectedUser = null;
      }
    }
  });

  return sock;
}

export async function refreshGroups() {
  if (!sock || connectionStatus !== 'connected') return participatingGroups;
  try {
    const raw = await sock.groupFetchAllParticipating();
    participatingGroups = Object.values(raw).map((g) => ({
      id: g.id,
      name: g.subject || 'Grupo sem nome',
      participantsCount: g.participants?.length || 0
    }));
    return participatingGroups;
  } catch {
    return participatingGroups;
  }
}

export async function sendOfferToWhatsApp(targetJid: string, text: string, imageUrl?: string) {
  const activeSock = await ensureConnected();

  if (imageUrl && imageUrl.startsWith('http')) {
    try {
      const res = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 12000
      });
      const buffer = Buffer.from(res.data);
      const msgRes = await activeSock.sendMessage(targetJid, {
        image: buffer,
        caption: text
      });
      return { success: true, msgRes, type: 'image' };
    } catch {
      // Fallback para texto se a foto falhar
    }
  }

  const msgRes = await activeSock.sendMessage(targetJid, { text, linkPreview: false });
  return { success: true, msgRes, type: 'text' };
}

export function getWhatsAppStatus() {
  return {
    status: connectionStatus,
    qr: qrCodeDataUrl,
    user: connectedUser ? { id: connectedUser.id, name: connectedUser.name } : null,
    groups: participatingGroups
  };
}
```

---

## 6. FORMATAÇÃO DO TEXTO PROMOCIONAL (`lib/bot-engine/formatter.ts`)

```typescript
export interface OfferPayload {
  title: string;
  originalPrice?: number;
  promoPrice: number;
  coupon?: string;
  affiliateUrl: string;
  category?: string;
}

export function formatDealMessage(offer: OfferPayload, groupInviteUrl?: string, defaultHashtags = '#anúncio #cacadoresderenda #GLTech3D') {
  const lines: string[] = [];
  lines.push(`🛍️ ${offer.title.trim()}`);
  lines.push('');

  const orig = Number(offer.originalPrice) || 0;
  const promo = Number(offer.promoPrice) || 0;

  if (orig > promo && promo > 0) {
    const discount = Math.round(((orig - promo) / orig) * 100);
    lines.push(`De: R$ ${orig.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    lines.push(`Por: R$ ${promo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ✅ (${discount}% OFF)`);
  } else if (promo > 0) {
    lines.push(`Por: R$ ${promo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ✅`);
  }

  if (offer.coupon && offer.coupon.trim().length > 0) {
    const cp = offer.coupon.trim();
    lines.push(`🎟️ ${cp.toLowerCase().includes('cupom') ? cp : `Use o cupom ${cp}`}`);
  }

  lines.push('');
  if (offer.affiliateUrl) {
    lines.push(`🛒 ${offer.affiliateUrl.trim()}`);
  }

  if (groupInviteUrl && groupInviteUrl.trim().length > 0) {
    lines.push('');
    lines.push(`🚀 Entre no grupo: ${groupInviteUrl.trim()}`);
  }

  if (defaultHashtags) {
    lines.push('');
    lines.push(defaultHashtags.trim());
  }

  return lines.join('\n');
}
```

---

## 7. INTEGRAÇÃO NO BANCO DE DADOS (SUPABASE OU SQLITE/JSON)

Se desejar persistir no Supabase, crie a migration SQL:
```sql
CREATE TABLE IF NOT EXISTS affiliate_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT DEFAULT 'Filamentos 3D',
  original_price NUMERIC(10,2) DEFAULT 0,
  promo_price NUMERIC(10,2) NOT NULL,
  coupon TEXT,
  affiliate_url TEXT NOT NULL,
  image_url TEXT,
  status VARCHAR(20) DEFAULT 'pendente', -- 'pendente', 'enviado', 'pausado'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  dispatched_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS affiliate_config (
  id INT PRIMARY KEY DEFAULT 1,
  whatsapp_group_id TEXT,
  whatsapp_group_name TEXT,
  telegram_token TEXT,
  telegram_chat_id TEXT,
  auto_dispatch BOOLEAN DEFAULT FALSE,
  interval_minutes INT DEFAULT 40,
  jitter_minutes INT DEFAULT 5,
  start_hour INT DEFAULT 9,
  end_hour INT DEFAULT 22,
  hashtags TEXT DEFAULT '#anúncio #cacadoresderenda #GLTech3D',
  invite_url TEXT,
  watermark TEXT DEFAULT 'GLTech3D'
);

CREATE TABLE IF NOT EXISTS affiliate_dispatch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES affiliate_offers(id) ON DELETE SET NULL,
  title TEXT,
  channel VARCHAR(20) NOT NULL,
  target TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 8. REGRAS CRÍTICAS DE EXECUÇÃO

1. **NÃO QUEBRAR O PROJETO EXISTENTE:** Preserve todas as rotas de Vendas, Produção, Financeiro, Clientes e Configurações intactas.
2. **MODO DAEMON DO BAILEYS:** Como o Baileys requer conexão WebSocket 24/7 e a Vercel é Serverless, certifique-se de:
   - Manter o script do bot rodando como daemon local (ex: `npm run bot` ou serviço Node dedicado na porta 3000/3001) e o Next.js consumindo a API interna;
   - OU integrar o cliente via API Routes para desenvolvimento local.
3. **DESIGN CONSISTENTE:** Use exclusivamente as cores da paleta `clay` do GLTech CRM (`#38241b` na sidebar, `#ea580c` nos botões de ação e `#ffffff` nos cards sobre fundo `#f4f4f5`).
```
