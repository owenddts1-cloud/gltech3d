/**
 * Pure helpers of the Subscribers panel (/admin/assinantes) API.
 *
 * Kept out of the route handlers so the parts that touch PostgREST filter
 * strings (search term, cursor) can be tested: both are interpolated into
 * `.or(...)`, and an unsanitized comma or parenthesis there would let the query
 * string rewrite the filter.
 */
import { z } from "zod";

import type { PlanTier } from "./types";

export const SUBSCRIBER_FILTERS = ["all", "pro", "trial", "expired", "free"] as const;
export type SubscriberFilter = (typeof SUBSCRIBER_FILTERS)[number];

/** Keeps letters, digits, spaces and `@._-`. Everything else is dropped. */
export function sanitizeSearch(q: string | undefined | null): string | null {
  if (!q) return null;
  const clean = q
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s@._-]/gu, "")
    .trim()
    .slice(0, 100);
  return clean.length > 0 ? clean : null;
}

export interface SubscriberCursor {
  created_at: string;
  id: string;
}

const cursorSchema = z
  .object({
    created_at: z.string().datetime({ offset: true }),
    id: z.string().uuid(),
  })
  .strict();

export function encodeSubscriberCursor(c: SubscriberCursor): string {
  return Buffer.from(JSON.stringify(c), "utf8").toString("base64url");
}

/** `null` for anything that is not exactly {created_at: ISO, id: uuid}. */
export function decodeSubscriberCursor(raw: string): SubscriberCursor | null {
  try {
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(raw, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    // Not base64/JSON: an invalid cursor, reported to the caller as such.
    return null;
  }
}

export function planTierLabel(tier: PlanTier): string {
  switch (tier) {
    case "pro":
      return "Calc3D PRO";
    case "enterprise":
      return "Enterprise";
    case "standard":
      return "Gratuito";
  }
}

export interface MembershipLite {
  organization_id: string;
  user_id: string;
  role: string;
  accepted_at: string | null;
  created_at: string;
}

/**
 * The org "owner" shown in the list: the earliest active admin (by
 * accepted_at, falling back to created_at). Deterministic, so the column does
 * not jump between reloads.
 */
export function pickOwners(memberships: readonly MembershipLite[]): Map<string, string> {
  const best = new Map<string, MembershipLite>();
  for (const m of memberships) {
    if (m.role !== "admin") continue;
    const cur = best.get(m.organization_id);
    const key = (x: MembershipLite) => x.accepted_at ?? x.created_at;
    if (!cur || key(m) < key(cur)) best.set(m.organization_id, m);
  }
  return new Map([...best].map(([org, m]) => [org, m.user_id]));
}

export function countMembers(memberships: readonly MembershipLite[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of memberships) out.set(m.organization_id, (out.get(m.organization_id) ?? 0) + 1);
  return out;
}
