const storage = require('./storage');
const formatter = require('./formatter');
const whatsapp = require('./whatsapp');
const telegram = require('./telegram');

let schedulerTimer = null;
let lastDispatchTime = 0;
let currentTargetIntervalMs = 5 * 60 * 1000; // default inicial de 5 min

/**
 * Calcula próximo intervalo orgânico em milissegundos dentro do range configurável (ex: 2 a 15 min).
 */
function calculateNextIntervalMs(minMinutes = 2, maxMinutes = 15) {
  const min = Math.max(1, parseInt(minMinutes, 10) || 2);
  const max = Math.max(min, parseInt(maxMinutes, 10) || 15);
  // Distribuição aleatória contínua para simular ação humana
  const randomMinutes = min + Math.random() * (max - min);
  return Math.round(randomMinutes * 60 * 1000);
}

/**
 * Dispara uma oferta para os canais selecionados.
 * 
 * @param {Object} offer - Objeto da oferta
 * @param {Object} options - { sendWhatsapp: boolean, sendTelegram: boolean, targetGroupJid?: string }
 */
async function dispatchOffer(offer, options = {}) {
  const config = storage.getConfig();
  const sendWpp = options.sendWhatsapp ?? true;
  const sendTg = options.sendTelegram ?? Boolean(config.telegramBotToken && config.telegramChatId);

  // Mapeamento multi-nicho: seleciona o grupo de destino com base no nicho da oferta
  let targetJid = options.targetGroupJid;
  let targetGroupName = config.whatsappTargetGroupName;
  if (!targetJid && offer.niche && config.nicheGroups && config.nicheGroups[offer.niche]?.whatsappJid) {
    targetJid = config.nicheGroups[offer.niche].whatsappJid;
    targetGroupName = config.nicheGroups[offer.niche].whatsappName || targetGroupName;
  }
  if (!targetJid) {
    targetJid = config.whatsappTargetGroupId;
  }

  const formattedMessage = formatter.formatOfferMessage(offer, {
    defaultHashtags: config.defaultHashtags,
    groupInviteUrl: config.groupInviteUrl
  });

  const results = {
    whatsapp: null,
    telegram: null
  };

  // 1. WhatsApp
  if (sendWpp) {
    if (!targetJid) {
      results.whatsapp = { success: false, error: 'Nenhum grupo de WhatsApp configurado para envio.' };
    } else {
      try {
        const wppRes = await whatsapp.sendOfferMessage(targetJid, formattedMessage, offer.imageUrl);
        results.whatsapp = { success: true, details: wppRes };
        storage.logDispatch({
          offerId: offer.id,
          title: offer.title,
          channel: 'whatsapp',
          target: targetGroupName || targetJid,
          status: 'success',
          message: 'Enviado com sucesso'
        });
      } catch (err) {
        results.whatsapp = { success: false, error: err.message };
        storage.logDispatch({
          offerId: offer.id,
          title: offer.title,
          channel: 'whatsapp',
          target: targetJid,
          status: 'error',
          message: err.message
        });
      }
    }
  }

  // Delay de segurança entre canais se ambos forem disparados
  if (sendWpp && sendTg) {
    await new Promise((r) => setTimeout(r, 2000));
  }

  // 2. Telegram
  let tgChatId = config.telegramChatId;
  if (offer.niche && config.nicheGroups && config.nicheGroups[offer.niche]?.telegramChatId) {
    tgChatId = config.nicheGroups[offer.niche].telegramChatId;
  }

  if (sendTg && config.telegramBotToken && tgChatId) {
    try {
      const tgRes = await telegram.sendTelegramOffer(
        config.telegramBotToken,
        tgChatId,
        formattedMessage,
        offer.imageUrl
      );
      results.telegram = { success: true, details: tgRes };
      storage.logDispatch({
        offerId: offer.id,
        title: offer.title,
        channel: 'telegram',
        target: tgChatId,
        status: 'success',
        message: 'Enviado com sucesso'
      });
    } catch (err) {
      results.telegram = { success: false, error: err.message };
      storage.logDispatch({
        offerId: offer.id,
        title: offer.title,
        channel: 'telegram',
        target: tgChatId,
        status: 'error',
        message: err.message
      });
    }
  }

  // Se ao menos um canal enviou com sucesso, marca como enviado e atualiza contadores
  const anySuccess = (results.whatsapp?.success || results.telegram?.success);
  if (anySuccess) {
    const isAlreadySent = offer.status === 'enviado';
    storage.updateOffer(offer.id, {
      status: 'enviado',
      dispatchedAt: offer.dispatchedAt || new Date().toISOString(),
      lastDispatchedAt: new Date().toISOString(),
      recycledCount: isAlreadySent ? (offer.recycledCount || 0) + 1 : (offer.recycledCount || 0)
    });
    lastDispatchTime = Date.now();
    currentTargetIntervalMs = calculateNextIntervalMs(
      config.minIntervalMinutes || 2,
      config.maxIntervalMinutes || 15
    );
  }

  return { success: anySuccess, results, messageText: formattedMessage };
}

/**
 * Loop do Agendador Automático (Roda a cada 60s).
 */
async function checkScheduleTick() {
  const config = storage.getConfig();

  if (!config.autoDispatchEnabled) return;

  const now = new Date();
  const currentHour = now.getHours();

  // Janela de horário comercial seguro (ex: 09h às 23h)
  const startHour = parseInt(config.dispatchStartHour, 10) || 9;
  const endHour = parseInt(config.dispatchEndHour, 10) || 23;

  if (currentHour < startHour || currentHour >= endHour) {
    // Fora da janela de disparo
    return;
  }

  const elapsedMs = lastDispatchTime > 0 ? (Date.now() - lastDispatchTime) : Infinity;

  if (elapsedMs >= currentTargetIntervalMs) {
    let offerToDispatch = storage.getNextPendingOffer();

    // Modo Rodízio / Reciclagem Inteligente se não houver pendentes
    if (!offerToDispatch && config.recycleMode !== false) {
      offerToDispatch = storage.getNextRecycledOffer();
      if (offerToDispatch) {
        console.log(`[Agendador] 🔄 Fila zerada! Reciclando oferta ativa mais antiga: "${offerToDispatch.title}"...`);
      }
    }

    if (offerToDispatch) {
      console.log(`[Agendador] 🚀 Disparando oferta agendada: "${offerToDispatch.title}"...`);
      await dispatchOffer(offerToDispatch, {
        sendWhatsapp: true,
        sendTelegram: Boolean(config.telegramBotToken && config.telegramChatId)
      });
    } else {
      console.log('[Agendador] Nenhuma oferta pendente ou ativa disponível no momento.');
    }
  }
}

function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  const config = storage.getConfig();
  currentTargetIntervalMs = calculateNextIntervalMs(
    config.minIntervalMinutes || 2,
    config.maxIntervalMinutes || 15
  );
  schedulerTimer = setInterval(checkScheduleTick, 30 * 1000); // checa a cada 30 segundos
  console.log('[Agendador] Serviço de agendamento automático contínuo iniciado.');
}

function getSchedulerStatus() {
  const config = storage.getConfig();
  const elapsedMs = lastDispatchTime > 0 ? Date.now() - lastDispatchTime : null;
  const nextInMs = elapsedMs !== null ? Math.max(0, currentTargetIntervalMs - elapsedMs) : 0;

  return {
    autoDispatchEnabled: Boolean(config.autoDispatchEnabled),
    intervalMinutes: config.dispatchIntervalMinutes || 10,
    minIntervalMinutes: config.minIntervalMinutes || 2,
    maxIntervalMinutes: config.maxIntervalMinutes || 15,
    recycleMode: config.recycleMode !== false,
    welcomeMessageEnabled: config.welcomeMessageEnabled !== false,
    welcomeGroupName: config.welcomeGroupName || 'GLTech Ofertas - Impressão 3D',
    lastDispatchTime: lastDispatchTime ? new Date(lastDispatchTime).toISOString() : null,
    nextDispatchInMinutes: lastDispatchTime ? Math.round(nextInMs / 60000) : 0,
    window: `${config.dispatchStartHour || 9}h - ${config.dispatchEndHour || 23}h`
  };
}

module.exports = {
  calculateNextIntervalMs,
  dispatchOffer,
  startScheduler,
  getSchedulerStatus
};
