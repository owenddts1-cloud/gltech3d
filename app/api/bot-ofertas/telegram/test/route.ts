import { NextResponse } from "next/server";
import { testTelegramConnection } from "@/lib/bot-engine/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { botToken, chatId } = await req.json();
    if (!botToken) {
      return NextResponse.json({ success: false, error: "Token do bot é obrigatório" }, { status: 400 });
    }

    const result = await testTelegramConnection(botToken, chatId);
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
