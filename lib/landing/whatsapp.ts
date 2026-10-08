/**
 * The store's WhatsApp number, resolved on the server from the Links manager
 * (`landing_settings.links.whatsapp` of the landing org — the same row the
 * footer and the product buttons read).
 *
 * Single source: server pages call this and pass the digits to their client
 * components as a prop; pure helpers to format/link it are in
 * `lib/landing/whatsapp-number.ts`. Falls back to STORE_WHATSAPP_FALLBACK when
 * the link is empty, not a WhatsApp link, or the read fails (logged).
 */
import "server-only";
import { unstable_cache } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/logger";
import { asLinks } from "@/lib/landing/links";
import { LANDING_CACHE_TAG, resolveLandingOrgId } from "@/lib/landing/repository";
import { STORE_WHATSAPP_FALLBACK, whatsappDigitsFrom } from "@/lib/landing/whatsapp-number";

async function fetchStoreWhatsapp(): Promise<string> {
  try {
    const organizationId = await resolveLandingOrgId();
    const { data, error } = await createAdminClient()
      .from("landing_settings")
      .select("links")
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (error) {
      logger.warn("store_whatsapp_read_failed", { details: error.message });
      return STORE_WHATSAPP_FALLBACK;
    }
    const link = asLinks((data as { links: unknown } | null)?.links).whatsapp;
    return whatsappDigitsFrom(link) ?? STORE_WHATSAPP_FALLBACK;
  } catch (err) {
    logger.warn("store_whatsapp_read_threw", {
      details: err instanceof Error ? err.message : String(err),
    });
    return STORE_WHATSAPP_FALLBACK;
  }
}

/**
 * Digits (with country code) of the store's WhatsApp. Cached under the landing
 * tag, so editing the Links manager (`revalidateLanding()`) updates it; the
 * 1-hour expiry heals a fallback served during an outage.
 */
export const getStoreWhatsapp: () => Promise<string> = unstable_cache(
  fetchStoreWhatsapp,
  ["store-whatsapp"],
  { tags: [LANDING_CACHE_TAG], revalidate: 3600 },
);
