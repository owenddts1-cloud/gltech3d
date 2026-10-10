import { NextResponse } from "next/server";
import { fetchFromDaemon } from "@/lib/bot-engine/client";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { offerId, targetGroupJid, sendWhatsapp, sendTelegram } = body;

    if (!offerId) {
      return NextResponse.json({ error: "offerId é obrigatório" }, { status: 400 });
    }

    const res = await fetchFromDaemon(`/offers/${offerId}/dispatch`, {
      method: "POST",
      body: JSON.stringify({
        targetGroupJid,
        sendWhatsapp: sendWhatsapp !== false,
        sendTelegram: Boolean(sendTelegram),
      }),
    });

    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Falha ao disparar. Certifique-se de que o daemon do bot está rodando (npm run bot) e o WhatsApp conectado. (${err.message})`,
      },
      { status: 503 },
    );
  }
}
