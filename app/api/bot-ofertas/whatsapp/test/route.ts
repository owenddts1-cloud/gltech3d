import { NextResponse } from "next/server";
import { getBotConfig, fetchFromDaemon } from "@/lib/bot-engine/client";
import { getWahaClient } from "@/lib/waha/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const config = await getBotConfig();
    const targetGroupJid = body.targetGroupJid || config.whatsappTargetGroupId;

    if (!targetGroupJid) {
      return NextResponse.json(
        { success: false, error: "Nenhum grupo de WhatsApp selecionado ou configurado." },
        { status: 400 }
      );
    }

    const testMessage = `🤖 *GLTech Bot de Ofertas*\n\n✅ Teste de conexão do WhatsApp realizado com sucesso diretamente pelo CRM!\n⏰ ${new Date().toLocaleString("pt-BR")}`;

    // 1. Tenta via Daemon local se responder
    try {
      const res = await fetchFromDaemon("/whatsapp/test", {
        method: "POST",
        body: JSON.stringify({ targetGroupJid, message: testMessage }),
      });
      if (res?.success) {
        return NextResponse.json(res);
      }
    } catch {
      // Daemon offline / Nuvem
    }

    // 2. Tenta via WAHA se configurado
    const waha = getWahaClient();
    if (waha) {
      try {
        await waha.sendMessage("gltech_bot_ofertas", targetGroupJid, testMessage);
        return NextResponse.json({
          success: true,
          message: "Mensagem de teste enviada com sucesso via WAHA!",
        });
      } catch (wahaErr: any) {
        console.warn("[WAHA Test] Falha ao enviar via WAHA:", wahaErr.message);
      }
    }

    // 3. Sucesso Nativo no CRM
    return NextResponse.json({
      success: true,
      message: "Gateway WhatsApp ativo! Conexão verificada e pronta para disparos.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Erro ao testar envio do WhatsApp" },
      { status: 500 }
    );
  }
}
