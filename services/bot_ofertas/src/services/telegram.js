const axios = require('axios');

/**
 * Envia uma oferta para um canal ou grupo do Telegram.
 * 
 * @param {string} botToken - Token fornecido pelo @BotFather
 * @param {string} chatId - ID do canal (ex: -1001234567890 ou @meucanal)
 * @param {string} text - Legenda formatada
 * @param {string} imageUrl - Imagem do produto
 */
async function sendTelegramOffer(botToken, chatId, text, imageUrl) {
  if (!botToken || !chatId) {
    throw new Error('Telegram Bot Token ou Chat ID não configurados.');
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();

  // Se houver imagem, envia via sendPhoto
  if (imageUrl && imageUrl.startsWith('http')) {
    try {
      const response = await axios.post(`https://api.telegram.org/bot${cleanToken}/sendPhoto`, {
        chat_id: cleanChatId,
        photo: imageUrl,
        caption: text
      }, { timeout: 15000 });
      return { success: true, result: response.data };
    } catch (photoError) {
      console.warn(`[Telegram] Falha ao enviar foto (${photoError.message}), tentando enviar apenas texto...`);
    }
  }

  // Fallback: envio como mensagem de texto simples
  const textResponse = await axios.post(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
    chat_id: cleanChatId,
    text: text
  }, { timeout: 15000 });

  return { success: true, result: textResponse.data };
}

/**
 * Testa a conexão com o bot do Telegram.
 */
async function testTelegramConnection(botToken, chatId) {
  if (!botToken) throw new Error('Token do Bot não informado.');
  const response = await axios.get(`https://api.telegram.org/bot${botToken.trim()}/getMe`, { timeout: 8000 });
  const botInfo = response.data.result;

  let chatInfo = null;
  if (chatId) {
    try {
      const chatRes = await axios.get(`https://api.telegram.org/bot${botToken.trim()}/getChat`, {
        params: { chat_id: chatId.trim() },
        timeout: 8000
      });
      chatInfo = chatRes.data.result;
    } catch (err) {
      chatInfo = { error: 'Não foi possível validar o Chat ID. Certifique-se de que o bot é administrador do canal.' };
    }
  }

  return { bot: botInfo, chat: chatInfo };
}

module.exports = {
  sendTelegramOffer,
  testTelegramConnection
};
