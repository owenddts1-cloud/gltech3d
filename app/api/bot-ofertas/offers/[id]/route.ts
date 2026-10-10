import { NextResponse } from "next/server";
import { getBotOffers, saveBotOffers, fetchFromDaemon } from "@/lib/bot-engine/client";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  try {
    const res = await fetchFromDaemon(`/offers/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return NextResponse.json(res);
  } catch {
    const offers = await getBotOffers();
    const idx = offers.findIndex((o) => o.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Oferta não encontrada" }, { status: 404 });
    }
    offers[idx] = { ...offers[idx], ...body };
    await saveBotOffers(offers);
    return NextResponse.json({ success: true, offer: offers[idx] });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const res = await fetchFromDaemon(`/offers/${id}`, { method: "DELETE" });
    return NextResponse.json(res);
  } catch {
    const offers = await getBotOffers();
    const filtered = offers.filter((o) => o.id !== id);
    await saveBotOffers(filtered);
    return NextResponse.json({ success: true });
  }
}
