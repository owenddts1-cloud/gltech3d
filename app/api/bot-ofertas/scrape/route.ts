import { NextResponse } from "next/server";
import { fetchFromDaemon } from "@/lib/bot-engine/client";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Informe uma URL válida iniciando com http:// ou https://" }, { status: 400 });
    }

    // Tenta via daemon primeiro
    try {
      const res = await fetchFromDaemon("/offers/scrape", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      return NextResponse.json(res);
    } catch {
      // Fallback nativo simples
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      });
      const html = await response.text();

      const titleMatch =
        html.match(/<meta property="og:title" content="([^"]+)"/i) ||
        html.match(/<title>([^<]+)<\/title>/i);
      const imageMatch =
        html.match(/<meta property="og:image" content="([^"]+)"/i) ||
        html.match(/<meta name="twitter:image" content="([^"]+)"/i);
      const priceMatch =
        html.match(/<meta property="product:price:amount" content="([^"]+)"/i) ||
        html.match(/<meta property="og:price:amount" content="([^"]+)"/i);

      const rawTitle = titleMatch?.[1] || "";
      const title = rawTitle.replace(/\s*\|.*$/, "").replace(/\s*-.*Mercado Livre.*$/i, "").trim();

      const imageUrl = imageMatch?.[1] || "";
      const promoPrice = priceMatch?.[1] ? parseFloat(priceMatch[1].replace(",", ".")) : 0;

      return NextResponse.json({
        success: true,
        data: {
          title,
          imageUrl,
          promoPrice,
          originalUrl: url,
        },
      });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
