import { NextResponse } from "next/server";
import { fetchFromDaemon, getBotStatus } from "@/lib/bot-engine/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const res = await fetchFromDaemon("/whatsapp/groups");
    if (res?.groups && res.groups.length > 0) {
      return NextResponse.json(res);
    }
  } catch {
    // Daemon offline / fallback nativo
  }

  const status = await getBotStatus();
  return NextResponse.json({
    groups: status.whatsapp.groups || [],
    success: true,
  });
}
