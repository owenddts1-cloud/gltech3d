import { NextResponse } from "next/server";
import { getBotHistory } from "@/lib/bot-engine/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const history = await getBotHistory();
  return NextResponse.json({ history });
}
