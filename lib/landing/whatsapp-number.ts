/**
 * The store's WhatsApp number: parsing, display and `wa.me` links.
 *
 * PURE module (no I/O, no `server-only`) so client components can format the
 * number they receive as a prop. The number itself is resolved on the server by
 * `getStoreWhatsapp()` (lib/landing/whatsapp.ts) from
 * `landing_settings.links.whatsapp` of the landing org.
 *
 * `STORE_WHATSAPP_FALLBACK` is the ONLY place the number is written in code. It
 * used to be hard-coded in a dozen components; changing the store's number in
 * the Links manager left half of the site pointing to the old one.
 */

/** Digits only, with country code. Used when the settings have no WhatsApp link. */
export const STORE_WHATSAPP_FALLBACK = "5531999284834";

/** Normalizes a bare phone to `wa.me` digits (assumes Brazil without country code). */
function normalizeDigits(digits: string): string | null {
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

/**
 * Extracts `wa.me` digits from what the Links manager stores. Accepts
 * `https://wa.me/5531...`, `https://api.whatsapp.com/send?phone=5531...` and a
 * bare phone with or without mask. Returns `null` when nothing plausible is found.
 */
export function whatsappDigitsFrom(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  const waMe = /wa\.me\/\+?(\d{8,15})/i.exec(value);
  if (waMe?.[1]) return normalizeDigits(waMe[1]);

  const phoneParam = /[?&]phone=\+?(\d{8,15})/i.exec(value);
  if (phoneParam?.[1]) return normalizeDigits(phoneParam[1]);

  // A URL that is not a WhatsApp link (e.g. a Linktree) carries no number.
  if (/^https?:\/\//i.test(value)) return null;

  return normalizeDigits(value.replace(/\D/g, ""));
}

/** `https://wa.me/<digits>` with an optional pre-filled message. */
export function storeWhatsappUrl(digits: string, text?: string): string {
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

/**
 * Human format for a Brazilian number: `5531999284834` → `(31) 99928-4834`.
 * Anything else is shown as `+<digits>`.
 */
export function formatWhatsappDisplay(digits: string): string {
  const m = /^55(\d{2})(\d{4,5})(\d{4})$/.exec(digits);
  if (!m) return `+${digits}`;
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}
