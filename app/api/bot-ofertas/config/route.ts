import { NextResponse } from "next/server";
import { getBotConfig, saveBotConfig } from "@/lib/bot-engine/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = await getBotConfig();
  return NextResponse.json(config);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const updated = await saveBotConfig(body);
    return NextResponse.json({ success: true, config: updated });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 400 });
  }
}
