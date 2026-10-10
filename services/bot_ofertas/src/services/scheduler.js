const storage = require('./storage');
const formatter = require('./formatter');
const whatsapp = require('./whatsapp');
const telegram = require('./telegram');

let schedulerTimer = null;
let lastDispatchTime = 0;
let currentJitterMinutes = 0;

function getRandomJitter(maxJitterMinutes = 5) {
  // Gera variação entre -jitter e +jitter minutos
  const max = Math.max(1, maxJitterMinutes);
  return (Math.random() * (max * 2) - max);
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
    const targetJid = options.targetGroupJid || config.whatsappTargetGroupId;
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
          target: config.whatsappTargetGroupName || targetJid,
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
  if (sendTg && config.telegramBotToken && config.telegramChatId) {
    try {
      const tgRes = await telegram.sendTelegramOffer(
        config.telegramBotToken,
        config.telegramChatId,
        formattedMessage,
        offer.imageUrl
      );
      results.telegram = { success: true, details: tgRes };
      storage.logDispatch({
        offerId: offer.id,
        title: offer.title,
        channel: 'telegram',
        target: config.telegramChatId,
        status: 'success',
        message: 'Enviado com sucesso'
      });
    } catch (err) {
      results.telegram = { success: false, error: err.message };
      storage.logDispatch({
        offerId: offer.id,
        title: offer.title,
        channel: 'telegram',
        target: config.telegramChatId,
        status: 'error',
        message: err.message
      });
    }
  }

  // Se ao menos um canal enviou com sucesso, marca como enviado
  const anySuccess = (results.whatsapp?.success || results.telegram?.success);
  if (anySuccess) {
    storage.updateOffer(offer.id, {
      status: 'enviado',
      dispatchedAt: new Date().toISOString()
    });
    lastDispatchTime = Date.now();
    currentJitterMinutes = getRandomJitter(config.dispatchJitterMinutes || 5);
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

  // Verifica janela de horário comercial seguro (ex: 09h às 22h)
  const startHour = parseInt(config.dispatchStartHour) || 9;
  const endHour = parseInt(config.dispatchEndHour) || 22;

  if (currentHour < startHour || currentHour >= endHour) {
    // Fora da janela de disparo
    return;
  }

  // Intervalo configurado com variação orgânica (Jitter)
  const baseIntervalMs = (parseInt(config.dispatchIntervalMinutes) || 40) * 60 * 1000;
  const jitterMs = currentJitterMinutes * 60 * 1000;
  const targetIntervalMs = Math.max(10 * 60 * 1000, baseIntervalMs + jitterMs); // Mínimo seguro de 10 min

  const elapsedMs = Date.now() - lastDispatchTime;

  if (lastDispatchTime === 0 || elapsedMs >= targetIntervalMs) {
    const nextOffer = storage.getNextPendingOffer();
    if (nextOffer) {
      console.log(`[Agendador] Disparando oferta agendada: "${nextOffer.title}"...`);
      await dispatchOffer(nextOffer, {
        sendWhatsapp: true,
        sendTelegram: Boolean(config.telegramBotToken && config.telegramChatId)
      });
    } else {
      console.log('[Agendador] Nenhuma oferta pendente na fila.');
    }
  }
}

function startScheduler() {
  if (schedulerTimer) clearInterval(schedulerTimer);
  currentJitterMinutes = getRandomJitter(5);
  schedulerTimer = setInterval(checkScheduleTick, 60 * 1000); // checa a cada minuto
  console.log('[Agendador] Serviço de agendamento automático iniciado.');
}

function getSchedulerStatus() {
  const config = storage.getConfig();
  const baseIntervalMs = (parseInt(config.dispatchIntervalMinutes) || 40) * 60 * 1000;
  const jitterMs = currentJitterMinutes * 60 * 1000;
  const targetIntervalMs = baseIntervalMs + jitterMs;
  const elapsedMs = lastDispatchTime > 0 ? Date.now() - lastDispatchTime : null;
  const nextInMs = elapsedMs !== null ? Math.max(0, targetIntervalMs - elapsedMs) : 0;

  return {
    autoDispatchEnabled: config.autoDispatchEnabled,
    intervalMinutes: config.dispatchIntervalMinutes,
    jitterMinutes: Math.round(currentJitterMinutes * 10) / 10,
    lastDispatchTime: lastDispatchTime ? new Date(lastDispatchTime).toISOString() : null,
    nextDispatchInMinutes: lastDispatchTime ? Math.round(nextInMs / 60000) : 0,
    window: `${config.dispatchStartHour}h - ${config.dispatchEndHour}h`
  };
}

module.exports = {
  dispatchOffer,
  startScheduler,
  getSchedulerStatus
};
