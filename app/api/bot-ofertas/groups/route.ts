import { NextResponse } from "next/server";
import { fetchFromDaemon } from "@/lib/bot-engine/client";

export async function GET() {
  try {
    const res = await fetchFromDaemon("/whatsapp/groups");
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ groups: [], error: err.message });
  }
}
