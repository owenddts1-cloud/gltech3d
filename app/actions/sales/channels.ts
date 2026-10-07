"use server";

import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { loadAuthUser, resolveActiveOrg } from "@/lib/auth/server";
import { assertProAccess } from "@/lib/plan/server";

export interface SalesChannelIntegration {
  id: string;
  platform: 'Shopee' | 'Mercado Livre' | 'Facebook';
  is_enabled: boolean;
  credentials: Record<string, string>;
  webhook_secret: string;
  last_synced_at?: string;
}

export async function fetchChannelIntegration(
  platform: 'Shopee' | 'Mercado Livre' | 'Facebook'
): Promise<{ ok: boolean; integration?: SalesChannelIntegration; error?: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sales_channel_integrations")
    .select("*")
    .eq("organization_id", activeOrg.orgId)
    .eq("platform", platform)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };

  if (!data) {
    // Generate default unconfigured state
    const webhook_secret = `whsec_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
    return {
      ok: true,
      integration: {
        id: "",
        platform,
        is_enabled: false,
        credentials: {},
        webhook_secret,
      },
    };
  }

  return {
    ok: true,
    integration: {
      id: data.id,
      platform: data.platform as 'Shopee' | 'Mercado Livre' | 'Facebook',
      is_enabled: data.is_enabled,
      credentials: data.credentials || {},
      webhook_secret: data.webhook_secret || `whsec_${data.id.slice(0, 16)}`,
      last_synced_at: data.last_synced_at || undefined,
    },
  };
}

export async function saveChannelCredentials(
  platform: 'Shopee' | 'Mercado Livre' | 'Facebook',
  is_enabled: boolean,
  credentials: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };
  const denied = await assertProAccess(activeOrg.orgId);
  if (denied) return { ok: false, error: denied };

  const supabase = await createClient();

  const webhook_secret = `whsec_${randomUUID().replace(/-/g, "").slice(0, 24)}`;

  const { error } = await supabase
    .from("sales_channel_integrations")
    .upsert(
      {
        organization_id: activeOrg.orgId,
        platform,
        is_enabled,
        credentials,
        webhook_secret,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,platform" }
    );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function simulateTestSale(
  platform: 'Shopee' | 'Mercado Livre' | 'Facebook'
): Promise<{ ok: boolean; saleId?: string; financialRecordId?: string; error?: string }> {
  const authUser = await loadAuthUser();
  if (!authUser) return { ok: false, error: "Unauthenticated" };
  const activeOrg = await resolveActiveOrg(authUser);
  if (!activeOrg) return { ok: false, error: "No active organization" };

  const supabase = await createClient();

  const today = new Date().toISOString().split("T")[0]!;
  const monthNames = ["JAN.", "FEV.", "MAR.", "ABR.", "MAI.", "JUN.", "JUL.", "AGO.", "SET.", "OUT.", "NOV.", "DEZ."];
  const curMonth = monthNames[new Date().getMonth()]!;

  const salePrice = 120.0;
  const platformFeeRates: Record<string, number> = {
    Shopee: 0.14,
    "Mercado Livre": 0.16,
    Facebook: 0.05,
  };
  const rate = platformFeeRates[platform] ?? 0.1;
  const feeCents = Math.round(salePrice * 100 * rate);
  const revenueCents = Math.round(salePrice * 100);

  // 1. Create financial record
  const finId = randomUUID();
  const { error: finError } = await supabase.from("financial_records").insert({
    id: finId,
    organization_id: activeOrg.orgId,
    date: today,
    month: curMonth,
    quantity: 1,
    description: `[Simulação] Venda Teste ${platform} #${finId.slice(0, 6)}`,
    type: "Receita",
    category: "Vendas",
    revenue_cents: revenueCents,
    expense_cents: 0,
    platform_fee_cents: feeCents,
    net_cents: revenueCents - feeCents,
    status: "reconciled",
    reconciled_at: new Date().toISOString(),
    platform,
    created_by: authUser.id,
  });

  if (finError) {
    console.error("Test sale financial record insert error:", finError);
    return { ok: false, error: finError.message };
  }

  // 2. Update last_synced_at on integration
  await supabase
    .from("sales_channel_integrations")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("organization_id", activeOrg.orgId)
    .eq("platform", platform);

  return { ok: true, saleId: `sim_${finId.slice(0, 8)}`, financialRecordId: finId };
}
