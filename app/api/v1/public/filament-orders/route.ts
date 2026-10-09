/**
 * POST /api/v1/public/filament-orders
 *
 * Public cart of the filament catalog → an order in the CRM (`site_orders`,
 * migration 0087) + a `wa.me` link with the order text for the customer to
 * send to the store.
 *
 * Pipeline: IP rate limit → JSON → Zod `.strict()` (a price, organization_id
 * or any unknown key in the body is a 422) → honeypot / fill time → landing org
 * resolved on the SERVER (env LANDING_ORG_SLUG, like the public catalog) →
 * items read from the database (kind 'filamento', published, that org) →
 * prices RECOMPUTED from those rows (lib/site-orders/core.ts) → INSERT with
 * the service role (no insert policy exists for anon/authenticated) → audit.
 *
 * The response carries no PII back and the audit metadata carries none either:
 * the customer's name/WhatsApp live only in the order row (row audit trigger).
 */
import { randomUUID } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

import { fail, ok } from "@/lib/api/wrappers";
import { clientIp } from "@/lib/api/client-ip";
import { audit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/ai/dispatcher/rate-limit";
import { resolveLandingOrgId } from "@/lib/landing/repository";
import { getStoreWhatsapp } from "@/lib/landing/whatsapp";
import { storeWhatsappUrl } from "@/lib/landing/whatsapp-number";
import { asAvailability, firstEmbed } from "@/lib/filament-catalog/mappers";
import { FALLBACK_FILAMENTS } from "@/lib/filament-catalog/fallback-filaments";
import {
  SITE_ORDER_REFUSAL_MESSAGE,
  buildSiteOrderMessage,
  isLikelyBot,
  orderShortId,
  priceSiteOrder,
  siteOrderRequestSchema,
  type FilamentOrderResponse,
  type OrderableProductRow,
} from "@/lib/site-orders/core";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** 5 orders per 10 minutes per IP. Each order lands in the CRM inbox of the shop. */
const RATE_LIMIT = 5;
const RATE_WINDOW_SEC = 600;

export async function POST(req: NextRequest): Promise<NextResponse> {
  const requestId = randomUUID();

  // Same caveat as the other public routes: without Upstash the limit is per
  // instance. Redis is a production prerequisite.
  const ip = clientIp(req);
  const rl = await checkRateLimit(`filament-orders:${ip}`, RATE_LIMIT, RATE_WINDOW_SEC);
  if (!rl.allowed) {
    logger.warn("filament_order_rate_limited", { requestId, ip, count: rl.count });
    return fail("rate_limited", "muitos pedidos seguidos, tente novamente em alguns minutos", 429, {
      requestId,
      headers: {
        "Retry-After": String(RATE_WINDOW_SEC),
        "X-RateLimit-Limit": String(RATE_LIMIT),
        "X-RateLimit-Remaining": "0",
      },
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("invalid_request", "invalid_json", 400, { requestId });
  }

  const parsed = siteOrderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return fail("validation_error", parsed.error.issues[0]?.message ?? "dados inválidos", 422, {
      requestId,
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const input = parsed.data;

  let store: string;
  try {
    store = await getStoreWhatsapp();
  } catch (err) {
    // getStoreWhatsapp already falls back internally; this only guards the cache layer.
    logger.error("filament_order_store_whatsapp_failed", {
      requestId,
      details: err instanceof Error ? err.message : String(err),
    });
    return fail("internal_error", "falha ao montar o pedido", 500, { requestId });
  }

  // Bot: answer like a success (saying "you are a bot" teaches it to adapt),
  // write nothing, and hand back only the plain store link.
  if (isLikelyBot(input)) {
    logger.warn("filament_order_bot_rejected", { requestId, ip, reason: input.website ? "honeypot" : "too_fast" });
    const fakeId = randomUUID();
    return ok<FilamentOrderResponse>(
      {
        order_id: fakeId,
        short_id: orderShortId(fakeId),
        total_cents: 0,
        currency: "BRL",
        whatsapp_url: storeWhatsappUrl(store),
      },
      { status: 201, requestId },
    );
  }

  let organizationId: string;
  try {
    organizationId = await resolveLandingOrgId();
  } catch (err) {
    logger.error("filament_order_org_unresolved", {
      requestId,
      details: err instanceof Error ? err.message : String(err),
    });
    return fail("upstream_unavailable", "loja indisponível no momento", 503, { requestId });
  }

  const admin = createAdminClient();
  const productIds = input.items.map((i) => i.product_id);
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const uuidProductIds = productIds.filter((id) => UUID_REGEX.test(id));

  let dbRows: OrderableProductRow[] = [];
  if (uuidProductIds.length > 0) {
    const { data: productRows, error: readErr } = await admin
      .from("products")
      .select("id, name, sale_price_cents, product_filament_specs(availability)")
      .eq("organization_id", organizationId)
      .eq("kind", "filamento")
      .eq("is_published", true)
      .in("id", uuidProductIds);
    if (readErr) {
      logger.error("filament_order_read_failed", { requestId, code: readErr.code, details: readErr.message });
      return fail("internal_error", "falha ao registrar o pedido", 500, { requestId });
    }
    dbRows = (
      (productRows ?? []) as Array<{
        id: string;
        name: string;
        sale_price_cents: number | string | null;
        product_filament_specs: unknown;
      }>
    ).map((r) => ({
      id: r.id,
      name: r.name,
      salePriceCents: r.sale_price_cents == null ? null : Number(r.sale_price_cents),
      availability: asAvailability(firstEmbed(r.product_filament_specs)?.availability),
    }));
  }

  // Resolve items from fallback catalog (when not in DB)
  const fallbackRows: OrderableProductRow[] = input.items
    .filter((item) => !dbRows.some((r) => r.id === item.product_id))
    .map((item) => {
      const fb = FALLBACK_FILAMENTS.find(
        (f) => f.id === item.product_id || f.slug === item.product_id,
      );
      if (!fb) return null;
      return {
        id: item.product_id,
        name: fb.name,
        salePriceCents: fb.priceCents,
        availability: fb.availability,
      };
    })
    .filter((r): r is OrderableProductRow => r !== null);

  const rows: OrderableProductRow[] = [...dbRows, ...fallbackRows];

  const priced = priceSiteOrder(input.items, rows);
  if (!priced.ok) {
    return fail(priced.code, SITE_ORDER_REFUSAL_MESSAGE[priced.code], 422, {
      requestId,
      details: { product_ids: priced.productIds },
    });
  }

  const notes = input.notes && input.notes.length > 0 ? input.notes : null;
  const { data: order, error: orderErr } = await admin
    .from("site_orders")
    .insert({
      organization_id: organizationId,
      customer_name: input.customer_name,
      customer_whatsapp: input.customer_whatsapp,
      status: "novo",
      total_cents: priced.totalCents,
      source: "site_filamentos",
      notes,
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    logger.error("filament_order_insert_failed", {
      requestId,
      code: orderErr?.code,
      details: orderErr?.message ?? "no data",
    });
    return fail("internal_error", "falha ao registrar o pedido", 500, { requestId });
  }
  const orderId = (order as { id: string }).id;

  const { error: itemsErr } = await admin.from("site_order_items").insert(
    priced.lines.map((l) => ({
      organization_id: organizationId,
      site_order_id: orderId,
      product_id: UUID_REGEX.test(l.productId) ? l.productId : null,
      product_name: l.productName,
      qty: l.qty,
      unit_price_cents: l.unitPriceCents,
    })),
  );
  if (itemsErr) {
    // No transaction across two PostgREST calls: undo the header so the CRM
    // never shows an order without items.
    const { error: undoErr } = await admin
      .from("site_orders")
      .delete()
      .eq("organization_id", organizationId)
      .eq("id", orderId);
    logger.error("filament_order_items_insert_failed", {
      requestId,
      orderId,
      code: itemsErr.code,
      details: itemsErr.message,
      undone: !undoErr,
      undoError: undoErr?.message,
    });
    return fail("internal_error", "falha ao registrar o pedido", 500, { requestId });
  }

  await audit({
    action: "site_order.created",
    organizationId,
    resourceType: "site_order",
    resourceId: orderId,
    requestId,
    ip,
    userAgent: req.headers.get("user-agent"),
    bypassedRls: true,
    metadata: {
      source: "site_filamentos",
      items_count: priced.lines.length,
      total_cents: priced.totalCents,
    },
  });

  const shortId = orderShortId(orderId);
  const message = buildSiteOrderMessage({
    shortId,
    customerName: input.customer_name,
    lines: priced.lines,
    totalCents: priced.totalCents,
    notes,
  });

  return ok<FilamentOrderResponse>(
    {
      order_id: orderId,
      short_id: shortId,
      total_cents: priced.totalCents,
      currency: "BRL",
      whatsapp_url: storeWhatsappUrl(store, message),
    },
    { status: 201, requestId },
  );
}
