import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const N8N_KEEPALIVE_URL =
  process.env.N8N_WEBHOOK_URL ||
  "https://n8n-636f.onrender.com/webhook/780020eb-c627-4e45-baf1-c046447e5a7b";

export async function POST(req: Request) {
  const startTime = Date.now();
  try {
    const body = await req.json().catch(() => ({}));
    const targetUrl = body.url || N8N_KEEPALIVE_URL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent": "GLTech-CRM-Ping/1.0",
        Accept: "application/json, text/plain, */*",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;
    const text = await res.text();

    let parsedData = null;
    try {
      parsedData = JSON.parse(text);
    } catch {
      parsedData = text.slice(0, 300);
    }

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        statusCode: res.status,
        responseTimeMs: elapsed,
        targetUrl,
        error: `O n8n no Render respondeu com HTTP ${res.status}`,
        details: parsedData,
      });
    }

    return NextResponse.json({
      success: true,
      statusCode: res.status,
      responseTimeMs: elapsed,
      targetUrl,
      data: parsedData,
      message: "Webhook respondendo com sucesso 24/7!",
    });
  } catch (err: any) {
    const elapsed = Date.now() - startTime;
    return NextResponse.json({
      success: false,
      statusCode: 504,
      responseTimeMs: elapsed,
      error: `Falha ao alcançar webhook: ${err.message}`,
    });
  }
}
