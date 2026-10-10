import { NextResponse } from "next/server";
import { getBotOffers, saveBotOffers, fetchFromDaemon, type BotOffer } from "@/lib/bot-engine/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const offers = await getBotOffers();
  return NextResponse.json({ offers });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Tenta gravar via daemon primeiro
    try {
      const res = await fetchFromDaemon("/offers", {
        method: "POST",
        body: JSON.stringify(body),
      });
      return NextResponse.json(res);
    } catch {
      // Fallback: adiciona localmente
      const offers = await getBotOffers();
      const newOffer: BotOffer = {
        id: "off_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7),
        title: body.title || "",
        category: body.category || "Filamentos 3D",
        originalPrice: parseFloat(body.originalPrice) || 0,
        promoPrice: parseFloat(body.promoPrice) || 0,
        coupon: body.coupon || "",
        affiliateUrl: body.affiliateUrl || "",
        imageUrl: body.imageUrl || "",
        status: body.status || "pendente",
        createdAt: new Date().toISOString(),
        dispatchedAt: null,
      };
      offers.unshift(newOffer);
      await saveBotOffers(offers);
      return NextResponse.json({ success: true, offer: newOffer });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
