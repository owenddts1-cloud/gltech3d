/**
 * Server reader of `platform_settings` (migration 0087).
 *
 * Uses a cookie-less ANON client: the row is public by design (prices shown on
 * the landing) and `unstable_cache` forbids `cookies()` inside the cached
 * function. Least privilege — no service role for a public read.
 *
 * Fallback: any failure (table missing on a clone that did not migrate yet,
 * network, invalid row) logs and serves DEFAULT_PLATFORM_SETTINGS, so the
 * checkout never shows an empty price. The cache also expires every 5 minutes,
 * so a fallback served during an outage heals by itself; an admin edit
 * invalidates the tag immediately (PATCH /api/v1/admin/platform-settings).
 */
import { unstable_cache, revalidateTag } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { proPlanWith, type ProPlan } from "@/lib/pricing/pro-plans";
import {
  DEFAULT_PLATFORM_SETTINGS,
  parsePlatformSettingsRow,
  type PlatformSettings,
} from "@/lib/pricing/settings-schema";

export const PLATFORM_SETTINGS_TAG = "platform-settings";

export const PLATFORM_SETTINGS_COLUMNS =
  "pro_price_cents, pro_period_days, trial_days, pro_benefits, calculator_defaults, updated_at, updated_by";

async function fetchPlatformSettings(): Promise<PlatformSettings> {
  try {
    const db = createSupabaseClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await db
      .from("platform_settings")
      .select(PLATFORM_SETTINGS_COLUMNS)
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      logger.error("platform_settings_read_failed", { code: error.code, details: error.message });
      return { ...DEFAULT_PLATFORM_SETTINGS };
    }
    if (!data) {
      logger.warn("platform_settings_row_missing", {});
      return { ...DEFAULT_PLATFORM_SETTINGS };
    }
    return parsePlatformSettingsRow(data);
  } catch (err) {
    logger.error("platform_settings_read_threw", {
      details: err instanceof Error ? err.message : String(err),
    });
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }
}

/** Current platform settings (cached; tag `platform-settings`). Never throws. */
export const getPlatformSettings: () => Promise<PlatformSettings> = unstable_cache(
  fetchPlatformSettings,
  ["platform-settings"],
  { tags: [PLATFORM_SETTINGS_TAG], revalidate: 300 },
);

/** Uncached read, for the admin API (it must show what is in the row right now). */
export const readPlatformSettingsUncached = fetchPlatformSettings;

/** The PRO plan with the live price and period. Use this on the server, never `PRO_PLANS` directly. */
export async function getProPlanLive(): Promise<ProPlan> {
  const s = await getPlatformSettings();
  return proPlanWith({ amountCents: s.proPriceCents, periodDays: s.proPeriodDays });
}

/** Live trial length in days. */
export async function getTrialDaysLive(): Promise<number> {
  return (await getPlatformSettings()).trialDays;
}

export function revalidatePlatformSettings(): void {
  revalidateTag(PLATFORM_SETTINGS_TAG);
}
