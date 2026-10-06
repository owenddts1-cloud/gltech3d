"use client";
import type { RealtimeStatus } from "@/hooks/realtime/useRealtimeChannel";

/**
 * Platform-admin inbox realtime: intentionally DISABLED.
 *
 * The admin inbox is cross-tenant, and Supabase broadcast channels are public
 * (no Realtime Authorization yet — see docs/runbooks/pendencias-em-aberto.md):
 * a shared channel would leak every tenant's message activity to anyone with
 * the anon key. `postgres_changes` does not work either (the browser client has
 * no session). Freshness comes from polling in `useAdminInbox`
 * (`ADMIN_INBOX_POLL_MS`).
 *
 * Kept as a stable no-op so existing callers (`InboxList`) need no change.
 */
export function useAdminInboxRealtime(): { status: RealtimeStatus } {
  return { status: "closed" };
}
