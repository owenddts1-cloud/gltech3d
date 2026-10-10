import { NextResponse } from "next/server";
import { fetchFromDaemon } from "@/lib/bot-engine/client";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "connect";

    if (action === "logout") {
      const res = await fetchFromDaemon("/whatsapp/logout", { method: "POST" });
      return NextResponse.json(res);
    }

    const res = await fetchFromDaemon("/whatsapp/connect", { method: "POST" });
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: `Serviço do Bot offline. Inicie o daemon no terminal: npm run bot. (${err.message})`,
      },
      { status: 503 },
    );
  }
}
