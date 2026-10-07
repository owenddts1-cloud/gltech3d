import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "node:crypto";

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const platform = url.searchParams.get("platform") || "Shopee";
    const secret = request.headers.get("x-webhook-secret") || url.searchParams.get("secret");

    if (!secret) {
      return NextResponse.json({ ok: false, error: "Missing x-webhook-secret header or secret query param" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    const supabase = await createClient();

    // Verify channel integration by secret
    const { data: integration, error: intError } = await supabase
      .from("sales_channel_integrations")
      .select("id, organization_id, platform, is_enabled")
      .eq("webhook_secret", secret)
      .maybeSingle();

    if (intError || !integration) {
      return NextResponse.json({ ok: false, error: "Invalid webhook secret" }, { status: 403 });
    }

    if (!integration.is_enabled) {
      return NextResponse.json({ ok: false, error: "Integration is disabled" }, { status: 400 });
    }

    // Process order
    const orderId = body.order_id || body.id || `ord_${randomUUID().slice(0, 8)}`;
    const totalAmount = Number(body.total || body.amount || 100);
    const feeAmount = Number(body.fee || (totalAmount * 0.14));

    const today = new Date().toISOString().split("T")[0]!;
    const monthNames = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];
    const curMonth = monthNames[new Date().getMonth()]!;

    const finId = randomUUID();
    const revenueCents = Math.round(totalAmount * 100);
    const feeCents = Math.round(feeAmount * 100);

    await supabase.from("financial_records").insert({
      id: finId,
      organization_id: integration.organization_id,
      date: today,
      month: curMonth,
      quantity: 1,
      description: `[Webhook ${integration.platform}] Pedido #${orderId}`,
      type: "Receita",
      category: "Vendas",
      revenue_cents: revenueCents,
      expense_cents: 0,
      platform_fee_cents: feeCents,
      net_cents: revenueCents - feeCents,
      status: "reconciled",
      reconciled_at: new Date().toISOString(),
      platform: integration.platform,
    });

    await supabase
      .from("sales_channel_integrations")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", integration.id);

    return NextResponse.json({
      ok: true,
      message: "Webhook processed successfully",
      platform: integration.platform,
      orderId,
      financialRecordId: finId,
    });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return NextResponse.json({ ok: false, error: "Internal server error" }, { status: 500 });
  }
}
