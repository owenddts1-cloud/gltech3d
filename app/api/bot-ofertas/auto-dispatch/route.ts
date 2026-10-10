import { NextResponse } from "next/server";
import {
  getBotConfig,
  getBotOffers,
  saveBotOffers,
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
    const config = await getBotConfig();
    const offers = await getBotOffers();

    if (!config.autoDispatchEnabled) {
      return NextResponse.json({
        success: true,
        dispatched: false,
        message: "Automação contínua está pausada na aba Anti-Ban & Horários.",
      });
    }

    // Janela de horário seguro
    const now = new Date();
    const currentHour = now.getHours();
    const startHour = parseInt(String(config.dispatchStartHour), 10) || 9;
    const endHour = parseInt(String(config.dispatchEndHour), 10) || 23;

    if (currentHour < startHour || currentHour >= endHour) {
      return NextResponse.json({
        success: true,
        dispatched: false,
        message: `Fora da janela de horário permitida (${startHour}h às ${endHour}h).`,
      });
    }

    // 1. Busca próxima oferta pendente
    let offerToDispatch = offers.find((o) => o.status === "pendente");

    // 2. Se a fila estiver zerada e o modo rodízio/reciclagem estiver ativo, pega a enviada há mais tempo
    if (!offerToDispatch && config.recycleMode !== false) {
      const sentOffers = offers.filter((o) => o.status === "enviado");
      if (sentOffers.length > 0) {
        offerToDispatch = sentOffers.sort(
          (a, b) =>
            new Date(a.lastDispatchedAt || a.dispatchedAt || 0).getTime() -
            new Date(b.lastDispatchedAt || b.dispatchedAt || 0).getTime()
        )[0];
      }
    }

    if (!offerToDispatch) {
      return NextResponse.json({
        success: true,
        dispatched: false,
        message: "Nenhuma oferta pendente para disparo na fila.",
      });
    }

    // 3. Monta mensagem formatada com copy de nicho inteligente
    const messageText = formatOfferMessage(offerToDispatch, {
      defaultHashtags: config.defaultHashtags,
      groupInviteUrl: config.groupInviteUrl,
    });

    let tgSuccess = false;
    let tgError: string | null = null;
    let wppSuccess = false;
    let wppError: string | null = null;

    // Disparo Telegram
    if (config.telegramBotToken && config.telegramChatId) {
      try {
        const tgRes = await sendTelegramOffer(
          config.telegramBotToken,
          config.telegramChatId,
          messageText,
          offerToDispatch.imageUrl
        );
        tgSuccess = tgRes.success;
      } catch (err: any) {
        tgError = err.message;
      }
    }

    // Disparo WhatsApp
    const targetGroupJid =
      (offerToDispatch.niche && config.nicheGroups?.[offerToDispatch.niche]?.whatsappJid) ||
      config.whatsappTargetGroupId;

    const waha = getWahaClient();
    if (waha && targetGroupJid) {
      try {
        await waha.sendMessage("gltech_bot_ofertas", targetGroupJid, messageText);
        wppSuccess = true;
      } catch (err: any) {
        wppError = err.message;
      }
    } else {
      wppSuccess = true;
    }

    // 4. Atualiza oferta
    const nowIso = new Date().toISOString();
    offerToDispatch.status = "enviado";
    offerToDispatch.dispatchedAt = nowIso;
    offerToDispatch.lastDispatchedAt = nowIso;
    await saveBotOffers(offers);

    // 5. Registra no histórico
    const history = readLocalJson<BotHistoryItem[]>(HISTORY_FILE, []);
    const historyEntry: BotHistoryItem = {
      id: "hist_auto_" + Date.now(),
      offerId: offerToDispatch.id,
      title: offerToDispatch.title,
      channel: tgSuccess && wppSuccess ? "whatsapp+telegram" : tgSuccess ? "telegram" : "whatsapp",
      target: targetGroupJid || config.telegramChatId || "Grupo Automático",
      status: tgError && wppError ? "error" : "success",
      error: [tgError, wppError].filter(Boolean).join(" | ") || undefined,
      timestamp: nowIso,
      messageText,
    };
    history.unshift(historyEntry);
    writeLocalJson(HISTORY_FILE, history.slice(0, 200));

    return NextResponse.json({
      success: true,
      dispatched: true,
      offer: offerToDispatch,
      channels: {
        whatsapp: { sent: wppSuccess, error: wppError },
        telegram: { sent: tgSuccess, error: tgError },
      },
      message: `Oferta "${offerToDispatch.title}" disparada com sucesso!`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro no disparo automático" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}
