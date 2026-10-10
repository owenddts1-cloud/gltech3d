import { NextResponse } from "next/server";
import { getBotOffers, saveBotOffers } from "@/lib/bot-engine/client";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const offers = await getBotOffers();
    const index = offers.findIndex((o) => o.id === id);
    const currentOffer = offers[index];
    if (index === -1 || !currentOffer) {
      return NextResponse.json({ success: false, error: "Oferta não encontrada" }, { status: 404 });
    }

    const targetUrl = currentOffer.affiliateUrl;

    if (!targetUrl || !targetUrl.startsWith("http")) {
      return NextResponse.json(
        { success: false, error: "Oferta não possui URL válida para re-consulta" },
        { status: 400 },
      );
    }

    // Tenta re-extrair dados via scraping nativo resiliente
    try {
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        cache: "no-store",
      });

      const html = await response.text();
      const priceMatch =
        html.match(/<meta property="product:price:amount" content="([^"]+)"/i) ||
        html.match(/<meta property="og:price:amount" content="([^"]+)"/i);

      let updatedPrice = 0;
      if (priceMatch?.[1]) {
        updatedPrice = parseFloat(priceMatch[1].replace(",", ".")) || 0;
      }

      const updatedOffer = {
        ...currentOffer,
        promoPrice: updatedPrice > 0 ? updatedPrice : currentOffer.promoPrice,
        lastDispatchedAt: currentOffer.dispatchedAt,
      };

      offers[index] = updatedOffer;
      await saveBotOffers(offers);

      return NextResponse.json({
        success: true,
        offer: updatedOffer,
        updatedPrice: updatedPrice > 0 ? updatedPrice : null,
      });
    } catch (scrapeErr: any) {
      return NextResponse.json({
        success: false,
        error: `Não foi possível atualizar os dados da loja: ${scrapeErr.message}`,
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
