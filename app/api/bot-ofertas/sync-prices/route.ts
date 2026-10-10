import { NextResponse } from "next/server";
import { getBotOffers, saveBotOffers, readLocalJson, writeLocalJson, type BotHistoryItem } from "@/lib/bot-engine/client";
import { scrapeProductInfo } from "@/lib/bot-engine/scraper";
import path from "node:path";

export const dynamic = "force-dynamic";

const DATA_DIR = path.resolve(process.cwd(), "services/bot_ofertas/data");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export async function GET(req: Request) {
  return handleSync(req);
}

export async function POST(req: Request) {
  return handleSync(req);
}

async function handleSync(_req: Request) {
  const startTime = Date.now();
  try {
    const offers = await getBotOffers();
    const candidateOffers = offers.filter(
      (o) => o.affiliateUrl && o.affiliateUrl.startsWith("http") && o.status !== "esgotado",
    );

    let updatedCount = 0;
    const changes: Array<{ id: string; title: string; oldPrice: number; newPrice: number; coupon?: string }> = [];

    // Processa até 15 ofertas por ciclo para manter resposta rápida e dentro do timeout serverless
    const batch = candidateOffers.slice(0, 15);

    for (const offer of batch) {
      try {
        const fresh = await scrapeProductInfo(offer.affiliateUrl);

        if (fresh && fresh.promoPrice > 0) {
          const oldPrice = offer.promoPrice;
          const diff = Math.abs(oldPrice - fresh.promoPrice);
          const priceChanged = diff > 0.05;

          if (priceChanged) {
            offer.promoPrice = fresh.promoPrice;
            if (fresh.originalPrice > 0) {
              offer.originalPrice = fresh.originalPrice;
            }
            if (fresh.coupon && !offer.coupon) {
              offer.coupon = fresh.coupon;
            }
            if (fresh.couponTutorial && !(offer as any).couponTutorial) {
              (offer as any).couponTutorial = fresh.couponTutorial;
            }

            changes.push({
              id: offer.id,
              title: offer.title,
              oldPrice,
              newPrice: fresh.promoPrice,
              coupon: fresh.coupon,
            });

            updatedCount++;
          }

          (offer as any).lastPriceCheckAt = new Date().toISOString();
        }
      } catch (err: any) {
        console.warn(`[SyncPrices] Falha ao verificar ${offer.title}:`, err.message);
      }
    }

    if (updatedCount > 0) {
      await saveBotOffers(offers);

      // Registra alteração de preço no histórico
      const history = readLocalJson<BotHistoryItem[]>(HISTORY_FILE, []);
      for (const ch of changes) {
        history.unshift({
          id: "hist_price_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
          offerId: ch.id,
          title: ch.title,
          channel: "price_sync",
          target: "Atualização Automática de Preço (5 min)",
          status: "success",
          timestamp: new Date().toISOString(),
          messageText: `Preço atualizado automaticamente na loja: de R$ ${ch.oldPrice.toFixed(2)} para R$ ${ch.newPrice.toFixed(2)}${ch.coupon ? ` (Cupom: ${ch.coupon})` : ""}`,
        });
      }
      writeLocalJson(HISTORY_FILE, history.slice(0, 200));
    }

    const durationMs = Date.now() - startTime;
    return NextResponse.json({
      success: true,
      totalChecked: batch.length,
      updatedCount,
      changes,
      durationMs,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Erro ao sincronizar preços: ${err.message}`,
      },
      { status: 500 },
    );
  }
}
