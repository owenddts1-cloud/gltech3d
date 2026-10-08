/**
 * Core of the public cart → WhatsApp order (POST /api/v1/public/filament-orders).
 *
 * Pure functions, unit-tested without I/O. The two rules that matter live here:
 *
 *  1. The body NEVER carries a price. `.strict()` rejects unknown keys, so a
 *     `unit_price_cents` sent by a tampered client is a 422, not a silently
 *     ignored field — and `priceSiteOrder()` takes prices ONLY from the rows the
 *     server read from the database.
 *  2. Only items the server found (published filaments of the landing org) can
 *     be priced; anything else refuses the whole order, so the customer never
 *     gets a total that silently dropped an item.
 */
import { z } from "zod";
import { formatBRL } from "@/lib/pricing/pro-plans";
import {
  isOrderableAvailability,
  type FilamentAvailability,
} from "@/lib/filament-catalog/schemas";

/** Minimum time to fill the cart form. Below this it is a bot. */
export const MIN_ORDER_ELAPSED_MS = 1500;
export const MAX_ORDER_ITEMS = 30;
export const MAX_ITEM_QTY = 99;

/**
 * Customer WhatsApp → digits accepted by `site_orders_customer_whatsapp_digits`
 * (10..13 digits). National numbers get the Brazil country code.
 */
export function normalizeCustomerWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  return null;
}

export const siteOrderRequestSchema = z
  .object({
    customer_name: z.string().trim().min(2, "Informe seu nome.").max(120),
    customer_whatsapp: z
      .string()
      .trim()
      .max(40)
      .transform((v, ctx) => {
        const digits = normalizeCustomerWhatsapp(v);
        if (!digits) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "WhatsApp inválido. Use DDD + número." });
          return z.NEVER;
        }
        return digits;
      }),
    items: z
      .array(
        z
          .object({
            product_id: z.string().uuid(),
            qty: z.coerce.number().int().min(1).max(MAX_ITEM_QTY),
          })
          .strict(),
      )
      .min(1, "O carrinho está vazio.")
      .max(MAX_ORDER_ITEMS)
      .refine((items) => new Set(items.map((i) => i.product_id)).size === items.length, {
        message: "Item repetido no carrinho.",
      }),
    notes: z.string().trim().max(1000).optional(),
    /** Honeypot: hidden by CSS. Humans leave it empty. */
    website: z.string().max(200).optional(),
    /** Form fill time in ms, measured on the client. */
    elapsed_ms: z.coerce.number().int().nonnegative().optional(),
  })
  .strict();

export type SiteOrderRequest = z.infer<typeof siteOrderRequestSchema>;

/** True when the request looks automated (honeypot filled or filled too fast). */
export function isLikelyBot(input: Pick<SiteOrderRequest, "website" | "elapsed_ms">): boolean {
  if (input.website && input.website.length > 0) return true;
  return input.elapsed_ms !== undefined && input.elapsed_ms < MIN_ORDER_ELAPSED_MS;
}

/** A published filament as read by the server (the ONLY source of price). */
export interface OrderableProductRow {
  id: string;
  name: string;
  salePriceCents: number | null;
  availability: FilamentAvailability;
}

export interface PricedLine {
  productId: string;
  productName: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export type PriceSiteOrderResult =
  | { ok: true; lines: PricedLine[]; totalCents: number }
  | {
      ok: false;
      code: "item_not_found" | "item_unavailable" | "item_without_price";
      productIds: string[];
    };

/**
 * Prices the cart from the server rows. Order of the lines follows the cart.
 * `item_not_found` covers unpublished, other-org, non-filament and deleted
 * products alike: the caller does not learn which of those it was.
 */
export function priceSiteOrder(
  requested: ReadonlyArray<{ product_id: string; qty: number }>,
  rows: ReadonlyArray<OrderableProductRow>,
): PriceSiteOrderResult {
  const byId = new Map(rows.map((r) => [r.id, r]));

  const missing = requested.filter((r) => !byId.has(r.product_id)).map((r) => r.product_id);
  if (missing.length > 0) return { ok: false, code: "item_not_found", productIds: missing };

  const unavailable = requested
    .filter((r) => !isOrderableAvailability(byId.get(r.product_id)!.availability))
    .map((r) => r.product_id);
  if (unavailable.length > 0) return { ok: false, code: "item_unavailable", productIds: unavailable };

  const noPrice = requested
    .filter((r) => {
      const price = byId.get(r.product_id)!.salePriceCents;
      return price == null || price <= 0;
    })
    .map((r) => r.product_id);
  if (noPrice.length > 0) return { ok: false, code: "item_without_price", productIds: noPrice };

  const lines = requested.map((r) => {
    const row = byId.get(r.product_id)!;
    const unit = row.salePriceCents as number;
    return {
      productId: row.id,
      productName: row.name,
      qty: r.qty,
      unitPriceCents: unit,
      lineTotalCents: unit * r.qty,
    };
  });
  return { ok: true, lines, totalCents: lines.reduce((s, l) => s + l.lineTotalCents, 0) };
}

/** `"3f2a9c1e-..."` → `"3F2A9C1E"`: what the customer and the shop quote on WhatsApp. */
export function orderShortId(orderId: string): string {
  return orderId.replace(/-/g, "").slice(0, 8).toUpperCase();
}

export interface SiteOrderMessageInput {
  shortId: string;
  customerName: string;
  lines: ReadonlyArray<PricedLine>;
  totalCents: number;
  notes?: string | null;
}

/** The pt-BR text the customer sends to the shop. */
export function buildSiteOrderMessage(input: SiteOrderMessageInput): string {
  const items = input.lines
    .map(
      (l) =>
        `• ${l.qty}x ${l.productName} — ${formatBRL(l.unitPriceCents)} cada = ${formatBRL(l.lineTotalCents)}`,
    )
    .join("\n");
  const notes = input.notes?.trim() ? `\nObservações: ${input.notes.trim()}` : "";
  return (
    `Olá! Quero fazer o pedido #${input.shortId} pelo site.\n\n` +
    `${items}\n\n` +
    `Total: ${formatBRL(input.totalCents)}\n` +
    `Nome: ${input.customerName}${notes}`
  );
}

/** pt-BR messages for the refusal codes, shown as-is by the cart UI. */
export const SITE_ORDER_REFUSAL_MESSAGE: Record<
  Extract<PriceSiteOrderResult, { ok: false }>["code"],
  string
> = {
  item_not_found: "Um item do carrinho não está mais disponível no site. Atualize a página.",
  item_unavailable: "Um item do carrinho está esgotado. Remova-o para continuar.",
  item_without_price: "Um item do carrinho está sem preço. Fale com a loja pelo WhatsApp.",
};

/** Lifecycle of a site order (CHECK site_orders_status_check, 0087). */
export const SITE_ORDER_STATUSES = ["novo", "confirmado", "cancelado"] as const;
export type SiteOrderStatus = (typeof SITE_ORDER_STATUSES)[number];

export const SITE_ORDER_STATUS_LABEL: Record<SiteOrderStatus, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
};

/** `data` of a 201 from POST /api/v1/public/filament-orders. */
export interface FilamentOrderResponse {
  order_id: string;
  /** 8-char id quoted in the WhatsApp message (`#3F2A9C1E`). */
  short_id: string;
  total_cents: number;
  currency: "BRL";
  /** `https://wa.me/<store>?text=<order message>` — open it in a new tab. */
  whatsapp_url: string;
}
