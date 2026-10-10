import { NextResponse } from "next/server";
import { getBotStatus } from "@/lib/bot-engine/client";

export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getBotStatus();
  return NextResponse.json(status);
}
