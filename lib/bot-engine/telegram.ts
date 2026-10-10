/**
 * Cliente nativo de Telegram para o Next.js (Serverless-ready).
 * Executa chamadas HTTPS diretas para a Telegram Bot API sem depender de nenhum daemon externo.
 */

export interface TelegramTestResult {
  bot: any;
  chat?: any;
}

export async function sendTelegramOffer(
  botToken: string,
  chatId: string,
  text: string,
  imageUrl?: string,
): Promise<{ success: boolean; result?: any; error?: string }> {
  if (!botToken || !chatId) {
    throw new Error("Telegram Bot Token ou Chat ID não configurados.");
  }

  const cleanToken = botToken.trim();
  const cleanChatId = chatId.trim();

  // Se houver imagem válida, tenta enviar com foto
  if (imageUrl && imageUrl.startsWith("http")) {
    try {
      const photoRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendPhoto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: cleanChatId,
          photo: imageUrl,
          caption: text,
        }),
      });

      const photoData = await photoRes.json();
      if (photoData.ok) {
        return { success: true, result: photoData.result };
      }
      console.warn("[Telegram Native] Falha ao enviar foto, tentando texto simples:", photoData.description);
    } catch (err: any) {
      console.warn("[Telegram Native] Exceção ao enviar foto:", err.message);
    }
  }

  // Fallback: mensagem de texto pura
  const textRes = await fetch(`https://api.telegram.org/bot${cleanToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: cleanChatId,
      text: text,
    }),
  });

  const textData = await textRes.json();
  if (!textData.ok) {
    throw new Error(textData.description || "Erro desconhecido na Telegram Bot API");
  }

  return { success: true, result: textData.result };
}

export async function testTelegramConnection(
  botToken: string,
  chatId?: string,
): Promise<TelegramTestResult> {
  if (!botToken) throw new Error("Token do Bot não informado.");

  const botRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
  const botData = await botRes.json();
  if (!botData.ok) {
    throw new Error(botData.description || "Token inválido do Telegram.");
  }

  let chatInfo = null;
  if (chatId) {
    try {
      const chatRes = await fetch(
        `https://api.telegram.org/bot${botToken.trim()}/getChat?chat_id=${encodeURIComponent(chatId.trim())}`,
      );
      const chatData = await chatRes.json();
      chatInfo = chatData.ok
        ? chatData.result
        : { error: chatData.description || "Não foi possível validar o Chat ID. Certifique-se de que o bot é administrador do canal." };
    } catch {
      chatInfo = { error: "Falha de rede ao consultar Chat ID." };
    }
  }

  return { bot: botData.result, chat: chatInfo };
}
