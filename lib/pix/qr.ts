/**
 * Server-side Pix checkout for the Calc3D PRO: BR Code + QR built from the LIVE
 * price (platform_settings), so changing the price no longer requires
 * regenerating a code in the bank app and re-deploying a JPEG.
 *
 * Server only (reads env + settings, renders the QR with the existing `qrcode`
 * dependency). The pages call `getProPixCheckout()` and pass the result to
 * their client components as props.
 *
 * Fallback when the key is not configured (or the code cannot be built): the
 * old static `NEXT_PUBLIC_PIX_COPIA_E_COLA` + `public/pix/*.jpeg`, but ONLY if
 * that static code still carries the live price — a code with a stale amount is
 * worse than none (the key stays copiable, the buyer can still pay).
 */
import QRCode from "qrcode";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getPlatformSettings } from "@/lib/pricing/settings";
import { buildPixPayload, checkCopiaECola, normalizeBrCodeInput } from "./brcode";
import { PIX_QR_SRC } from "./config";

/** Identifier of the PRO payments inside the BR Code (field 62-05). */
const PRO_TXID = "CALC3DPRO";
const DEFAULT_CITY = "BELO HORIZONTE";
/** Banks show the name registered for the key; this is only the code's field 59. */
const DEFAULT_RECEIVER = "GLTECH3D";

export interface ProPixCheckout {
  amountCents: number;
  /** Pix key to copy, or null when not configured. */
  key: string | null;
  /** Receiver name to show next to the key, or null (row hidden). */
  receiverName: string | null;
  /** "Copia e cola" with the live amount, or null when it must not be shown. */
  copiaECola: string | null;
  /** QR as a PNG data URL (generated), or null. */
  qrDataUrl: string | null;
  /** Static QR image path (fallback only), or null. Prefer `qrDataUrl`. */
  qrSrc: string | null;
  /** Where the code came from — for logs/UI copy, not for logic. */
  source: "generated" | "static" | "none";
}

/** PNG data URL of a payload. Throws on encoder failure (caller logs). */
export async function qrDataUrl(payload: string): Promise<string> {
  return QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 240 });
}

export async function getProPixCheckout(): Promise<ProPixCheckout> {
  const settings = await getPlatformSettings();
  const amountCents = settings.proPriceCents;
  const key = env.NEXT_PUBLIC_PIX_KEY.trim() || null;
  const receiverName = env.NEXT_PUBLIC_PIX_RECEIVER_NAME.trim() || null;

  if (key) {
    try {
      const payload = buildPixPayload({
        key,
        receiverName: receiverName ?? DEFAULT_RECEIVER,
        city: env.PIX_RECEIVER_CITY.trim() || DEFAULT_CITY,
        amountCents,
        txid: PRO_TXID,
      });
      return {
        amountCents,
        key,
        receiverName,
        copiaECola: payload,
        qrDataUrl: await qrDataUrl(payload),
        qrSrc: null,
        source: "generated",
      };
    } catch (err) {
      logger.error("pix_checkout_generation_failed", {
        details: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const staticCheck = checkCopiaECola(env.NEXT_PUBLIC_PIX_COPIA_E_COLA, { amountCents, key });
  const staticUsable = staticCheck.usable && staticCheck.code.amountCents === amountCents;
  return {
    amountCents,
    key,
    receiverName,
    copiaECola: staticUsable ? normalizeBrCodeInput(env.NEXT_PUBLIC_PIX_COPIA_E_COLA) : null,
    qrDataUrl: null,
    // The static JPEG encodes the same static amount: show it only when that matches.
    qrSrc: staticUsable ? PIX_QR_SRC : null,
    source: staticUsable ? "static" : "none",
  };
}
