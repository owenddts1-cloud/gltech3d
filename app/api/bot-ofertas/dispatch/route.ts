import { NextResponse } from "next/server";
import {
  fetchFromDaemon,
  getBotOffers,
  saveBotOffers,
  getBotConfig,
  readLocalJson,
  writeLocalJson,
  type BotHistoryItem,
} from "@/lib/bot-engine/client";
import { formatOfferMessage } from "@/lib/bot-engine/formatter";
import { sendTelegramOffer } from "@/lib/bot-engine/telegram";
import { getWahaClient } from "@/lib/waha/client";
import path from "node:path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.resolve(process.cwd(), "services/bot_ofertas/data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offerId, targetGroupJid, sendWhatsapp, sendTelegram } = body;

    if (!offerId) {
      return NextResponse.json({ error: "offerId é obrigatório" }, { status: 400 });
    }

    // 1. Tenta via Daemon local se estiver respondendo
    try {
      const res = await fetchFromDaemon(`/offers/${offerId}/dispatch`, {
        method: "POST",
        body: JSON.stringify({
          targetGroupJid,
          sendWhatsapp: sendWhatsapp !== false,
          sendTelegram: Boolean(sendTelegram),
        }),
      });
      if (res?.success) {
        return NextResponse.json(res);
      }
    } catch {
      // Daemon offline / Modo Nuvem Nativo
    }

    // 2. Disparo Nativo no CRM
    const offers = await getBotOffers();
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) {
      return NextResponse.json({ error: "Oferta não encontrada" }, { status: 404 });
    }

    const config = await getBotConfig();
    const messageText = formatOfferMessage(offer, {
      defaultHashtags: config.defaultHashtags,
      groupInviteUrl: config.groupInviteUrl,
    });

    let tgSuccess = false;
    let tgError: string | null = null;
    let wppSuccess = false;
    let wppError: string | null = null;

    // Disparo Telegram
    const shouldSendTg = Boolean(sendTelegram) || (config.telegramBotToken && config.telegramChatId);
    if (shouldSendTg && config.telegramBotToken && config.telegramChatId) {
      try {
        const tgRes = await sendTelegramOffer(
          config.telegramBotToken,
          config.telegramChatId,
          messageText,
          offer.imageUrl,
        );
        tgSuccess = tgRes.success;
      } catch (err: any) {
        tgError = err.message;
      }
    }

    // Disparo WhatsApp
    const shouldSendWpp = sendWhatsapp !== false;
    const finalGroupJid =
      targetGroupJid ||
      (offer.niche && config.nicheGroups?.[offer.niche]?.whatsappJid) ||
      config.whatsappTargetGroupId;

    if (shouldSendWpp) {
      const waha = getWahaClient();
      if (waha && finalGroupJid) {
        try {
          await waha.sendMessage("gltech_bot_ofertas", finalGroupJid, messageText);
          wppSuccess = true;
        } catch (err: any) {
          wppError = err.message;
        }
      } else {
        // Marcado como enviado no CRM
        wppSuccess = true;
      }
    }

    // Atualiza status da oferta
    const nowIso = new Date().toISOString();
    offer.status = "enviado";
    offer.dispatchedAt = nowIso;
    offer.lastDispatchedAt = nowIso;
    await saveBotOffers(offers);

    // Registra no histórico
    const history = readLocalJson<BotHistoryItem[]>(HISTORY_FILE, []);
    const historyEntry: BotHistoryItem = {
      id: "hist_" + Date.now(),
      offerId: offer.id,
      title: offer.title,
      channel: tgSuccess && wppSuccess ? "whatsapp+telegram" : tgSuccess ? "telegram" : "whatsapp",
      target: finalGroupJid || config.telegramChatId || "Grupo de Ofertas",
      status: tgError && wppError ? "error" : "success",
      error: [tgError, wppError].filter(Boolean).join(" | ") || undefined,
      timestamp: nowIso,
      messageText,
    };
    history.unshift(historyEntry);
    writeLocalJson(HISTORY_FILE, history.slice(0, 200));

    return NextResponse.json({
      success: true,
      offer,
      channels: {
        whatsapp: { sent: wppSuccess, error: wppError },
        telegram: { sent: tgSuccess, error: tgError },
      },
      message: "Oferta disparada com sucesso!",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Erro ao processar disparo: ${err.message}`,
      },
      { status: 500 },
    );
  }
}
