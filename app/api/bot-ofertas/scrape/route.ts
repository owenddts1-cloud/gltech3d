import { NextResponse } from "next/server";
import { fetchFromDaemon } from "@/lib/bot-engine/client";
import { scrapeProductInfo } from "@/lib/bot-engine/scraper";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { url } = await req.json();
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "Informe uma URL válida iniciando com http:// ou https://" }, { status: 400 });
    }

    // 1. Tenta via daemon se estiver disponível
    try {
      const res = await fetchFromDaemon("/offers/scrape", {
        method: "POST",
        body: JSON.stringify({ url }),
      });
      if (res?.success && res?.data) {
        return NextResponse.json(res);
      }
    } catch {
      // Daemon offline / ambiente Serverless Vercel: usa scraper nativo
    }

    // 2. Executa Scraper Nativo do CRM
    const scraped = await scrapeProductInfo(url);
    return NextResponse.json({
      success: true,
      data: scraped,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || "Erro ao processar extração" }, { status: 500 });
  }
}
