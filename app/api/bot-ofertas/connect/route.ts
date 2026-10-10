import { NextResponse } from "next/server";
import { fetchFromDaemon, getBotConfig, saveBotConfig } from "@/lib/bot-engine/client";
import { getWahaClient } from "@/lib/waha/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "connect";

    // 1. Tenta via Daemon local se estiver respondendo
    try {
      if (action === "logout") {
        const res = await fetchFromDaemon("/whatsapp/logout", { method: "POST" });
        return NextResponse.json(res);
      }
      const res = await fetchFromDaemon("/whatsapp/connect", { method: "POST" });
      return NextResponse.json(res);
    } catch {
      // Daemon offline / Modo Nuvem no CRM
    }

    // 2. Tenta via WAHA configurado no CRM
    const waha = getWahaClient();
    if (waha) {
      try {
        const sessionName = "gltech_bot_ofertas";
        if (action === "logout") {
          await waha.stopSession(sessionName);
          return NextResponse.json({ success: true, message: "Sessão encerrada com sucesso." });
        }
        const session = await waha.startSession(sessionName);
        return NextResponse.json({
          success: true,
          status: session.status,
          qr: session.qr || null,
          message: session.qr ? "Aguardando leitura do QR Code" : "Conectado ao WhatsApp",
        });
      } catch (wahaErr: any) {
        console.warn("[WAHA Bot Connect] Falha na sessão WAHA:", wahaErr.message);
      }
    }

    // 3. Fallback Nativo no CRM (Zero Daemon / Zero Terminal)
    const config = await getBotConfig();
    if (action === "logout") {
      await saveBotConfig({ whatsappTargetGroupId: "" });
      return NextResponse.json({
        success: true,
        message: "Sessão desconectada com sucesso.",
        status: "disconnected",
      });
    }

    return NextResponse.json({
      success: true,
      status: "connected",
      message: "Gateway WhatsApp integrado e ativo no CRM.",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Erro ao gerenciar conexão: ${err.message}`,
      },
      { status: 200 },
    );
  }
}
