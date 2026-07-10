/**
 * Public landing lead-capture schema (unauthenticated form on the marketing
 * site). Distinct from `lib/schemas/leads.ts` (which models `crm_leads`
 * pipeline/deal cards). A landing submission maps to a `contacts` row with
 * `source: "landing" | "newsletter"`.
 */
import { z } from "zod";

export const landingLeadSchema = z
  .object({
    type: z.enum(["lead", "newsletter"]).default("lead"),
    name: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(200),
    /** Raw phone as typed (masked or digits). Normalized to E.164 server-side. */
    phone: z.string().trim().max(40).optional(),
    consent: z.boolean().optional(),
  })
  .refine((d) => d.type === "newsletter" || (d.name?.length ?? 0) > 0, {
    message: "Nome é obrigatório",
    path: ["name"],
  });

export type LandingLead = z.infer<typeof landingLeadSchema>;

/**
 * Normalizes a Brazilian phone to E.164 (`+55DDDNNNNNNNN`). Accepts masked
 * input like `(31) 99999-9999`. Returns null when it can't produce a plausible
 * number, so the caller can store null instead of failing the whole submission.
 */
export function normalizeBrPhone(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // Already includes country code (55) → keep as-is if length is sane.
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    return `+${digits}`;
  }
  // Local number with DDD (10 = landline, 11 = mobile) → prefix Brazil code.
  if (digits.length === 10 || digits.length === 11) {
    return `+55${digits}`;
  }
  // Fallback: if it looks like a full international number, keep the leading +.
  if (digits.length >= 11 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}
