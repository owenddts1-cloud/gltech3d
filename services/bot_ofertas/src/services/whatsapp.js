const path = require('path');
const fs = require('fs');
const axios = require('axios');
const QRCode = require('qrcode');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const pino = require('pino');

const SESSION_DIR = path.resolve(__dirname, '../../session_auth');

// Estado interno do WhatsApp
let sock = null;
let connectionStatus = 'disconnected'; // 'disconnected' | 'connecting' | 'waiting_qr' | 'connected'
let qrCodeDataUrl = null;
let connectedUser = null;
let participatingGroups = [];
let isStarting = false;
let reconnectTimer = null;

// Logger silencioso para Baileys
const logger = pino({ level: 'silent' });

/**
 * Aguarda a conexão estar pronta (caso esteja temporariamente sincronizando ou reconectando).
 */
async function ensureConnected(maxWaitMs = 8000) {
  if (sock && connectionStatus === 'connected') return sock;

  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    if (sock && connectionStatus === 'connected') return sock;
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!sock || connectionStatus !== 'connected') {
    throw new Error('WhatsApp não está conectado. Aguarde alguns segundos ou reconecte na aba "WhatsApp & Canais".');
  }
  return sock;
}

/**
 * Inicializa a conexão com o WhatsApp.
 */
async function initWhatsApp(forceReconnect = false) {
  if (isStarting && !forceReconnect) return;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  isStarting = true;

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  try {
    if (sock) {
      try {
        sock.ev.removeAllListeners();
        sock.end();
      } catch (_) {}
      sock = null;
    }

    connectionStatus = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger,
      browser: ['Bot Ofertas Pro', 'Chrome', '122.0.0'],
      connectTimeoutMs: 25000,
      keepAliveIntervalMs: 20000
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        connectionStatus = 'waiting_qr';
        try {
          qrCodeDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
        } catch (err) {
          console.error('[WhatsApp] Erro ao gerar imagem QR Code:', err.message);
        }
        console.log('[WhatsApp] Novo QR Code gerado! Pronto para leitura no app.');
      }

      if (connection === 'open') {
        connectionStatus = 'connected';
        qrCodeDataUrl = null;
        isStarting = false;
        connectedUser = sock.user;
        console.log(`[WhatsApp] ✅ Conectado com sucesso! Conta: ${sock.user?.name || sock.user?.id}`);
        // Carrega grupos logo após conectar
        refreshGroups().catch(() => {});
      }

      if (connection === 'close') {
        isStarting = false;
        qrCodeDataUrl = null;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isReplaced = statusCode === DisconnectReason.connectionReplaced; // Código 440

        console.log(`[WhatsApp] Conexão fechada. Código: ${statusCode}.`);

        if (isReplaced) {
          connectionStatus = 'disconnected';
          console.warn('[WhatsApp] ⚠️ Atenção: Sessão aberta em outro processo/terminal. Conexão pausada para evitar conflito.');
        } else if (!isLoggedOut) {
          connectionStatus = 'connecting';
          console.log('[WhatsApp] Tentando reconectar em 4 segundos...');
          reconnectTimer = setTimeout(() => initWhatsApp(true), 4000);
        } else {
          connectionStatus = 'disconnected';
          connectedUser = null;
          participatingGroups = [];
          console.log('[WhatsApp] Sessão finalizada (logout). Escaneie o QR Code novamente.');
        }
      }
    });

    // Boas-vindas automáticas para novos membros no grupo
    sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
      if (action === 'add' && participants && participants.length > 0) {
        try {
          const storage = require('./storage');
          const formatter = require('./formatter');
          const config = storage.getConfig();

          if (config.welcomeMessageEnabled !== false) {
            const isTargetGroup =
              (id === config.whatsappTargetGroupId) ||
              Object.values(config.nicheGroups || {}).some((g) => g && g.whatsappJid === id);

            if (isTargetGroup) {
              const groupName = config.welcomeGroupName || config.whatsappTargetGroupName || 'GLTech Ofertas - Impressão 3D';
              for (const participant of participants) {
                const phone = participant.split('@')[0] || participant;
                const welcomeText = formatter.formatWelcomeMessage(phone, groupName);
                await sock.sendMessage(id, {
                  text: welcomeText,
                  mentions: [participant]
                });
                console.log(`[WhatsApp] 🖨️ Boas-vindas enviadas para novo membro @${phone} no grupo ${id}`);
              }
            }
          }
        } catch (err) {
          console.error('[WhatsApp] Erro ao processar boas-vindas de participante:', err.message);
        }
      }
    });

    isStarting = false;
    return sock;
  } catch (error) {
    isStarting = false;
    connectionStatus = 'disconnected';
    console.error('[WhatsApp] Falha ao iniciar socket:', error.message);
    throw error;
  }
}

/**
 * Busca todos os grupos participantes da conta conectada.
 */
async function refreshGroups() {
  if (!sock || connectionStatus !== 'connected') {
    return participatingGroups;
  }
  try {
    const rawGroups = await sock.groupFetchAllParticipating();
    participatingGroups = Object.values(rawGroups).map((g) => ({
      id: g.id,
      name: g.subject || 'Grupo sem nome',
      participantsCount: g.participants?.length || 0,
      creation: g.creation || null
    }));
    return participatingGroups;
  } catch (error) {
    console.error('[WhatsApp] Erro ao buscar grupos:', error.message);
    return participatingGroups;
  }
}

/**
 * Envia uma mensagem promocional para um grupo ou chat.
 */
async function sendOfferMessage(targetJid, text, imageUrl) {
  const activeSock = await ensureConnected();

  if (!targetJid) {
    throw new Error('ID do grupo (JID) não configurado. Selecione o grupo na aba "WhatsApp & Canais".');
  }

  // Tenta baixar a imagem via axios para enviar como buffer seguro
  if (imageUrl && imageUrl.startsWith('http')) {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 12000
      });

      const buffer = Buffer.from(response.data);
      const result = await activeSock.sendMessage(targetJid, {
        image: buffer,
        caption: text
      });
      console.log(`[WhatsApp] Oferta com foto enviada com sucesso para ${targetJid}`);
      return { success: true, result, mediaType: 'image' };
    } catch (mediaError) {
      console.warn(`[WhatsApp] Falha ao obter/enviar imagem (${mediaError.message}), enviando mensagem como texto...`);
    }
  }

  // Fallback seguro: envio como mensagem de texto
  const result = await activeSock.sendMessage(targetJid, {
    text: text,
    linkPreview: false
  });
  console.log(`[WhatsApp] Oferta em texto enviada com sucesso para ${targetJid}`);

  return { success: true, result, mediaType: 'text' };
}

/**
 * Desconecta e limpa a sessão para novo pareamento.
 */
async function logoutWhatsApp() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (sock) {
    try {
      await sock.logout();
    } catch (_) {}
    sock = null;
  }
  connectionStatus = 'disconnected';
  qrCodeDataUrl = null;
  connectedUser = null;
  participatingGroups = [];

  // Remove pasta de sessão
  if (fs.existsSync(SESSION_DIR)) {
    try {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    } catch (err) {
      console.warn('[WhatsApp] Não foi possível apagar a pasta de sessão:', err.message);
    }
  }

  return { success: true };
}

function getStatus() {
  return {
    status: connectionStatus,
    qr: qrCodeDataUrl,
    user: connectedUser ? { id: connectedUser.id, name: connectedUser.name } : null,
    groups: participatingGroups
  };
}

module.exports = {
  initWhatsApp,
  refreshGroups,
  sendOfferMessage,
  logoutWhatsApp,
  getStatus
};
